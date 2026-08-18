import {NextResponse} from 'next/server';
import OpenAI from 'openai';
import {currentUser} from '@/lib/auth';
import {supabaseAdmin} from '@/lib/serverSupabase';

const money=(n:number)=>Math.round(n*100)/100;

export async function POST(req:Request){
  try{
    const u=await currentUser();
    if(!u||u.role!=='admin') return NextResponse.json({error:'Admin access required'},{status:403});
    if(!process.env.OPENAI_API_KEY) return NextResponse.json({error:'OPENAI_API_KEY is not configured'},{status:503});

    const body=await req.json();
    const {handpickItemId,productName,brand,model,observedCondition,transportCostPerUnit=0,imageUrls=[]}=body||{};
    if(!productName||!Array.isArray(imageUrls)) return NextResponse.json({error:'productName and imageUrls are required'},{status:400});
    if(imageUrls.length>8) return NextResponse.json({error:'Maximum 8 inspection images per evaluation'},{status:400});

    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const content:any[]=[{type:'input_text',text:`Evaluate this liquidation/open-box product for purchase. Product: ${productName}. Brand: ${brand||'unknown'}. Model: ${model||'unknown'}. Manual observation: ${observedCondition||'none'}. Transport estimate per unit: ₹${Number(transportCostPerUnit)||0}. Search the web for current comparable online prices and identify the lowest credible price and URL. Return ONLY valid JSON with keys: product_identification, condition_summary, quality_score_0_100, authenticity_confidence_0_100, visible_risks, missing_or_unverified_information, lowest_online_price, lowest_online_price_url, online_price_sources, demand_signal, recommended_customer_price, maximum_landed_cost_for_30_percent_margin, recommended_bid_price, recommended_qty, purchase_recommendation, reasoning. Customer price must assume a 50% discount against the lowest credible online comparable price. Maximum landed cost must preserve at least 30% margin on that customer price. Deduct the supplied transport cost when calculating recommended bid price. Never claim authenticity as certain from photographs alone.`}];
    for(const imageUrl of imageUrls){content.push({type:'input_image',image_url:imageUrl});}

    const r=await client.responses.create({
      model:'gpt-5-mini',
      tools:[{type:'web_search'}],
      input:[{role:'user',content}]
    });
    let report:any;
    try{report=JSON.parse(r.output_text)}catch{report={raw:r.output_text,purchase_recommendation:'manual_review'}}

    const sb=supabaseAdmin();
    if(handpickItemId){
      await sb.from('handpick_items').update({
        ai_status:'completed',ai_report:report,ai_quality_score:report.quality_score_0_100??null,
        ai_authenticity_score:report.authenticity_confidence_0_100??null,
        lowest_online_price:report.lowest_online_price??null,
        lowest_online_price_url:report.lowest_online_price_url??null,
        online_price_sources:report.online_price_sources||[],
        recommended_qty:report.recommended_qty??null,
        recommended_bid_price:report.recommended_bid_price??null,
        recommended_landed_cost:report.maximum_landed_cost_for_30_percent_margin??null,
        recommended_sell_price:report.recommended_customer_price??null,
        ai_evaluated_at:new Date().toISOString(),photo_paths:imageUrls
      }).eq('id',handpickItemId);
      await sb.from('handpick_ai_evaluations').insert({handpick_item_id:handpickItemId,provider:'openai',model:'gpt-5-mini',status:'completed',input_media:imageUrls,report});
    }
    return NextResponse.json({report});
  }catch(e:any){
    const status=e?.status===429?429:500;
    return NextResponse.json({error:e?.message||'AI evaluation failed'},{status});
  }
}
