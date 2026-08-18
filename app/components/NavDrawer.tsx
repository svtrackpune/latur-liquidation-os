'use client';

import {useEffect,useState} from 'react';
import Link from 'next/link';

type Item={label:string;href:string};
type Group={title:string;items:Item[]};

export default function NavDrawer({groups,user}:{groups:Group[];user:{username:string;role:string}}){
  const [open,setOpen]=useState(false);
  const [expanded,setExpanded]=useState<string|null>(null);

  useEffect(()=>{
    const close=()=>setOpen(false);
    window.addEventListener('resize',close);
    return()=>window.removeEventListener('resize',close);
  },[]);

  const toggleGroup=(title:string)=>setExpanded(v=>v===title?null:title);

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

      <nav className="drawerNav">
        {groups.map(group=>{
          const isExpanded=expanded===group.title;
          return <section className="navGroup" key={group.title}>
            <button className={`navGroupTitle${isExpanded?' expanded':''}`} type="button" aria-expanded={isExpanded} onClick={()=>toggleGroup(group.title)}>
              <span>{group.title}</span><span className="navChevron" aria-hidden="true">⌄</span>
            </button>
            {isExpanded&&<div className="navGroupItems">
              {group.items.map(item=><Link key={item.href} href={item.href} onClick={()=>setOpen(false)}>{item.label}</Link>)}
            </div>}
          </section>;
        })}
      </nav>

      <div className="userBox">
        <strong>{user.username}</strong>
        <small>{user.role}</small>
        <form action="/api/auth/logout" method="post"><button className="logout">Sign out</button></form>
      </div>
    </aside>
  </>;
}
