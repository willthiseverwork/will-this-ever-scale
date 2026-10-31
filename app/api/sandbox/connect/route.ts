import { readLimitedJson } from '../../../../lib/request';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { token } from '../../../../lib/paypal';
import { newSession,removeSession,sessionId,sameOrigin } from '../../../../lib/paypal-session';
export const runtime='nodejs';
export async function POST(r:Request){if(!sameOrigin(r))return NextResponse.json({error:'Invalid request origin.'},{status:403});try{const c=z.object({clientId:z.string().min(1).max(500),clientSecret:z.string().min(1).max(500)}).strict().parse(await readLimitedJson(r,4096));await token(c);const id=newSession(c);const res=NextResponse.json({connected:true,environment:'sandbox'});res.cookies.set('paypal_session',id,{httpOnly:true,sameSite:'strict',secure:new URL(r.url).protocol==='https:',path:'/',maxAge:1800});res.headers.set('Cache-Control','no-store');return res;}catch{return NextResponse.json({error:'Could not connect to PayPal sandbox. Check credentials and permissions.'},{status:400});}}
export async function DELETE(r:Request){if(!sameOrigin(r))return NextResponse.json({error:'Invalid request origin.'},{status:403});removeSession(sessionId(r));const res=NextResponse.json({connected:false});res.cookies.set('paypal_session','',{httpOnly:true,sameSite:'strict',path:'/',maxAge:0});return res;}
