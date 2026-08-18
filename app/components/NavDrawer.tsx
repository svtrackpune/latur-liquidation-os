'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';

type Item={label:string;href:string};
type Group={title:string;items:Item[]};

export default function NavDrawer({groups,user}:{groups:Group[];user:{username:string;role:string}}){
  const [open,setOpen]=useState(false);

  useEffect(()=>{
    const close=()=>setOpen(false);
    window.addEventListener('resize',close);
    return()=>window.removeEventListener('resize',close);
  },[]);

  return <>
    <button className="menuButton" type="button" aria-label="Open navigation" aria-expanded={open} onClick={()=>setOpen(true)}>
      <span aria-hidden="true">☰</span>
    </button>
    {open&&<button className="drawerBackdrop" aria-label="Close navigation" type="button" onClick={()=>setOpen(false)}/>}
    <aside className={`navDrawer${open?' open':''}`} aria-hidden={!open}>
      <div className="drawerTop">
        <div className="brand">Latur Liquidation OS<span>Business Control Center</span></div>
        <button className="drawerClose" type="button" aria-label="Close navigation" onClick={()=>setOpen(false)}>×</button>
      </div>
      <nav>
        {groups.map(group=><div className="navGroup" key={group.title}>
          <div className="navGroupTitle">{group.title}</div>
          {group.items.map(item=><Link key={item.href} href={item.href} onClick={()=>setOpen(false)}>{item.label}</Link>)}
        </div>)}
      </nav>
      <div className="userBox"><strong>{user.username}</strong><small>{user.role}</small><form action="/api/auth/logout" method="post"><button className="logout">Sign out</button></form></div>
    </aside>
  </>;
}
