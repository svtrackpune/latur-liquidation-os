'use client';
import {useEffect,useState} from 'react';

type Location={id:string;name:string;town:string;location_type:string};
type Product={id:string;sku:string;barcode?:string;product_name:string;brand?:string;model?:string;grade?:string;status:string;location:string;selling_price?:number};

export default function InventoryOps(){
  const [tab,setTab]=useState<'scan'|'receive'|'move'>('scan');
  const [locations,setLocations]=useState<Location[]>([]);
  const [products,setProducts]=useState<Product[]>([]);
  const [code,setCode]=useState('');
  const [selected,setSelected]=useState<Product|null>(null);
  const [message,setMessage]=useState('');
  const [error,setError]=useState('');
  const [receive,setReceive]=useState<any>({expected_units:0,quantity:1,location:'Latur Warehouse',grade:'A'});
  const [move,setMove]=useState<any>({from_location:'Latur Warehouse',to_location:'Nilanga Warehouse',quantity:1});
  const [receivingId,setReceivingId]=useState('');

  const load=async()=>{
    const [p,l]=await Promise.all([fetch('/api/data?table=products',{cache:'no-store'}),fetch('/api/operations?type=locations',{cache:'no-store'})]);
    const pd=await p.json(),ld=await l.json();setProducts(pd.data||[]);setLocations(ld.data||[]);
  };
  useEffect(()=>{load()},[]);
  const find=()=>{setMessage('');setError('');const q=code.trim().toLowerCase();const p=products.find(x=>x.sku?.toLowerCase()===q||x.barcode?.toLowerCase()===q);if(!p){setSelected(null);setError('No matching product. Use Receive to create a product automatically from the scanned code.');return}setSelected(p)};
  const receiveScan=async()=>{
    setMessage('');setError('');
    const r=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'receive',receiving_id:receivingId||undefined,expected_units:Number(receive.expected_units||0),lot_id:receive.lot_id||undefined,barcode:code||undefined,sku:receive.sku||undefined,product_name:receive.product_name||undefined,brand:receive.brand||undefined,model:receive.model||undefined,quantity:Number(receive.quantity||1),grade:receive.grade,location:receive.location,market_price:Number(receive.market_price||0),selling_price:Number(receive.selling_price||0),verification_status:'verified'})});
    const d=await r.json();if(!r.ok){setError(d.error||'Receiving failed');return}setReceivingId(d.data.session.id);setSelected(d.data.product);setMessage(`Verified and received ${d.data.product.product_name} • ${d.data.product.sku}`);setCode('');load();
  };
  const complete=async()=>{if(!receivingId)return;const r=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'complete_receive',receiving_id:receivingId})});const d=await r.json();if(!r.ok){setError(d.error||'Could not complete receiving');return}setMessage(`Receiving completed. ${d.data.received_units||0} units processed.`);setReceivingId('');};
  const transfer=async()=>{
    setMessage('');setError('');if(!selected){setError('Scan/select a product first.');return}
    const r=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'transfer',from_location:move.from_location,to_location:move.to_location,items:[{product_id:selected.id,quantity:Number(move.quantity||1)}]})});const d=await r.json();if(!r.ok){setError(d.error||'Transfer failed');return}setMessage(`Transfer ${d.data.transfer.transfer_no} created. Stock is now marked in transit.`);setSelected(null);setCode('');load();
  };
  return <div className="panel" style={{marginBottom:18}}>
    <div className="row" style={{gap:8,flexWrap:'wrap'}}><div><strong>Operations — scan first</strong><div style={{fontSize:12,color:'#64748b'}}>Staff verifies, receives and moves stock. The system creates the records.</div></div><div style={{marginLeft:'auto',display:'flex',gap:6}}>{[['scan','Scan & lookup'],['receive','Receive delivery'],['move','Move stock']].map(([k,v])=><button key={k} className="btn" onClick={()=>setTab(k as any)}>{v}</button>)}</div></div>
    {(message||error)&&<div className={error?'panel danger':'panel'} style={{marginTop:12}}>{error||message}</div>}
    {tab==='scan'&&<div className="formgrid" style={{marginTop:14}}><input className="input" placeholder="Scan barcode / SKU" value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')find()}} autoFocus/><button className="btn" onClick={find}>Find</button>{selected&&<div className="panel" style={{gridColumn:'1/-1'}}><strong>{selected.product_name}</strong> · {selected.brand||''} {selected.model||''}<div style={{marginTop:6,fontSize:13}}>SKU: {selected.sku} · Grade: {selected.grade||'Pending'} · Status: {selected.status} · Location: {selected.location} · Price: ₹{Number(selected.selling_price||0).toLocaleString('en-IN')}</div></div>}</div>}
    {tab==='receive'&&<div className="formgrid" style={{marginTop:14}}><input className="input" placeholder="Scan barcode / existing SKU" value={code} onChange={e=>setCode(e.target.value)}/><input className="input" placeholder="Product name (only if new)" value={receive.product_name||''} onChange={e=>setReceive({...receive,product_name:e.target.value})}/><input className="input" placeholder="Brand" value={receive.brand||''} onChange={e=>setReceive({...receive,brand:e.target.value})}/><input className="input" placeholder="Model" value={receive.model||''} onChange={e=>setReceive({...receive,model:e.target.value})}/><input className="input" type="number" min="1" placeholder="Qty" value={receive.quantity} onChange={e=>setReceive({...receive,quantity:e.target.value})}/><input className="input" type="number" min="0" placeholder="Expected units in delivery" value={receive.expected_units} onChange={e=>setReceive({...receive,expected_units:e.target.value})}/><select className="input" value={receive.grade} onChange={e=>setReceive({...receive,grade:e.target.value})}><option>Pending</option><option>A</option><option>B</option><option>C</option><option>Repair</option></select><select className="input" value={receive.location} onChange={e=>setReceive({...receive,location:e.target.value})}>{locations.map(l=><option key={l.id}>{l.name}</option>)}</select><button className="btn" onClick={receiveScan}>Scan & verify received</button>{receivingId&&<button className="btn" onClick={complete}>Complete delivery</button>}</div>}
    {tab==='move'&&<div className="formgrid" style={{marginTop:14}}><input className="input" placeholder="Scan barcode / SKU" value={code} onChange={e=>setCode(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')find()}}/><button className="btn" onClick={find}>Find stock</button><select className="input" value={move.from_location} onChange={e=>setMove({...move,from_location:e.target.value})}>{locations.map(l=><option key={l.id}>{l.name}</option>)}</select><select className="input" value={move.to_location} onChange={e=>setMove({...move,to_location:e.target.value})}>{locations.map(l=><option key={l.id}>{l.name}</option>)}</select><input className="input" type="number" min="1" value={move.quantity} onChange={e=>setMove({...move,quantity:e.target.value})}/><button className="btn" onClick={transfer}>Create stock transfer</button>{selected&&<div className="panel" style={{gridColumn:'1/-1'}}>{selected.product_name} · {selected.sku} · currently {selected.location}</div>}</div>}
  </div>
}
