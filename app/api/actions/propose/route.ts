import {readLimitedJson} from '../../../../lib/request';
import {randomBytes} from 'node:crypto';
import {z} from 'zod';
import {NextResponse} from 'next/server';
import {proposalSchema,signedApproval,reminderNote,REMINDER_SUBJECT} from '../../../../lib/paypal-actions';
import {createAction} from '../../../../lib/paypal-batch';
import {reserveSandboxRequest} from '../../../../lib/action-store';
import {sameOrigin,sessionId,getSession} from '../../../../lib/paypal-session';
import {actionCredentials,ActionRequestError} from '../../../../lib/action-request';
import {api,token} from '../../../../lib/paypal';
export const runtime='nodejs';
export async function POST(r:Request){
 if(!sameOrigin(r))return NextResponse.json({error:'Invalid request origin.'},{status:403});
 const secret=process.env.PAYPAL_ACTION_SIGNING_SECRET;if(!secret||Buffer.byteLength(secret)<32)return NextResponse.json({error:'Sandbox action signing is not configured.'},{status:503});
 try{
  const body=z.object({source:z.enum(['connected','demo']),review:z.array(z.object({id:z.string().max(100),currency:z.string().regex(/^[A-Z]{3}$/),amount:z.number().finite().positive()}).strict()).max(20).optional()}).passthrough().parse(await readLimitedJson(r,8192));const source=body.source,session=source==='connected'?sessionId(r)||'':'';
  if(source==='connected'&&!getSession(session))return NextResponse.json({error:'Sandbox session expired. Connect again.'},{status:401});
  const {source:_,review,...action}=body;let p=proposalSchema.parse(action);const requested=p.action==='send_invoice_reminders'?p.input.invoiceIds:p.action==='send_invoice_reminder'?[p.input.invoiceId]:[];
  if(source==='demo'&&(p.action==='send_invoice_reminder'||p.action==='send_invoice_reminders')){
   const mapped=(process.env.PAYPAL_SANDBOX_DEMO_INVOICE_IDS||'').split(',').map(x=>x.trim()).filter(Boolean);
   if(mapped.length!==3||new Set(mapped).size!==3||mapped.some(x=>!/^INV2-[A-Z0-9-]+$/.test(x)))return NextResponse.json({error:'Demo invoice mapping is not configured. The sample invoice IDs are fictional.'},{status:503});
   const resolve=(invoiceId:string)=>{const index=/^INV-([0-2])$/.exec(invoiceId);const id=index?mapped[Number(index[1])]:invoiceId;if(!mapped.includes(id))throw new Error('Invalid demo invoice');return id;};
   p=p.action==='send_invoice_reminder'?{...p,input:{...p.input,invoiceId:resolve(p.input.invoiceId)}}:{...p,input:{...p.input,invoiceIds:p.input.invoiceIds.map(resolve)}};
  }
  if(p.action==='send_invoice_reminder'||p.action==='send_invoice_reminders')p={...p,input:{...p.input,note:reminderNote(source),subject:REMINDER_SUBJECT}};
  if(!await reserveSandboxRequest(r,'proposal',secret))return NextResponse.json({error:'Too many sandbox requests. Please try again in a minute.'},{status:429});
  const invoices=[];
  if(p.action==='send_invoice_reminder'||p.action==='send_invoice_reminders'){
   const ids=p.action==='send_invoice_reminders'?p.input.invoiceIds:[p.input.invoiceId];
   if(!review||review.length!==ids.length||review.some((row,i)=>row.id!==requested[i]))return NextResponse.json({error:'Review the current invoice balances before approving.'},{status:409});
   const access=await token(actionCredentials(source,session));
   for(let i=0;i<ids.length;i++){
    const full=await api(access,'/v2/invoicing/invoices/'+encodeURIComponent(ids[i]));const amount=Number(full.due_amount?.value),currency=full.due_amount?.currency_code,date=full.detail?.invoice_date,age_days=Math.floor((Date.now()-Date.parse(date))/86400000);
    if(full.id!==ids[i]||!['SENT','UNPAID','PARTIALLY_PAID'].includes(full.status)||!Number.isFinite(amount)||amount<=0||!Number.isFinite(age_days)||age_days<(source==='demo'?0:14)||currency!==review[i].currency||Math.abs(amount-review[i].amount)>0.001)return NextResponse.json({error:'PayPal invoice details changed or do not match this read. Read the sandbox again before approving.'},{status:409});
    invoices.push({id:full.id,requestedId:requested[i],title:typeof full.items?.[0]?.name==='string'?full.items[0].name:`Invoice ${full.detail?.invoice_number||full.id}`,currency,amount,age_days});
   }
  }
  const owner=randomBytes(32).toString('hex'),proposal=await createAction(owner,p,source,session,secret,undefined,invoices);
  const res=NextResponse.json({...proposal,source,invoices},{headers:{'Cache-Control':'no-store'}});
  res.cookies.set('paypal_action_approval',signedApproval(proposal.proposalId,owner,p,proposal.expiresAt,secret,source,session),{httpOnly:true,sameSite:'strict',secure:new URL(r.url).protocol==='https:',path:'/api/actions',maxAge:300});return res;
 }catch(error){return NextResponse.json({error:error instanceof z.ZodError?'Invalid action or input.':error instanceof ActionRequestError?error.message:'Sandbox action approval is unavailable. Nothing was sent.'},{status:error instanceof z.ZodError?400:error instanceof ActionRequestError?error.status:503});}
}
