import {NextResponse} from 'next/server';
import {supabaseAdmin} from '@/lib/serverSupabase';

const TABLES=new Set(['suppliers','rfqs','quotes','lots','products','customers','conversations','messages','sales','sale_items','campaigns','expenses','tasks','towns','categories','business_settings','supplier_visits','rfq_suppliers']);

export async function GET(req:Request){
 try{const table=new URL(req.url).searchParams.get('table')||'';if(!TABLES.has(table))return NextResponse.json({error:'Invalid table'},{status:400});const sb=supabaseAdmin();const {data,error}=await sb.from(table).select('*').order('created_at',{ascending:false}).limit(200);if(error)throw error;return NextResponse.json({data:data||[]});}
 catch(e:any){return NextResponse.json({error:e.message||'Database error'},{status:500})}
}

export async function POST(req:Request){
 try{const {table,row}=await req.json();if(!TABLES.has(table))return NextResponse.json({error:'Invalid table'},{status:400});if(!row||typeof row!=='object')return NextResponse.json({error:'Invalid row'},{status:400});const sb=supabaseAdmin();const {data,error}=await sb.from(table).insert(row).select().single();if(error)throw error;return NextResponse.json({data});}
 catch(e:any){return NextResponse.json({error:e.message||'Database error'},{status:500})}
}

export async function PATCH(req:Request){
 try{const {table,id,row}=await req.json();if(!TABLES.has(table)||!id)return NextResponse.json({error:'Invalid request'},{status:400});const sb=supabaseAdmin();const {data,error}=await sb.from(table).update(row).eq('id',id).select().single();if(error)throw error;return NextResponse.json({data});}
 catch(e:any){return NextResponse.json({error:e.message||'Database error'},{status:500})}
}

export async function DELETE(req:Request){
 try{const {table,id}=await req.json();if(!TABLES.has(table)||!id)return NextResponse.json({error:'Invalid request'},{status:400});const sb=supabaseAdmin();const {error}=await sb.from(table).delete().eq('id',id);if(error)throw error;return NextResponse.json({ok:true});}
 catch(e:any){return NextResponse.json({error:e.message||'Database error'},{status:500})}
}
