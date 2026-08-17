import {NextResponse} from 'next/server';
import {loginStaff,makeSession} from '@/lib/auth';
export async function POST(req:Request){
 try{const {username,password}=await req.json();const u=await loginStaff(String(username||''),String(password||''));if(!u)return NextResponse.json({error:'Invalid username or password'},{status:401});
 const res=NextResponse.json({ok:true,user:{username:u.username,role:u.role,displayName:u.displayName}});res.cookies.set('llo_session',makeSession(u.username,u.role),{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:60*60*12});return res;
 }catch(e:any){return NextResponse.json({error:e.message||'Login failed'},{status:500})}
}
