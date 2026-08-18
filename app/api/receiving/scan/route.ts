import {NextResponse} from 'next/server';
import {currentUser} from '@/lib/auth';
import {supabaseAdmin} from '@/lib/serverSupabase';

const allowed=(role:string)=>['admin','warehouse'].includes(role);

export async function GET(){
  try{
    const u=await currentUser();
    if(!u||!allowed(u.role)) return NextResponse.json({error:'Warehouse access required'},{status:403});
    const sb=supabaseAdmin();
    const {data,error}=await sb.from('receiving_sessions').select('*,lots(*)').in('status',['in_progress','pending']).order('started_at',{ascending:false}).limit(50);
    if(error) throw error;
    return NextResponse.json({data:data||[]});
  }catch(e:any){return NextResponse.json({error:e?.message||'Unable to load receiving sessions'},{status:500});}
}

export async function POST(req:Request){
  try{
    const u=await currentUser();
    if(!u||!allowed(u.role)) return NextResponse.json({error:'Warehouse access required'},{status:403});
    const {receivingId,productId,barcode,sku,quantity=1,grade}=await req.json();
    if(!receivingId) return NextResponse.json({error:'Receiving session is required'},{status:400});
    const qty=Number(quantity);
    if(!Number.isInteger(qty)||qty<=0) return NextResponse.json({error:'Quantity must be a positive whole number'},{status:400});
    const sb=supabaseAdmin();
    const {data:session,error:se}=await sb.from('receiving_sessions').select('id,lot_id,status,expected_units,received_units').eq('id',receivingId).maybeSingle();
    if(se) throw se;
    if(!session) return NextResponse.json({error:'Receiving session not found'},{status:404});
    if(session.status==='completed') return NextResponse.json({error:'This receiving session is already completed'},{status:409});

    let product:any=null;
    if(productId){
      const q=await sb.from('products').select('id,sku,barcode,product_name,brand,model,selling_price,status,lot_id,grade').eq('id',productId).maybeSingle();
      if(q.error) throw q.error; product=q.data;
    }else if(barcode||sku){
      const key=String(barcode||sku).trim();
      const q=barcode
        ? await sb.from('products').select('id,sku,barcode,product_name,brand,model,selling_price,status,lot_id,grade').eq('barcode',key).maybeSingle()
        : await sb.from('products').select('id,sku,barcode,product_name,brand,model,selling_price,status,lot_id,grade').eq('sku',key).maybeSingle();
      if(q.error) throw q.error; product=q.data;
    }
    if(!product) return NextResponse.json({error:'Product barcode/SKU was not found. Admin must add it through the purchase inspection workflow.'},{status:404});
    if(product.lot_id!==session.lot_id) return NextResponse.json({error:'This product does not belong to the selected receiving lot.'},{status:400});

    const already=Number(session.received_units||0);
    const expected=Number(session.expected_units||0);
    if(expected>0 && already+qty>expected) return NextResponse.json({error:`Receiving ${qty} unit(s) would exceed the expected ${expected}. Current verified: ${already}.`},{status:409});

    const unitRows=[];
    for(let i=0;i<qty;i++){
      const unitBarcode=`LLOU-${product.sku}-${Date.now().toString(36).toUpperCase()}-${i+1}`;
      const {data:unit,error:ue}=await sb.from('inventory_units').insert({product_id:product.id,lot_id:session.lot_id,unit_barcode:unitBarcode,lot_code:String(session.lot_id),product_code:product.sku,product_name:product.product_name,selling_price:product.selling_price||0,status:'ready',verified_by:u.username,verified_at:new Date().toISOString(),label_printed_at:null}).select('id,unit_barcode,product_name,selling_price,status').single();
      if(ue) throw ue;
      unitRows.push(unit);
      const {error:ie}=await sb.from('receiving_items').insert({receiving_id:receivingId,product_id:product.id,sku:product.sku,barcode:unitBarcode,quantity:1,grade:grade||product.grade||'Pending',verification_status:'verified',verified_by:u.username,verified_at:new Date().toISOString()});
      if(ie) throw ie;
    }

    const received=already+qty;
    const {data:updated,error:ue}=await sb.from('receiving_sessions').update({received_units:received,discrepancy_units:Math.max(0,expected-received)}).eq('id',receivingId).select('id,lot_id,status,expected_units,received_units,discrepancy_units').single();
    if(ue) throw ue;
    const {error:pe}=await sb.from('products').update({status:'in_stock',grade:grade||product.grade||'Pending',received_at:new Date().toISOString()}).eq('id',product.id);
    if(pe) throw pe;
    return NextResponse.json({ok:true,units:unitRows,product,session:updated,remaining:Math.max(0,expected-received)});
  }catch(e:any){return NextResponse.json({error:e?.message||'Receiving scan failed'},{status:500});}
}
