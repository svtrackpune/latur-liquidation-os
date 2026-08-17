import { NextResponse } from 'next/server';

export async function POST(req:Request){
  const {pin}=await req.json().catch(()=>({pin:''}));
  const expected=process.env.APP_ADMIN_PIN;
  if(!expected) return NextResponse.json({error:'APP_ADMIN_PIN is not configured.'},{status:500});
  if(String(pin)!==expected) return NextResponse.json({error:'Invalid PIN'},{status:401});
  const res=NextResponse.json({ok:true});
  res.cookies.set('llo_session',process.env.APP_SESSION_SECRET || expected,{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*12});
  return res;
}
