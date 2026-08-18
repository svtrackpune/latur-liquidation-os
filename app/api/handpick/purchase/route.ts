import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {supabaseAdmin} from '@/lib/serverSupabase';

export async function POST(req:Request){
  try{
    const u=await currentUser();
    if(!u||u.role!=='admin') return NextResponse.json({error:'Admin access required'},{status:403});
    const {handpickItemId,quantity,unitPrice,promote}=await req.json();
    if(!handpickItemId||Number(quantity)<=0||Number(unitPrice)<0) return NextResponse.json({error:'Valid purchase item, quantity and price are required'},{status:400});
    const sb=supabaseAdmin();
    const {data,error}=await sb.rpc('confirm_handpick_purchase',{p_handpick_id:handpickItemId,p_qty:Number(quantity),p_unit_price:Number(unitPrice),p_confirmed_by:u.username});
    if(error) throw error;
    const result=data as any;
    if(promote===true){
      await sb.from('handpick_items').update({promotion_decision:'yes',promotion_status:'queued'}).eq('id',handpickItemId);
      for(const channel of ['instagram','facebook','whatsapp']) await sb.from('social_promotions').insert({lot_id:result.lot_id,handpick_item_id:handpickItemId,channel,status:'queued'});
    }else if(promote===false){
      const reminder=new Date(Date.now()+24*60*60*1000).toISOString();
      await sb.from('handpick_items').update({promotion_decision:'no',promotion_status:'deferred',promotion_next_reminder_at:reminder}).eq('id',handpickItemId);
      await sb.from('tasks').insert({task_type:'promotion_reminder',entity_type:'handpick_item',entity_id:handpickItemId,title:'Promote purchased product',due_at:reminder,payload:{lot_id:result.lot_id}});
    }
    return NextResponse.json({ok:true,...result});
  }catch(e:any){return NextResponse.json({error:e?.message||'Purchase confirmation failed'},{status:500});}
}
