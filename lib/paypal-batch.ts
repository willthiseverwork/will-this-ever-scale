import {randomBytes,createHash} from 'node:crypto';
import {ActionConflict,actionStore,openAction,sealAction,type ActionStore} from './action-store';
import {execute,executeReminder,proposalHash,type Proposal} from './paypal-actions';
import type {Credentials} from './paypal-session';
export type ReminderResult={action:'send_invoice_reminder';id:string;requestedId:string;status:'waiting'|'sending'|'confirmed'|'not_confirmed'|'stopped';invoiceStatus?:string;reused?:boolean};
export type VerifiedInvoice={id:string;requestedId:string;title:string;currency:string;amount:number;age_days:number};
export type ActionRecord={version:1;owner:string;source:'demo'|'connected';session:string;expires:number;proposal:Proposal;steps:ReminderResult[];started:boolean;stopped:boolean;invoices?:VerifiedInvoice[];otherResult?:unknown;otherStarted?:boolean};
type ReminderReceipt={result:ReminderResult;sentAt:number};
const DEMO_REMINDER_COOLDOWN_MS=2*60_000;
const pathFor=(id:string)=>{if(!/^[a-f0-9]{64}$/.test(id))throw new Error('Invalid proposal');return `paypal-actions/${id}.json`;};
export async function createAction(owner:string,proposal:Proposal,source:'demo'|'connected',session:string,secret:string,store=actionStore(),invoices?:VerifiedInvoice[]){
 const proposalId=randomBytes(32).toString('hex'),expires=Date.now()+300000;
 const ids=proposal.action==='send_invoice_reminders'?proposal.input.invoiceIds:proposal.action==='send_invoice_reminder'?[proposal.input.invoiceId]:[];
 const record:ActionRecord={version:1,owner,source,session,expires,proposal,steps:ids.map(id=>({action:'send_invoice_reminder',id,requestedId:id,status:'waiting'})),started:false,stopped:false,...(invoices?{invoices}:{})};
 await store.create(pathFor(proposalId),sealAction(record,secret));return {proposalId,expiresAt:new Date(expires).toISOString(),...proposal};
}
export async function readAction(id:string,secret:string,store=actionStore()){const stored=await store.read(pathFor(id));return stored?{...stored,record:openAction<ActionRecord>(stored.body,secret)}:null;}
export function actionView(record:ActionRecord){const steps=record.steps;const pending=steps.some(s=>s.status==='waiting'||s.status==='sending');const status=pending?'pending':record.stopped?'stopped':steps.every(s=>s.status==='confirmed')?'completed':'partial';return {status,steps,nextIndex:record.stopped?null:steps.findIndex(s=>s.status==='waiting')<0?null:steps.findIndex(s=>s.status==='waiting'),stopped:record.stopped};}
export function matchesAction(record:ActionRecord,approval:{owner:string;hash:string;source:string;session:string}){return record.owner===approval.owner&&record.source===approval.source&&record.session===approval.session&&proposalHash(record.proposal)===approval.hash;}
async function updateAction(id:string,secret:string,change:(record:ActionRecord)=>void,store:ActionStore){for(let attempt=0;attempt<5;attempt++){const stored=await readAction(id,secret,store);if(!stored)throw new Error('Proposal unavailable.');change(stored.record);try{await store.replace(pathFor(id),sealAction(stored.record,secret),stored.etag);return stored.record;}catch(error){if(error instanceof ActionConflict)continue;throw error;}}throw new ActionConflict('Another request is updating this action.');}
export async function stopAction(id:string,secret:string,store=actionStore()){return actionView(await updateAction(id,secret,record=>{record.stopped=true;for(const row of record.steps)if(row.status==='waiting')row.status='stopped';},store));}
/** Reserve before sending. A lost response or crashed invocation can never dispatch that row again. */
export async function advanceAction(id:string,index:number|undefined,c:Credentials,secret:string,store=actionStore(),send=executeReminder,now=Date.now()){
 let reserved=false;
 const record=await updateAction(id,secret,r=>{reserved=false;if(r.expires<Date.now()&&!r.started)throw new Error('This approval expired. Review it again.');
  if(!r.steps.length){if(r.otherStarted)return;r.otherStarted=true;r.started=true;reserved=true;return;}
  const next=r.steps.findIndex(s=>s.status==='waiting');if(r.stopped||r.steps.some(s=>s.status==='sending')||next<0)return;if(index!==undefined&&index!==next)return;r.started=true;r.steps[next].status='sending';reserved=true;
 },store);
 if(!reserved)return record.steps.length?actionView(record):record.otherResult||{status:'partial',steps:[],note:'The outcome is unknown. Check PayPal before taking another action.'};
 if(!record.steps.length){let result:unknown;try{result=await execute(record.proposal,c,fetch,id);}catch{result={status:'partial',steps:[],note:'The outcome is unknown. Check PayPal before taking another action.'};}await updateAction(id,secret,r=>{r.otherResult=result;},store);return result;}
 const current=record.steps.findIndex(s=>s.status==='sending');const proposal=record.proposal;if(proposal.action!=='send_invoice_reminder'&&proposal.action!=='send_invoice_reminders')throw new Error('Invalid reminder action');
 let result:ReminderResult;const invoiceId=record.steps[current].requestedId;
 // Connected sellers keep the permanent receipt. Demo receipts reserve a dispatch
 // atomically, then expire after a short cross-session cooldown for fresh judge proof.
 const receiptPath=`paypal-reminder-receipts/${createHash('sha256').update(c.clientId+':'+invoiceId).digest('hex')}${record.source==='demo'?'.demo':''}.json`;
 try{
  let dispatch=false;
  for(let attempt=0;attempt<5;attempt++){
   const previous=await store.read(receiptPath);
   if(record.source==='connected'&&previous){const saved=openAction<ReminderResult>(previous.body,secret);result={...saved,status:saved.status==='confirmed'?'confirmed':'not_confirmed',reused:true};break;}
   if(record.source==='demo'&&previous){const saved=openAction<ReminderReceipt|ReminderResult>(previous.body,secret);if('result' in saved&&now-saved.sentAt<DEMO_REMINDER_COOLDOWN_MS){result={...saved.result,status:saved.result.status==='confirmed'?'confirmed':'not_confirmed',reused:true};break;}}
   const reserved:ReminderReceipt={result:{...record.steps[current],status:'not_confirmed'},sentAt:now};
   try{if(previous)await store.replace(receiptPath,sealAction(reserved,secret),previous.etag);else await store.create(receiptPath,sealAction(record.source==='demo'?reserved:reserved.result,secret));dispatch=true;break;}catch(error){if(error instanceof ActionConflict)continue;throw error;}
  }
  if(dispatch){
   result=await send(c,invoiceId,proposal.input.note!,proposal.input.subject!,`${id}:${current}`,fetch,record.invoices?.[current]);
   const saved=await store.read(receiptPath);if(!saved)throw new Error('Missing reminder receipt');
   await store.replace(receiptPath,sealAction(record.source==='demo'?{result,sentAt:now}:result,secret),saved.etag);
  } else if(!result!){throw new ActionConflict('Reminder receipt is busy.');}
 }catch{result={...record.steps[current],status:'not_confirmed'};}
 return actionView(await updateAction(id,secret,r=>{r.steps[current]=result;},store));
}
