/** Temporary production-only operator endpoint. Remove immediately after the authorized sandbox seed. */
import { createHash,timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readLimitedJson } from '../../../../lib/request';
import { api,token,PayPalError } from '../../../../lib/paypal';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=40;
const RUN='effbfc38e0c4484ebf790f4ad5c3309a';
const BUYER='sb-v47s4453103112@personal.example.com';
const items=[{amount:'18.00',name:'Stud earrings'},{amount:'28.00',name:'Silver hoops'},{amount:'35.00',name:'Stacking rings'}] as const;
const schema=z.object({action:z.enum(['status','create','capture']),slot:z.union([z.literal(0),z.literal(1),z.literal(2)]),orderId:z.string().regex(/^[A-Z0-9]{1,36}$/).optional()}).strict();
const marker=(slot:number)=>`wtes-${RUN}-s${slot}`;
const requestId=(action:string,slot:number)=>createHash('sha256').update(`${RUN}:${action}:${slot}`).digest('hex').slice(0,32);
function reply(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});}
function matches(tokenValue:string,header:string){const expected=Buffer.from(tokenValue);const supplied=Buffer.from(header);return expected.length===supplied.length&&timingSafeEqual(expected,supplied);}
function approval(links:unknown){if(!Array.isArray(links))return undefined;for(const link of links){if(!link||!['approve','payer-action'].includes(link.rel)||link.method!=='GET'||typeof link.href!=='string')continue;try{const u=new URL(link.href);if(u.protocol==='https:'&&u.hostname==='www.sandbox.paypal.com'&&!u.username&&!u.password)return u.toString();}catch{}}return undefined;}
class FixtureError extends Error {constructor(public reason:'id'|'unit'|'currency'|'amount'|'marker'){super('Fixture mismatch');}}
function diagnostic(phase:string,e:unknown){return {phase,...(e instanceof PayPalError?{httpStatus:e.status}:{}),...(e instanceof FixtureError?{reason:e.reason}:{})};}
function inspect(order:any,id:string,slot:0|1|2){const units=order?.purchase_units;if(order?.id!==id)throw new FixtureError('id');if(!Array.isArray(units)||units.length!==1)throw new FixtureError('unit');if(units[0]?.amount?.currency_code!=='USD')throw new FixtureError('currency');if(Number(units[0]?.amount?.value)!==Number(items[slot].amount))throw new FixtureError('amount');if(slot!==0&&units[0]?.custom_id!==marker(slot))throw new FixtureError('marker');const captures=Array.isArray(units[0]?.payments?.captures)?units[0].payments.captures:[];const captureRecords=captures.filter((x:any)=>typeof x?.id==='string'&&/^[A-Z0-9]{1,36}$/.test(x.id)).map((x:any)=>({id:x.id,status:typeof x.status==='string'&&/^[A-Z_]{1,40}$/.test(x.status)?x.status:'UNKNOWN'}));const result:{id:string;status:string;amount:string;currency:string;captures:Array<{id:string;status:string}>;approvalUrl?:string}={id,status:typeof order.status==='string'&&/^[A-Z_]{1,40}$/.test(order.status)?order.status:'UNKNOWN',amount:items[slot].amount,currency:'USD',captures:captureRecords};const link=approval(order.links);if(link)result.approvalUrl=link;return {result,captures,buyer:order?.payment_source?.paypal?.email_address||order?.payer?.email_address};}
export async function POST(request:Request){
 const secret=process.env.WTES_PAYPAL_SEED_TOKEN,expires=process.env.WTES_PAYPAL_SEED_EXPIRES_AT;const expiry=expires?Date.parse(expires):NaN;const now=Date.now();
 if(process.env.VERCEL_ENV!=='production'||!secret||!/^[A-Za-z0-9_-]{32,256}$/.test(secret)||!expires||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(expires)||!Number.isFinite(expiry)||expiry<=now||expiry>now+3600000)return reply({error:'Unavailable.'},404);
 if(new URL(request.url).search)return reply({error:'Invalid request.'},400);const authorization=request.headers.get('authorization')||'';if(!authorization.startsWith('Bearer ')||!matches(secret,authorization.slice(7)))return reply({error:'Unauthorized.'},401);
 let body:z.infer<typeof schema>;try{body=schema.parse(await readLimitedJson(request,2048));}catch{return reply({error:'Invalid request.'},400);}
 if((body.slot===0&&body.orderId!==undefined)||(body.slot!==0&&body.action!=='create'&&!body.orderId)||(body.action==='create'&&(body.slot===0||body.orderId!==undefined)))return reply({error:'Invalid fixture selection.'},400);
 const clientId=process.env.PAYPAL_SANDBOX_CLIENT_ID,clientSecret=process.env.PAYPAL_SANDBOX_CLIENT_SECRET;if(!clientId||!clientSecret)return reply({error:'Sandbox credentials unavailable.'},503);
 let phase='token';
 try{
  const access=await token({clientId,clientSecret});
  if(body.action==='create'){
   try{phase='create';const created=await api(access,'/v2/checkout/orders',fetch,{method:'POST',headers:{'PayPal-Request-Id':requestId('create',body.slot)},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{custom_id:marker(body.slot),description:items[body.slot].name,amount:{currency_code:'USD',value:items[body.slot].amount}}]})});
    const id=created?.id;if(typeof id!=='string'||!/^[A-Z0-9]{1,36}$/.test(id))throw new Error('Missing order ID.');phase='create_readback';const detail=await api(access,`/v2/checkout/orders/${id}`);phase='fixture';const verified=inspect(detail,id,body.slot).result;const link=approval(created.links)||verified.approvalUrl;return reply({...verified,...(link?{approvalUrl:link}:{})});
   }catch(e){return reply({error:'Create outcome is unknown. Inspect the order before any retry.',...diagnostic(phase,e)},502);}
  }
  const id=body.slot===0?'51X40929L3261221T':body.orderId!;phase='order_get';const order=await api(access,`/v2/checkout/orders/${id}?fields=payment_source`);phase='fixture';const checked=inspect(order,id,body.slot);
  if(body.action==='status')return reply(checked.result);
  if(checked.captures.length>0)return reply({error:'Capture already present; inspect status before any further action.'},409);
  if(checked.result.status!=='APPROVED'||typeof checked.buyer!=='string'||checked.buyer.toLowerCase()!==BUYER)return reply({error:'Capture blocked: buyer approval or buyer identity is not verified.'},409);
  try{phase='capture';await api(access,`/v2/checkout/orders/${id}/capture`,fetch,{method:'POST',headers:{'PayPal-Request-Id':requestId('capture',body.slot),Prefer:'return=representation'},body:'{}'});phase='capture_readback';const verified=await api(access,`/v2/checkout/orders/${id}?fields=payment_source`);phase='fixture';return reply(inspect(verified,id,body.slot).result);}catch(e){return reply({error:'Capture outcome is unknown. Inspect the order before any retry.',...diagnostic(phase,e)},502);}
 }catch(e){return reply({error:'Could not verify the selected sandbox order.',...diagnostic(phase,e)},502);}
}
