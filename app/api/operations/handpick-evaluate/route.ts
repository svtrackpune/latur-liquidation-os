import {NextResponse} from 'next/server';
import OpenAI from 'openai';
import {currentUser} from '@/lib/auth';
import {supabaseAdmin} from '@/lib/serverSupabase';

export async function POST(req:Request){
 try{
  const u=await currentUser();if(!u||u.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403});
  if(!process.env.OPENAI_API_KEY)return NextResponse.json({error:'OPENAI_API_KEY is not configured'},{status:503});
  const {handpick_id}=await req.json();if(!handpick_id)return NextResponse.json({error:'handpick_id is required'},{status:400});
  const sb=supabaseAdmin();const {data:item,error:ie}=await sb.from('handpick_items').select('*').eq('id',handpick_id).single();if(ie)throw ie;
  const photos=Array.isArray(item.photo_paths)?item.photo_paths:[];if(!photos.length)return NextResponse.json({error:'Capture at least one product photo first'},{status:400});
  const imageInputs:any[]=[];for(const p of photos.slice(0,12)){const {data:signed,error}=await sb.storage.from('handpick-inspections').createSignedUrl(p.path,600);if(!error&&signed?.signedUrl)imageInputs.push({type:'input_image',image_url:signed.signedUrl});}
  if(!imageInputs.length)return NextResponse.json({error:'Could not prepare inspection photos'},{status:500});
  const prompt=`You are evaluating a liquidation/open-box product for purchase in India. Identify the product from the photographs first; supplied name/brand/model may be blank or wrong. Research current credible online comparable prices yourself. Assess visible condition, defects, missing parts, packaging, model/label consistency and authenticity risk. Never claim authenticity as certain from photographs alone.
Commercial rules: customer target selling price = 50% of the lowest credible comparable online price; maximum landed cost = 70% of that customer target, preserving at least 30% gross margin on selling price; recommended maximum purchase bid = maximum landed cost after reserving known transport/landing cost. Recommend quantity based on evidence and likely demand, conservatively when evidence is weak. If price evidence is uncertain, recommend manual review rather than inventing a number.
Return ONLY valid JSON with: product_identification, brand, model, condition_grade, quality_score_0_100, authenticity_confidence_0_100, visible_defects, missing_or_uncertain_items, lowest_online_price_inr, lowest_online_price_url, comparable_prices, demand_signal, recommended_customer_price_inr, maximum_landed_cost_inr, transport_or_landing_reserve_inr, recommended_max_bid_inr, recommended_quantity, purchase_recommendation, confidence, reasoning, verification_actions.
Supplied hints: product=${item.product_name||'unknown'}; brand=${item.brand||'unknown'}; model=${item.model||'unknown'}; admin observation=${item.observed_condition||'none'}. Do not use manually entered market price or target buy price as a source of truth.`;
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY});
  const r=await client.responses.create({model:'gpt-5-mini',input:[{role:'system',content:'You are the purchase-inspection AI for a Latur liquidation business. Be conservative, evidence-based, commercially useful and decision-oriented.'},{role:'user',content:[{type:'input_text',text:prompt},...imageInputs]}],tools:[{type:'web_search'} as any]});
  const raw=r.output_text||'';let report:any={raw};try{report=JSON.parse(raw)}catch{}
  const lowest=Number(report.lowest_online_price_inr||0);const sell=Number(report.recommended_customer_price_inr||Math.round(lowest*0.5));const maxLanded=Number(report.maximum_landed_cost_inr||Math.round(sell*0.7));const reserve=Number(report.transport_or_landing_reserve_inr||0);const recBid=Number(report.recommended_max_bid_inr||Math.max(0,maxLanded-reserve));
  if(report.product_identification&&item.product_name==='Pending AI identification')await sb.from('handpick_items').update({product_name:String(report.product_identification),brand:report.brand||item.brand,model:report.model||item.model}).eq('id',handpick_id);
  const {data:updated,error:ue}=await sb.from('handpick_items').update({ai_status:'completed',ai_report:report,ai_quality_score:Number(report.quality_score_0_100||0)||null,ai_authenticity_score:Number(report.authenticity_confidence_0_100||0)||null,lowest_online_price:lowest||null,lowest_online_price_url:report.lowest_online_price_url||null,online_price_sources:report.comparable_prices||[],recommended_qty:Number(report.recommended_quantity||1),recommended_bid_price:recBid||null,recommended_landed_cost:maxLanded||null,recommended_sell_price:sell||null,ai_evaluated_at:new Date().toISOString()}).eq('id',handpick_id).select().single();if(ue)throw ue;
  await sb.from('handpick_ai_evaluations').insert({handpick_item_id:handpick_id,provider:'openai',model:'gpt-5-mini',status:'completed',input_media:photos,report});
  return NextResponse.json({data:updated,report});
 }catch(e:any){const status=e?.status===429?429:500;return NextResponse.json({error:e.message||'AI evaluation failed'},{status})}
}
