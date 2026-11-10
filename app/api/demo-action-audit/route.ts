import {judgeAccess} from '../../../lib/access';
import {reserveSandboxRequest,actionStore} from '../../../lib/action-store';
import {token,api} from '../../../lib/paypal';
import {readAction} from '../../../lib/paypal-batch';
export const runtime='nodejs';
/** Temporary judge-only readback of the exact authorized 10 November sandbox tests. */
export async function GET(request:Request){
 if(!judgeAccess(request))return Response.json({error:'Access required.'},{status:403,headers:{'Cache-Control':'no-store'}});
 try{
  const secret=process.env.PAYPAL_ACTION_SIGNING_SECRET;if(!secret)throw new Error();const store=actionStore(),out:Record<string,unknown>={};
  for(const kind of ['set','reminder'] as const){
   const slot=await store.read(`demo/action-cap/2026-11-10/${kind}/0.json`);if(!slot){out[kind]={status:'not_found'};continue}
   const id=JSON.parse(slot.body).id;if(typeof id!=='string'||!/^[a-f0-9]{64}$/.test(id))throw new Error();const saved=await readAction(id,secret,store);if(!saved||saved.record.source!=='demo')throw new Error();
   const created=saved.record.expires-300000,window=kind==='set'?[Date.parse('2026-11-10T19:01:58Z'),Date.parse('2026-11-10T19:02:30Z')]:[Date.parse('2026-11-10T19:04:28Z'),Date.parse('2026-11-10T19:05:15Z')];if(created<window[0]||created>window[1]){out[kind]={status:'not_our_attempt'};continue}
   if(kind==='reminder'){if(!['send_invoice_reminder','send_invoice_reminders'].includes(saved.record.proposal.action))throw new Error();out[kind]={steps:saved.record.steps.map(({id,status,invoiceStatus})=>({id,status,...(invoiceStatus?{invoiceStatus}:{})}))};continue}
   if(saved.record.proposal.action!=='create_payment_link')throw new Error();const proposal=saved.record.proposal.input,result=saved.record.otherResult as {status?:string}|undefined;const answer:Record<string,unknown>={status:result?.status??(saved.record.otherStarted?'unknown':'not_started')};out[kind]=answer;
   try{
    const credentials={clientId:process.env.PAYPAL_SANDBOX_CLIENT_ID||'',clientSecret:process.env.PAYPAL_SANDBOX_CLIENT_SECRET||''};if(!credentials.clientId||!credentials.clientSecret)throw new Error();if(!await reserveSandboxRequest(request,'read',secret,store)){answer.reconciliation='rate_limited';continue}
    const access=await token(credentials),listing=await api(access,'/v1/checkout/payment-resources?page_size=100');if(!Array.isArray(listing.resources))throw new Error();
    const same=(resource:any)=>Array.isArray(resource.line_items)&&resource.line_items.length===2&&resource.line_items.every((line:any,i:number)=>line.name===[proposal.a,proposal.b][i]&&line.unit_amount?.currency_code===proposal.currency&&Number(line.unit_amount?.value)===Number([proposal.amountA,proposal.amountB][i]));
    const matches=listing.resources.filter((resource:any)=>typeof resource.id==='string'&&/^[A-Za-z0-9-]+$/.test(resource.id)&&Number.isFinite(Date.parse(resource.create_time))&&Math.abs(Date.parse(resource.create_time)-created)<120000&&same(resource));const more=Array.isArray(listing.links)&&listing.links.some((v:any)=>v.rel==='next');answer.matchingResources=matches.length;answer.firstPageComplete=!more;
    if(matches.length===1){const detail=await api(access,`/v1/checkout/payment-resources/${encodeURIComponent(matches[0].id)}`),link=typeof detail.payment_link==='string'?detail.payment_link:detail.links?.find((v:any)=>v.rel==='payment_link')?.href;let sandboxLink=false;try{const u=new URL(link);sandboxLink=u.protocol==='https:'&&u.hostname==='www.sandbox.paypal.com'}catch{}if(detail.id===matches[0].id&&same(detail))answer.verified={id:detail.id,status:detail.status,sandboxLink,topLevelPaymentLink:typeof detail.payment_link==='string'};}
   }catch(error){answer.reconciliation='unavailable';if(typeof (error as {status?:unknown})?.status==='number')answer.code=(error as {status:number}).status;}
  }
  const bucket=Math.floor(Date.now()/900000);out.refreshLocks=await Promise.all(Array.from({length:6},async(_,i)=>({bucket:bucket-4+i,exists:!!await store.read(`demo/refresh-lock/${bucket-4+i}.json`)})));return Response.json(out,{headers:{'Cache-Control':'no-store'}})
 }catch{return Response.json({error:'Receipt unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}})}
}
