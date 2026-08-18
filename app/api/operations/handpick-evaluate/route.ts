import {NextResponse} from 'next/server';
import OpenAI from 'openai';
import {currentUser} from '@/lib/auth';
import {supabaseAdmin} from '@/lib/serverSupabase';

export async function POST(req:Request){
  try{
    const u=await currentUser();
    if(!u||u.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403});
    if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'OPENAI_API_KEY is not configured'},{status:503});
    const {handpick_id}=await req.json();
    if(!handpick_id)return NextResponse.json({error:'handpick_id is required'},{status:400});
    const sb=supabaseAdmin();
    const {data:item,error:ie}=await sb.from('handpick_items').select('*').eq('id',handpick_id).single();
    if(ie)throw ie;
    const photos=Array.isArray(item.photo_paths)?item.photo_paths:[];
    if(!photos.length)return NextResponse.json({error:'Capture at least one product photo first'},{status:400});
    const imageInputs:any[]=[];
    for(const p of photos.slice(0,12)){
      const {data:signed,error}=await sb.storage.from('handpick-inspections').createSignedUrl(p.path,600);
      if(!error&&signed?.signedUrl)imageInputs.push({type:'input_image',image_url:signed.signedUrl});
    }
    if(!imageInputs.length)return NextResponse.json({error:'Could not prepare inspection photos'},{status:500});
    const prompt=`Evaluate this product for an Indian liquidation purchase. Product name: ${item.product_name}; brand: ${item.brand||'unknown'}; model: ${item.model||'unknown'}; observed notes: ${item.observed_condition||'none'}; admin market price hint: ${item.market_price||'unknown'}; target buy hint: ${item.target_buy_price||'unknown'}; quantity under consideration: ${item.quantity||1}.
Return JSON only with keys: product_identification, condition_grade, quality_score_0_100, authenticity_confidence_0_100, visible_defects, missing_or_uncertain_items, lowest_online_price_inr, lowest_online_price_url, comparable_prices, recommended_customer_price_inr, maximum_landed_cost_inr, recommended_max_bid_inr, recommended_quantity, purchase_recommendation, confidence, reasoning, verification_actions. Do not claim authenticity as certain from photos; identify what must be manually verified. For the commercial recommendation use a 50% customer discount from the best credible comparable price and require at least 30% gross margin on selling price before transport/other landed costs; explain assumptions when price data is uncertain.`;
    const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
    const r=await client.responses.create({model:'gpt-5-mini',input:[{role:'system',content:'You are the purchase-inspection AI for a Latur liquidation business. Be conservative, evidence-based and decision-oriented.'},{role:'user',content:[{type:'input_text',text:prompt},...imageInputs]}],tools:[{type:'web_search_preview'} as any]});
    const raw=r.output_text||'';
    let report:any={raw};
    try{report=JSON.parse(raw)}catch{}
    const lowest=Number(report.lowest_online_price_inr||0);
    const sell=Number(report.recommended_customer_price_inr||Math.round(lowest*0.5));
    const maxLanded=Number(report.maximum_landed_cost_inr||Math.round(sell*0.7));
    const recBid=Number(report.recommended_max_bid_inr||maxLanded);
    const {data:updated,error:ue}=await sb.from('handpick_items').update({ai_status:'completed',ai_report:report,ai_quality_score:Number(report.quality_score_0_100||0)||null,ai_authenticity_score:Number(report.authenticity_confidence_0_100||0)||null,lowest_online_price:lowest||null,lowest_online_price_url:report.lowest_online_price_url||null,online_price_sources:report.comparable_prices||[],recommended_qty:Number(report.recommended_quantity||item.quantity||1),recommended_bid_price:recBid||null,recommended_landed_cost:maxLanded||null,recommended_sell_price:sell||null,ai_evaluated_at:new Date().toISOString()}).eq('id',handpick_id).select().single();if(ue)throw ue;
    return NextResponse.json({data:updated,report});
  }catch(e:any){return NextResponse.json({error:e.message||'AI evaluation failed'},{status:500})}
}
