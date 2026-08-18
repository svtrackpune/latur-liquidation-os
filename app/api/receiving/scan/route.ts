import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {supabaseAdmin} from '@/lib/serverSupabase';

const allowed=(role:string)=>role==='admin'||role==='warehouse';

export async function POST(req:Request){
  try{
    const u=await currentUser();
    if(!u||!allowed(u.role)) return NextResponse.json({error:'Warehouse access required'},{status:403});
    const {receivingId,productId,quantity=1,grade}=await req.json();
    if(!receivingId||!productId||Number(quantity)<=0) return NextResponse.json({error:'receivingId, productId and quantity are required'},{status:400});
    const sb=supabaseAdmin();
    const {data:session,error:se}=await sb.from('receiving_sessions').select('id,lot_id,status,expected_units,received_units').eq('id',receivingId).maybeSingle();
    if(se) throw se;
    if(!session) return NextResponse.json({error:'Receiving session not found'},{status:404});
    const {data:product,error:pe}=await sb.from('products').select('id,sku,product_name,brand,model,selling_price,status,lot_id').eq('id',productId).maybeSingle();
    if(pe) throw pe;
    if(!product||product.lot_id!==session.lot_id) return NextResponse.json({error:'Product is not part of this receiving lot'},{status:400});
    const qty=Number(quantity);
    const unitBarcode=`LLOU-${product.sku}-${Date.now().toString(36).toUpperCase()}`;
    const {data:unit,error:ue}=await sb.from('inventory_units').insert({product_id:product.id,lot_id:session.lot_id,unit_barcode:unitBarcode,lot_code:session.lot_id,product_code:product.sku,product_name:product.product_name,selling_price:product.selling_price||0,status:'ready',verified_by:u.username,verified_at:new Date().toISOString()}).select('id,unit_barcode,product_name,selling_price,status').single();
    if(ue) throw ue;
    await sb.from('receiving_items').insert({receiving_id:receivingId,product_id:product.id,sku:product.sku,barcode:unitBarcode,quantity:qty,grade:grade||'A',verification_status:'verified',verified_by:u.username,verified_at:new Date().toISOString()});
    await sb.from('products').update({barcode:unitBarcode,status:'in_stock',grade:grade||'A',received_at:new Date().toISOString()}).eq('id',product.id);
    const received=Number(session.received_units||0)+qty;
    await sb.from('receiving_sessions').update({received_units:received,discrepancy_units:Math.max(0,Number(session.expected_units||0)-received)}).eq('id',receivingId);
    return NextResponse.json({ok:true,unit,received_units:received,expected_units:Number(session.expected_units||0)});
  }catch(e:any){return NextResponse.json({error:e?.message||'Receiving scan failed'},{status:500});}
}
