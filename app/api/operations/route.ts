import {NextResponse} from 'next/server';
import {supabaseAdmin} from '@/lib/serverSupabase';
import {currentUser} from '@/lib/auth';
const ok=(data:any)=>NextResponse.json({data});
const fail=(message:string,status=400)=>NextResponse.json({error:message},{status});
function allowed(role:string,action:string){
 if(action==='handpick'||action==='handpick_deny')return role==='admin';
 if(action==='receive'||action==='complete_receive')return ['admin','manager','warehouse'].includes(role);
 if(action==='transfer'||action==='receive_transfer')return ['admin','manager','warehouse'].includes(role);
 return false;
}
export async function GET(req:Request){
 try{
  const u=await currentUser();if(!u)return fail('Unauthorized',401);const sb=supabaseAdmin();const type=new URL(req.url).searchParams.get('type')||'locations';
  if(type==='locations'){const {data,error}=await sb.from('stock_locations').select('*').eq('active',true).order('name');if(error)throw error;return ok(data||[])}
  if(type==='receiving'){const {data,error}=await sb.from('receiving_sessions').select('*').order('started_at',{ascending:false}).limit(50);if(error)throw error;return ok(data||[])}
  if(type==='transfers'){const {data,error}=await sb.from('stock_transfers').select('*,stock_transfer_items(*)').order('dispatched_at',{ascending:false}).limit(50);if(error)throw error;return ok(data||[])}
  if(type==='handpick'){if(u.role!=='admin')return fail('Forbidden',403);const {data,error}=await sb.from('handpick_items').select('*').order('created_at',{ascending:false}).limit(100);if(error)throw error;return ok(data||[])}
  return fail('Unknown operation list');
 }catch(e:any){return fail(e.message||'Operation failed',500)}
}
export async function POST(req:Request){
 try{
  const u=await currentUser();if(!u)return fail('Unauthorized',401);const body=await req.json();const action=String(body.action||'');if(!allowed(u.role,action))return fail('Forbidden',403);const sb=supabaseAdmin();
  if(action==='handpick'){
   const {data,error}=await sb.from('handpick_items').insert({admin_user:u.username,visit_date:body.visit_date||new Date().toISOString().slice(0,10),vendor_id:body.vendor_id||null,lot_id:body.lot_id||null,barcode:body.barcode||null,product_name:body.product_name||'Pending AI identification',brand:body.brand||null,model:body.model||null,serial_no:body.serial_no||null,quantity:1,observed_condition:body.observed_condition||null,market_price:null,target_buy_price:null,decision:'pending',purchase_status:'pending',notes:body.notes||null}).select().single();if(error)throw error;return ok(data);
  }
  if(action==='handpick_deny'){
   if(!body.handpick_id)return fail('Inspection is required');
   const {data,error}=await sb.from('handpick_items').update({decision:'deny',purchase_status:'denied',purchase_confirmed_by:u.username}).eq('id',body.handpick_id).eq('purchase_status','pending').select().single();
   if(error)throw error;return ok(data);
  }
  if(action==='receive'){
   const lotId=body.lot_id||null;const qty=Math.max(1,Number(body.quantity||1));let sessionId=body.receiving_id;
   if(!sessionId){const {data:session,error}=await sb.from('receiving_sessions').insert({lot_id:lotId,status:'in_progress',expected_units:Number(body.expected_units||0),started_by:u.username}).select().single();if(error)throw error;sessionId=session.id}
   let product:any=null;const key=String(body.barcode||body.sku||'').trim();
   if(key){const q=body.barcode?sb.from('products').select('*').eq('barcode',key).maybeSingle():sb.from('products').select('*').eq('sku',key).maybeSingle();const result=await q;if(result.error)throw result.error;product=result.data}
   const location=body.location||'Latur Warehouse';
   if(product){const {data:p,error}=await sb.from('products').update({status:'in_stock',location,grade:body.grade||product.grade,received_at:new Date().toISOString(),condition_notes:body.condition_notes||product.condition_notes}).eq('id',product.id).select().single();if(error)throw error;product=p}
   else{const baseSku=String(body.sku||body.barcode||`AUTO-${Date.now()}`).trim();const sku=baseSku+(qty>1?`-${Date.now().toString().slice(-5)}`:'');const {data:p,error}=await sb.from('products').insert({sku,barcode:body.barcode||null,lot_id:lotId,product_name:body.product_name||'Unidentified Product',brand:body.brand||null,model:body.model||null,serial_no:body.serial_no||null,grade:body.grade||'Pending',condition_notes:body.condition_notes||'Received - verification completed',purchase_cost:Number(body.purchase_cost||0),landed_cost:Number(body.landed_cost||0),market_price:Number(body.market_price||0),selling_price:Number(body.selling_price||0),location,status:'in_stock',received_at:new Date().toISOString()}).select().single();if(error)throw error;product=p}
   const {data:item,error:ie}=await sb.from('receiving_items').insert({receiving_id:sessionId,product_id:product.id,sku:product.sku,barcode:body.barcode||product.barcode||null,quantity:qty,grade:body.grade||product.grade||'Pending',verification_status:body.verification_status||'verified',discrepancy_note:body.discrepancy_note||null,verified_by:u.username}).select().single();if(ie)throw ie;
   const {data:items,error:qe}=await sb.from('receiving_items').select('quantity').eq('receiving_id',sessionId);if(qe)throw qe;const received=(items||[]).reduce((n:any,x:any)=>n+Number(x.quantity||0),0);const {data:session,error:ue}=await sb.from('receiving_sessions').update({received_units:received,discrepancy_units:Math.max(0,Number(body.expected_units||0)-received)}).eq('id',sessionId).select().single();if(ue)throw ue;return ok({session,item,product});
  }
  if(action==='complete_receive'){if(!body.receiving_id)return fail('Receiving session is required');const {data,error}=await sb.from('receiving_sessions').update({status:'completed',completed_by:u.username,completed_at:new Date().toISOString(),notes:body.notes||null}).eq('id',body.receiving_id).select().single();if(error)throw error;return ok(data)}
  if(action==='transfer'){const items=Array.isArray(body.items)?body.items:[];if(!body.from_location||!body.to_location||!items.length)return fail('Source, destination and at least one product are required');if(body.from_location===body.to_location)return fail('Source and destination must be different');const transferNo=`ST-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;const {data:transfer,error}=await sb.from('stock_transfers').insert({transfer_no:transferNo,from_location:body.from_location,to_location:body.to_location,status:'in_transit',created_by:u.username,notes:body.notes||null}).select().single();if(error)throw error;const rows=[];for(const x of items){let product:any=null;if(x.product_id){const q=await sb.from('products').select('*').eq('id',x.product_id).maybeSingle();if(q.error)throw q.error;product=q.data}else if(x.sku){const q=await sb.from('products').select('*').eq('sku',x.sku).maybeSingle();if(q.error)throw q.error;product=q.data}if(!product)continue;const qty=Math.max(1,Number(x.quantity||1));if(product.location!==body.from_location||product.status!=='in_stock')continue;const {data:row,error:ie}=await sb.from('stock_transfer_items').insert({transfer_id:transfer.id,product_id:product.id,sku:product.sku,quantity:qty}).select().single();if(ie)throw ie;rows.push(row);await sb.from('products').update({status:'in_transit',location:`IN TRANSIT: ${body.from_location} → ${body.to_location}`}).eq('id',product.id)}if(!rows.length){await sb.from('stock_transfers').delete().eq('id',transfer.id);return fail('No eligible in-stock products were found at the source location')}return ok({transfer,items:rows});
  }
  if(action==='receive_transfer'){if(!body.transfer_id)return fail('Transfer is required');const {data:transfer,error:te}=await sb.from('stock_transfers').select('*,stock_transfer_items(*)').eq('id',body.transfer_id).single();if(te)throw te;if(transfer.status==='received')return fail('Transfer already received');for(const item of transfer.stock_transfer_items||[]){await sb.from('products').update({status:'in_stock',location:transfer.to_location}).eq('id',item.product_id);await sb.from('stock_transfer_items').update({received_qty:item.quantity}).eq('id',item.id)}const {data,error}=await sb.from('stock_transfers').update({status:'received',received_at:new Date().toISOString()}).eq('id',transfer.id).select().single();if(error)throw error;return ok(data)}
  return fail('Unknown operation');
 }catch(e:any){return fail(e.message||'Operation failed',500)}
}
