import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {supabaseAdmin} from '@/lib/serverSupabase';

export async function POST(req:Request){
 try{
  const u=await currentUser();if(!u||u.role!=='admin')return NextResponse.json({error:'Admin access required'},{status:403});
  const {handpickItemId,quantity,unitPrice,promote}=await req.json();
  const qty=Number(quantity),price=Number(unitPrice);
  if(!handpickItemId||!Number.isInteger(qty)||qty<=0||!Number.isFinite(price)||price<0)return NextResponse.json({error:'Valid actual quantity and actual purchase price are required'},{status:400});
  if(promote!==true&&promote!==false)return NextResponse.json({error:'Promotion decision is required'},{status:400});
  const sb=supabaseAdmin();
  const {data:item,error:ie}=await sb.from('handpick_items').select('*').eq('id',handpickItemId).single();if(ie)throw ie;
  if(item.purchase_status&&item.purchase_status!=='pending')return NextResponse.json({error:`This inspection is already ${item.purchase_status}.`},{status:409});
  if(item.ai_status!=='completed')return NextResponse.json({error:'AI evaluation must be completed before purchase confirmation.'},{status:409});
  const {data:result,error}=await sb.rpc('confirm_handpick_purchase',{p_handpick_id:handpickItemId,p_qty:qty,p_unit_price:price,p_confirmed_by:u.username});
  if(error)throw error;
  const lotId=(result as any)?.lot_id||null;
  if(promote===true){
   await sb.from('handpick_items').update({promotion_decision:'yes',promotion_status:'queued',promotion_completed_at:null}).eq('id',handpickItemId);
   for(const channel of ['instagram','facebook','whatsapp'])await sb.from('social_promotions').insert({lot_id:lotId,handpick_item_id:handpickItemId,channel,status:'queued'});
  }else{
   const reminder=new Date(Date.now()+24*60*60*1000).toISOString();
   await sb.from('handpick_items').update({promotion_decision:'no',promotion_status:'deferred',promotion_next_reminder_at:reminder}).eq('id',handpickItemId);
   await sb.from('tasks').insert({task_type:'promotion_reminder',entity_type:'handpick_item',entity_id:handpickItemId,title:'Promote purchased product',due_at:reminder,payload:{lot_id:lotId}});
  }
  return NextResponse.json({ok:true,lot_id:lotId,lot_code:(result as any)?.lot_code||null,quantity:qty,unit_price:price,promotion:promote?'queued':'deferred'});
 }catch(e:any){return NextResponse.json({error:e?.message||'Purchase confirmation failed'},{status:500});}
}
