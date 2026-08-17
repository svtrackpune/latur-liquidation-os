'use client';
import {FormEvent,useState} from 'react';
import {useRouter} from 'next/navigation';

export default function Login(){
 const [pin,setPin]=useState(''); const [error,setError]=useState(''); const router=useRouter();
 async function submit(e:FormEvent){e.preventDefault();setError('');const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pin})});const d=await r.json();if(!r.ok){setError(d.error||'Login failed');return}router.replace('/')}
 return <main style={{margin:0,minHeight:'100vh',display:'grid',placeItems:'center',background:'#f5f7fb'}}><form onSubmit={submit} style={{width:360,background:'#fff',padding:28,borderRadius:14,border:'1px solid #e5e7eb'}}><h1 style={{marginTop:0}}>Latur Liquidation OS</h1><p style={{color:'#64748b'}}>Private business control center</p><input autoFocus className="input" type="password" value={pin} onChange={e=>setPin(e.target.value)} placeholder="Admin PIN"/><button className="btn" style={{width:'100%',marginTop:12}}>Enter</button>{error&&<p className="danger">{error}</p>}</form></main>
}
