import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/serverSupabase';

export type Role='admin'|'manager'|'procurement'|'warehouse'|'sales'|'accounts';
const ROLE_PERMISSIONS:Record<Role,string[]>={
 admin:['*'], manager:['dashboard','suppliers','rfqs','purchases','inventory','customers','sales','marketing','accounting','ai'], procurement:['dashboard','suppliers','rfqs','purchases','inventory'], warehouse:['dashboard','inventory','purchases'], sales:['dashboard','inventory','customers','sales','marketing'], accounts:['dashboard','sales','accounting']
};
function secret(){return process.env.APP_SESSION_SECRET||process.env.APP_ADMIN_PIN||'change-me';}
function sign(payload:string){return crypto.createHmac('sha256',secret()).update(payload).digest('base64url');}
export function makeSession(username:string,role:Role){const p=Buffer.from(JSON.stringify({u:username,r:role,exp:Date.now()+12*60*60*1000})).toString('base64url');return `${p}.${sign(p)}`;}
export function readSession(token?:string){try{if(!token)return null;const [p,s]=token.split('.');if(!p||!s||sign(p)!==s)return null;const x=JSON.parse(Buffer.from(p,'base64url').toString());if(!x.exp||x.exp<Date.now())return null;return {username:String(x.u),role:x.r as Role};}catch{return null;}}
export function can(role:Role,section:string){return ROLE_PERMISSIONS[role]?.includes('*')||ROLE_PERMISSIONS[role]?.includes(section);}
export async function currentUser(){const c=await cookies();return readSession(c.get('llo_session')?.value);}
export async function requireUser(section?:string){const u=await currentUser();if(!u)throw new Error('UNAUTHORIZED');if(section&&!can(u.role,section))throw new Error('FORBIDDEN');return u;}
export function hashPassword(password:string){const salt=crypto.randomBytes(16).toString('hex');const hash=crypto.scryptSync(password,salt,64).toString('hex');return `scrypt:${salt}:${hash}`;}
export function verifyPassword(password:string,stored:string){try{const [kind,salt,hex]=stored.split(':');if(kind!=='scrypt')return false;const a=crypto.scryptSync(password,salt,64);const b=Buffer.from(hex,'hex');return a.length===b.length&&crypto.timingSafeEqual(a,b);}catch{return false;}}
export async function loginStaff(username:string,password:string){
 const sb=supabaseAdmin();
 const {data}=await sb.from('staff_users').select('username,display_name,password_hash,role,active,permissions').eq('username',username).maybeSingle();
 if(data?.active&&verifyPassword(password,data.password_hash))return {username:data.username,role:data.role as Role,displayName:data.display_name,permissions:data.permissions||{}};
 const adminUser=process.env.APP_ADMIN_USER||'admin';
 const adminPassword=process.env.APP_ADMIN_PASSWORD;
 if(username===adminUser&&adminPassword&&crypto.timingSafeEqual(Buffer.from(password),Buffer.from(adminPassword)))return {username:adminUser,role:'admin' as Role,displayName:'Administrator',permissions:{}};
 return null;
}
