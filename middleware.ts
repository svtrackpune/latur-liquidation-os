import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(req:NextRequest){
  const path=req.nextUrl.pathname;
  if(path.startsWith('/login') || path.startsWith('/api/auth') || path.startsWith('/_next') || path.includes('.')) return NextResponse.next();
  const expected=process.env.APP_SESSION_SECRET || process.env.APP_ADMIN_PIN;
  const session=req.cookies.get('llo_session')?.value;
  if(expected && session!==expected){
    if(path.startsWith('/api/')) return NextResponse.json({error:'Unauthorized'},{status:401});
    return NextResponse.redirect(new URL('/login',req.url));
  }
  return NextResponse.next();
}

export const config={matcher:['/((?!favicon.ico).*)']};
