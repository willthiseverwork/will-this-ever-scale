import { createHash, randomUUID, timingSafeEqual } from 'node:crypto';
import { actionStore } from '../../../../lib/action-store';
import { token } from '../../../../lib/paypal';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
const base = 'https://api-m.sandbox.paypal.com';
function authorized(request:Request, secret:string|undefined) {
 if (!secret || Buffer.byteLength(secret)<32) return false;
 const supplied=request.headers.get('authorization')||'';
 const expected=Buffer.from('Bearer '+secret), actual=Buffer.from(supplied);
 return actual.length===expected.length && timingSafeEqual(actual,expected);
}
/** One immutable reservation per demo account. Never redispatch after an uncertain outcome. */
export async function POST(request:Request) {
 if (!authorized(request,process.env.WTES_PAYMENT_LINK_PROBE_SECRET)) return Response.json({error:'Not found.'},{status:404,headers});
 const clientId=process.env.PAYPAL_SANDBOX_CLIENT_ID,clientSecret=process.env.PAYPAL_SANDBOX_CLIENT_SECRET;
 if(!clientId||!clientSecret) return Response.json({error:'Sandbox credentials unavailable.'},{status:503,headers});
 let store:ReturnType<typeof actionStore>;
 try { store=actionStore(); } catch { return Response.json({error:'Private probe storage unavailable.'},{status:503,headers}); }
 const accountHash=createHash('sha256').update(clientId).digest('hex');
 const prefix=`paypal-payment-link-probe/${accountHash}`, requestId=randomUUID();
 try { await store.create(`${prefix}/reservation.json`,JSON.stringify({requestId,at:new Date().toISOString()})); }
 catch { return Response.json({error:'Probe already reserved or storage unavailable. Inspect the sandbox before any retry.'},{status:409,headers}); }
 let id:string|undefined;
 try {
  const access=await token({clientId,clientSecret});
  const created=await fetch(base+'/v1/checkout/payment-resources',{method:'POST',headers:{Authorization:`Bearer ${access}`,'Content-Type':'application/json','PayPal-Request-Id':requestId},body:JSON.stringify({integration_mode:'LINK',type:'BUY_NOW',reusable:'MULTIPLE',line_items:[{name:'WTES probe',unit_amount:{currency_code:'GBP',value:'1.00'}}]}),cache:'no-store'});
  if(!created.ok) { await store.create(`${prefix}/create-status.json`,JSON.stringify({status:created.status})); return Response.json({error:'Create not confirmed. Inspect PayPal before any retry.',status:created.status},{status:502,headers}); }
  const body=await created.json();
  if(typeof body.id!=='string'||!/^[A-Za-z0-9-]+$/.test(body.id)) throw new Error('Invalid create response');
  const resourceId:string=body.id; id=resourceId;
  await store.create(`${prefix}/created.json`,JSON.stringify({id,status:created.status,responseFields:Object.keys(body).sort()}));
  const removed=await fetch(base+'/v1/checkout/payment-resources/'+encodeURIComponent(resourceId),{method:'DELETE',headers:{Authorization:`Bearer ${access}`},cache:'no-store'});
  await store.create(`${prefix}/delete-status.json`,JSON.stringify({id,status:removed.status}));
  if(removed.status!==204) return Response.json({error:'Delete not confirmed. Inspect this ID in PayPal.',id,status:removed.status},{status:502,headers});
  return Response.json({id,createStatus:created.status,deleteStatus:removed.status,responseFields:Object.keys(body).sort()},{headers});
 } catch { return Response.json({error:'Probe outcome uncertain. Inspect PayPal before any retry.',...(id?{id}:{})},{status:502,headers}); }
}
