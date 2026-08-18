'use client';
import {useEffect,useRef,useState} from 'react';

type Report=any;
type Item=any;

const money=(n:any)=>Number(n||0).toLocaleString('en-IN',{maximumFractionDigits:0});

export default function HandpickConsole(){
 const [items,setItems]=useState<Item[]>([]);
 const [photos,setPhotos]=useState<File[]>([]);
 const [draft,setDraft]=useState<any>({});
 const [selected,setSelected]=useState<Item|null>(null);
 const [report,setReport]=useState<Report|null>(null);
 const [actualQty,setActualQty]=useState('');
 const [actualPrice,setActualPrice]=useState('');
 const [promote,setPromote]=useState<boolean|null>(null);
 const [busy,setBusy]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');
 const cameraRef=useRef<HTMLInputElement>(null);
 const galleryRef=useRef<HTMLInputElement>(null);

 const load=async()=>{const r=await fetch('/api/operations?type=handpick',{cache:'no-store'});const d=await r.json();if(r.ok)setItems(d.data||[])};
 useEffect(()=>{load()},[]);
 const addPhotos=(files:FileList|null)=>{if(!files)return;const incoming=Array.from(files).filter(f=>f.type.startsWith('image/'));setPhotos(p=>[...p,...incoming].slice(0,12));};
 const reset=()=>{setDraft({});setPhotos([]);setReport(null);setSelected(null);setActualQty('');setActualPrice('');setPromote(null);setMessage('');setError('');};
 const capture=async()=>{
  setBusy(true);setError('');setMessage('');
  try{
   if(!photos.length)throw new Error('Take at least one clear product photo.');
   const r=await fetch('/api/operations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'handpick',product_name:draft.product_name||'Pending AI identification',brand:draft.brand||null,model:draft.model||null,serial_no:draft.serial_no||null,barcode:draft.barcode||null,quantity:1,observed_condition:draft.observed_condition||null,decision:'pending'})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Could not create inspection');
   for(const file of photos){const fd=new FormData();fd.append('handpick_id',d.data.id);fd.append('file',file);const up=await fetch('/api/operations/handpick-photo',{method:'POST',body:fd});const ud=await up.json();if(!up.ok)throw new Error(ud.error||'Photo upload failed');}
   setMessage('Inspection captured. Product photos are securely attached.');await load();setSelected(d.data);setDraft({});setPhotos([]);
  }catch(e:any){setError(e.message||'Could not capture inspection')}finally{setBusy(false)}
 };
 const evaluate=async(item:Item)=>{
  setBusy(true);setError('');setMessage('AI is identifying the product, inspecting condition and checking current market prices…');setReport(null);setSelected(item);
  try{const r=await fetch('/api/operations/handpick-evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({handpick_id:item.id})});const d=await r.json();if(!r.ok)throw new Error(d.error||'AI evaluation failed');setReport(d.report||null);setMessage('AI evaluation complete. Review the recommendation before deciding.');await load();}
  catch(e:any){setError(e.message||'AI evaluation failed')}finally{setBusy(false)}
 };
 const confirmPurchase=async()=>{
  if(!selected)return;
  const qty=Number(actualQty),price=Number(actualPrice);
  if(!qty||qty<1)return setError('Enter the actual quantity purchased.');
  if(!Number.isFinite(price)||price<0)return setError('Enter the actual purchase price per unit.');
  if(promote===null)return setError('Choose whether to promote this purchase now.');
  setBusy(true);setError('');
  try{const r=await fetch('/api/handpick/purchase',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({handpickItemId:selected.id,quantity:qty,unitPrice:price,promote})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Purchase confirmation failed');setMessage(`Purchase confirmed. Lot ${d.lot_code||d.lot_id||'created'} is ready for warehouse receiving.`);setReport(null);setSelected(null);setActualQty('');setActualPrice('');setPromote(null);await load();}
  catch(e:any){setError(e.message||'Purchase confirmation failed')}finally{setBusy(false)}
 };
 return <section className="panel" style={{marginBottom:18}}>
  <div className="row"><div><h2 style={{margin:0}}>Admin Purchase Inspection</h2><p style={{margin:'4px 0',color:'#64748b'}}>Capture once. AI evaluates. Admin decides. Purchase creates the lot automatically.</p></div><span className="badge">Admin only</span></div>
  {(message||error)&&<div className={error?'panel danger':'panel'} style={{marginTop:12}}>{error||message}</div>}

  <div className="panel" style={{marginTop:14,border:'1px solid #dbeafe'}}>
   <h3 style={{marginTop:0}}>1. Capture product</h3>
   <p style={{color:'#64748b',marginTop:4}}>Do not enter market price or buy price. AI will research and calculate those.</p>
   <div className="formgrid">
    <input className="input" placeholder="Barcode / QR (optional)" value={draft.barcode||''} onChange={e=>setDraft({...draft,barcode:e.target.value})}/>
    <input className="input" placeholder="Product name (optional)" value={draft.product_name||''} onChange={e=>setDraft({...draft,product_name:e.target.value})}/>
    <input className="input" placeholder="Brand (optional)" value={draft.brand||''} onChange={e=>setDraft({...draft,brand:e.target.value})}/>
    <input className="input" placeholder="Model (optional)" value={draft.model||''} onChange={e=>setDraft({...draft,model:e.target.value})}/>
    <input className="input" placeholder="Serial / label (optional)" value={draft.serial_no||''} onChange={e=>setDraft({...draft,serial_no:e.target.value})}/>
    <textarea className="input" placeholder="Anything you noticed (optional)" rows={2} value={draft.observed_condition||''} onChange={e=>setDraft({...draft,observed_condition:e.target.value})}/>
    <div style={{gridColumn:'1 / -1'}}><strong>Inspection photos</strong><p style={{margin:'4px 0 10px',color:'#64748b',fontSize:13}}>Front, back, sides, model/serial label, defects and accessories. Up to 12 photos.</p><div className="row" style={{justifyContent:'flex-start',gap:8,flexWrap:'wrap'}}><button type="button" className="btn" onClick={()=>cameraRef.current?.click()}>📷 Take photo</button><button type="button" className="btn" onClick={()=>galleryRef.current?.click()}>🖼 Add photos</button><input ref={cameraRef} hidden type="file" accept="image/*" capture="environment" onChange={e=>{addPhotos(e.target.files);e.currentTarget.value=''}}/><input ref={galleryRef} hidden type="file" accept="image/*" multiple onChange={e=>{addPhotos(e.target.files);e.currentTarget.value=''}}/></div>{photos.length>0&&<div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(80px,1fr))',gap:8,marginTop:12}}>{photos.map((p,i)=><div key={`${p.name}-${i}`} style={{position:'relative'}}><img src={URL.createObjectURL(p)} alt="inspection" style={{width:'100%',aspectRatio:'1',objectFit:'cover',borderRadius:8}}/><button type="button" className="btn" style={{position:'absolute',top:3,right:3,padding:'1px 7px'}} onClick={()=>setPhotos(x=>x.filter((_,n)=>n!==i))}>×</button></div>)}</div>}</div>
   </div>
   <button type="button" className="btn" disabled={busy||!photos.length} onClick={capture} style={{marginTop:12}}>{busy?'Saving…':'Save inspection & start evaluation'}</button>
  </div>

  {selected&&report&&<div className="panel" style={{marginTop:14}}>
   <div className="row"><h3 style={{margin:0}}>2. AI purchase report</h3><span className="badge">{report.purchase_recommendation||'REVIEW'}</span></div>
   <div className="formgrid" style={{marginTop:12}}>
    <div><strong>Product</strong><div>{report.product_identification||selected.product_name}</div></div>
    <div><strong>Condition</strong><div>{report.condition_grade||'—'} · Quality {report.quality_score_0_100??'—'}/100</div></div>
    <div><strong>Authenticity confidence</strong><div>{report.authenticity_confidence_0_100??'—'}%</div></div>
    <div><strong>Lowest credible online price</strong><div>₹{money(report.lowest_online_price_inr)}</div>{report.lowest_online_price_url&&<a href={report.lowest_online_price_url} target="_blank" rel="noreferrer">Open price source</a>}</div>
    <div><strong>Customer price @ 50% discount</strong><div>₹{money(report.recommended_customer_price_inr)}</div></div>
    <div><strong>Maximum landed cost @ 30% margin</strong><div>₹{money(report.maximum_landed_cost_inr)}</div></div>
    <div><strong>Recommended maximum bid</strong><div>₹{money(report.recommended_max_bid_inr)}</div></div>
    <div><strong>Recommended quantity</strong><div>{report.recommended_quantity||'—'}</div></div>
   </div>
   {Array.isArray(report.visible_defects)&&report.visible_defects.length>0&&<div style={{marginTop:12}}><strong>Visible risks</strong><ul>{report.visible_defects.map((x:any,i:number)=><li key={i}>{String(x)}</li>)}</ul></div>}
   {report.reasoning&&<div style={{marginTop:12}}><strong>AI reasoning</strong><p>{report.reasoning}</p></div>}
   <div className="row" style={{marginTop:14,justifyContent:'flex-start',gap:8,flexWrap:'wrap'}}><button type="button" className="btn" onClick={()=>{setSelected(null);setReport(null)}}>Reject / Archive</button><button type="button" className="btn primary" onClick={()=>{setActualQty(String(report.recommended_quantity||1));setActualPrice(String(report.recommended_max_bid_inr||''));setPromote(null)}}>Purchase this product</button></div>
  </div>}

  {selected&&report&&actualPrice!==''&&<div className="panel" style={{marginTop:14,border:'2px solid #dbeafe'}}>
   <h3 style={{marginTop:0}}>3. Confirm actual purchase</h3>
   <p style={{color:'#64748b'}}>Only actual quantity and actual purchase price are required. Everything else is carried forward automatically.</p>
   <div className="formgrid"><input className="input" type="number" min="1" placeholder="Actual quantity purchased" value={actualQty} onChange={e=>setActualQty(e.target.value)}/><input className="input" type="number" min="0" step="0.01" placeholder="Actual purchase price / unit" value={actualPrice} onChange={e=>setActualPrice(e.target.value)}/></div>
   <h4>Promote this purchase now?</h4><div className="row" style={{justifyContent:'flex-start',gap:8}}><button type="button" className={promote===true?'btn primary':'btn'} onClick={()=>setPromote(true)}>YES — Promote</button><button type="button" className={promote===false?'btn primary':'btn'} onClick={()=>setPromote(false)}>NO — Remind me later</button></div>
   <button type="button" className="btn primary" disabled={busy||promote===null} onClick={confirmPurchase} style={{marginTop:14}}>{busy?'Confirming…':'Confirm purchase & create lot'}</button>
  </div>}

  <div className="panel" style={{marginTop:14}}><div className="row"><h3 style={{margin:0}}>Inspection history</h3><button type="button" className="btn" onClick={load}>Refresh</button></div><div style={{overflowX:'auto',marginTop:10}}><table className="table"><thead><tr><th>Product</th><th>AI</th><th>Quality</th><th>Lowest online</th><th>Max bid</th><th>Status</th><th>Action</th></tr></thead><tbody>{items.map(x=><tr key={x.id}><td>{x.product_name}<br/><small>{x.brand||''} {x.model||''}</small></td><td>{x.ai_status||'pending'}</td><td>{x.ai_quality_score?`${x.ai_quality_score}/100`:'—'}</td><td>{x.lowest_online_price?`₹${money(x.lowest_online_price)}`:'—'}</td><td>{x.recommended_bid_price?`₹${money(x.recommended_bid_price)}`:'—'}</td><td>{x.purchase_status||'pending'}</td><td>{x.ai_status!=='completed'&&<button type="button" className="btn" disabled={busy||!Array.isArray(x.photo_paths)||!x.photo_paths.length} onClick={()=>evaluate(x)}>{busy?'Working…':'🤖 Evaluate'}</button>}{x.ai_status==='completed'&&x.purchase_status==='pending'&&<button type="button" className="btn primary" onClick={()=>{setSelected(x);setReport(x.ai_report||null);setActualPrice('');setPromote(null)}}>Review / Buy</button>}</td></tr>)}</tbody></table></div></div>
 </section>
}
