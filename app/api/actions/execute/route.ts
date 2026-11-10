import {after,NextResponse} from 'next/server';
import {z} from 'zod';
import {readLimitedJson} from '../../../../lib/request';
import {sameOrigin} from '../../../../lib/paypal-session';
import {hasPaidOrJudgeAccess} from '../../../../lib/access';
import {authorizeAction,actionCredentials,actionSecret,ActionRequestError} from '../../../../lib/action-request';
import {verifyApproval} from '../../../../lib/paypal-actions';
import {advanceAction} from '../../../../lib/paypal-batch';
import {reserveDemoAction} from '../../../../lib/demo-action-cap';
import {runActionJob} from '../../../../lib/action-job';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(r:Request){
 if(!sameOrigin(r))return NextResponse.json({error:'Invalid request origin.'},{status:403});
 try{
  const b=z.object({proposalId:z.string().regex(/^[a-f0-9]{64}$/),approved:z.literal(true),index:z.number().int().min(0).max(19).optional(),async:z.literal(true).optional()}).strict().parse(await readLimitedJson(r,4096));
  const work=async()=>{const {secret,approval,record}=await authorizeAction(r,b.proposalId);if(b.async&&((record.steps.length>0&&(b.index===undefined||b.index>=record.steps.length))||(!record.steps.length&&b.index!==undefined)))throw new ActionRequestError('Invalid action step.',400);if(approval.source==='demo'&&!await hasPaidOrJudgeAccess(r))throw new ActionRequestError('Judges: enter your code to try this in PayPal.',403);if(approval.source==='demo'&&!record.started){const kind=record.proposal.action==='create_payment_link'?'set':record.proposal.action==='send_invoice_reminder'||record.proposal.action==='send_invoice_reminders'?'reminder':null;if(!kind)throw new ActionRequestError('This demo action is unavailable.',403);if(!await reserveDemoAction(b.proposalId,kind))throw new ActionRequestError("The demo shop has used today's PayPal tries. Try again tomorrow.",429);}const c=actionCredentials(approval.source,approval.session);return advanceAction(b.proposalId,b.index,c,secret);};
  if(b.async){
   const secret=actionSecret(),cookie=r.headers.get('cookie')?.match(/(?:^|;\s*)paypal_action_approval=([A-Za-z0-9_.-]+)(?:;|$)/)?.[1];
   if(!cookie||!verifyApproval(cookie,b.proposalId,secret))throw new ActionRequestError('This approval expired. Review it again.',403);
   const job=b.index===undefined?'set':String(b.index);
   after(async()=>{try{await runActionJob(b.proposalId,job,secret,async()=>{try{return await work()}catch(error){throw new Error(error instanceof ActionRequestError?error.message:'The result is unknown. Check PayPal before trying again.')}})}catch{/* A missing receipt stays unknown; never retry a dispatch. */}});
   return NextResponse.json({status:'sending',job},{status:202,headers:{'Cache-Control':'no-store'}});
  }
  return NextResponse.json(await work(),{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof ActionRequestError?error.message:'The result is unknown. Check PayPal before trying again.'},{status:error instanceof ActionRequestError?error.status:503,headers:{'Cache-Control':'no-store'}});}
}
