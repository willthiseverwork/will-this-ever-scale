import {readLimitedJson} from '../../../../lib/request';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {token} from '../../../../lib/paypal';
import {sandboxFailure} from '../../../../lib/sandbox-failure';
import {newSession,removeSession,sessionId,sameOrigin} from '../../../../lib/paypal-session';
import {reserveSandboxRequest} from '../../../../lib/action-store';
import {hasPaidOrJudgeAccess} from '../../../../lib/access';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(r:Request){
 let stage='access';
 if(!sameOrigin(r))return NextResponse.json({error:'Invalid request origin.'},{status:403});
 if(!await hasPaidOrJudgeAccess(r))return NextResponse.json({error:'Start a trial, subscribe, or use judge access to connect a sandbox.'},{status:403});
 try{
  stage='parse';const c=z.object({clientId:z.string().min(1).max(500),clientSecret:z.string().min(1).max(500)}).strict().parse(await readLimitedJson(r,4096));
  stage='limit';const secret=process.env.PAYPAL_ACTION_SIGNING_SECRET;if(!secret||!await reserveSandboxRequest(r,'connect',secret))return NextResponse.json({error:'Sandbox connection is temporarily unavailable. Try again in a minute.'},{status:429});
  stage='token';await token(c);stage='session';const id=newSession(c);
  // Invoke the read inside this invocation. Own keys remain only in server memory;
  // the initial read does not depend on Vercel routing a second request here.
  stage='analysis';const {POST:readSandbox}=await import('../analyze/route');const url=new URL('/api/sandbox/analyze',r.url);
  const snapshot=await readSandbox(new Request(url,{method:'POST',headers:{origin:url.origin,cookie:[...(r.headers.get('cookie')||'').split(';').map(x=>x.trim()).filter(x=>x&&!x.startsWith('paypal_session=')),`paypal_session=${id}`].join('; '),'content-type':'application/json',...(r.headers.get('x-vercel-forwarded-for')?{'x-vercel-forwarded-for':r.headers.get('x-vercel-forwarded-for')!}:{})},body:JSON.stringify({source:'connected'})}));
  stage='respond';const data=await snapshot.json();const res=NextResponse.json({...data,connected:true,environment:'sandbox',source:'connected'},{headers:{'Cache-Control':'no-store'}});
  res.cookies.set('paypal_session',id,{httpOnly:true,sameSite:'strict',secure:new URL(r.url).protocol==='https:',path:'/',maxAge:1800});return res;
 }catch(error){const failure=sandboxFailure('sandbox_connect_failed',stage,error);return NextResponse.json({error:'Could not connect to PayPal sandbox. Check credentials and permissions.',...failure},{status:502});}
}
export async function DELETE(r:Request){if(!sameOrigin(r))return NextResponse.json({error:'Invalid request origin.'},{status:403});removeSession(sessionId(r));const res=NextResponse.json({connected:false});res.cookies.set('paypal_session','',{httpOnly:true,sameSite:'strict',path:'/',maxAge:0});return res;}
