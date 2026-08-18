import {NextResponse} from 'next/server';
import {supabaseAdmin} from '@/lib/serverSupabase';
import {currentUser} from '@/lib/auth';

export async function POST(req:Request){
  try{
    const u=await currentUser();
    if(!u||u.role!=='admin')return NextResponse.json({error:'Forbidden'},{status:403});
    const form=await req.formData();
    const file=form.get('file');
    const handpickId=String(form.get('handpick_id')||'');
    if(!(file instanceof File)||!handpickId)return NextResponse.json({error:'Photo and handpick_id are required'},{status:400});
    if(!file.type.startsWith('image/'))return NextResponse.json({error:'Only image files are allowed'},{status:400});
    if(file.size>12*1024*1024)return NextResponse.json({error:'Image must be 12 MB or smaller'},{status:400});
    const sb=supabaseAdmin();
    const ext=(file.name.split('.').pop()||'jpg').replace(/[^a-z0-9]/gi,'').toLowerCase()||'jpg';
    const path=`${handpickId}/${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
    const bytes=new Uint8Array(await file.arrayBuffer());
    const {error:up}=await sb.storage.from('handpick-inspections').upload(path,bytes,{contentType:file.type,upsert:false});
    if(up)throw up;
    const {data:item,error:readError}=await sb.from('handpick_items').select('photo_paths').eq('id',handpickId).single();
    if(readError)throw readError;
    const paths=Array.isArray(item?.photo_paths)?item.photo_paths:[];
    paths.push({path,name:file.name,type:file.type,uploaded_by:u.username,uploaded_at:new Date().toISOString()});
    const {data,error}=await sb.from('handpick_items').update({photo_paths:paths}).eq('id',handpickId).select('id,photo_paths').single();
    if(error)throw error;
    return NextResponse.json({data});
  }catch(e:any){return NextResponse.json({error:e.message||'Photo upload failed'},{status:500})}
}
