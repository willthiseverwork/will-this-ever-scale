/** Local sandbox test orders only. Never called by a deployed route. */
import { createHash,randomUUID } from 'node:crypto';
import { openSync,closeSync,writeFileSync,readFileSync,renameSync,fsyncSync,unlinkSync,existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { token,api } from '../lib/paypal';
import { verifySandboxOrder } from './verify-sandbox-order';
const BUYER='sb-v47s4453103112@personal.example.com';
const items=[{name:'Stud earrings',amount:'18.00'},{name:'Silver hoops',amount:'28.00'},{name:'Stacking rings',amount:'35.00'}] as const;
type Credentials={clientId:string;clientSecret:string};
type Slot={create?:{state:'pending'|'done';id?:string;approvalUrl?:string};capture?:{state:'pending'|'done'}};
type Receipt={version:1;run:string;accountHash:string;slots:Slot[]};
function save(path:string,r:Receipt){const tmp=path+'.tmp',fd=openSync(tmp,'w',0o600);try{writeFileSync(fd,JSON.stringify(r,null,2));fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,path);}
function safeApprovalUrl(links:any):string|undefined{const link=Array.isArray(links)?links.find((x:any)=>['approve','payer-action'].includes(x?.rel)&&x?.method==='GET'):null;try{const u=new URL(link.href);if(u.protocol==='https:'&&u.hostname==='www.sandbox.paypal.com'&&!u.username&&!u.password)return u.toString();}catch{}return;}
export async function sandboxOrderAction(c:Credentials,index:number,action:'create'|'status'|'capture',confirmed:boolean,receiptPath:string,fetcher:typeof fetch=fetch,verify=verifySandboxOrder){
 if(!isAbsolute(receiptPath)||!c.clientId||!c.clientSecret||!Number.isInteger(index)||index<0||index>2||!['create','status','capture'].includes(action))throw new Error('Invalid sandbox request.');
 if(action!=='status'&&!confirmed)throw new Error('Explicit confirmation required.');
 const lock=receiptPath+'.lock',fd=openSync(lock,'wx',0o600);
 try{const accountHash=createHash('sha256').update(c.clientId+'\0'+BUYER).digest('hex');let receipt:Receipt;if(existsSync(receiptPath)){receipt=JSON.parse(readFileSync(receiptPath,'utf8'));if(receipt.version!==1||receipt.accountHash!==accountHash||!receipt.run||!Array.isArray(receipt.slots)||receipt.slots.length!==3)throw new Error('Receipt mismatch.');}else{if(action!=='create')throw new Error('Create the order first.');receipt={version:1,run:randomUUID().replaceAll('-',''),accountHash,slots:[{},{},{}]};save(receiptPath,receipt);}
 const slot=receipt.slots[index];if(action!=='status'&&receipt.slots.some(s=>s.create?.state==='pending'||s.capture?.state==='pending'))throw new Error('An earlier outcome is unknown. Inspect PayPal and reconcile the receipt before any retry.');
 if(action==='create'){
  if(slot.create?.state==='done')return {orderId:slot.create.id,approvalUrl:slot.create.approvalUrl??null,state:'already_created',item:items[index]};
  const access=await token(c,fetcher);slot.create={state:'pending'};save(receiptPath,receipt);
  const reqId=createHash('sha256').update(receipt.run+':create:'+index).digest('hex').slice(0,32);const order=await api(access,'/v2/checkout/orders',fetcher,{method:'POST',headers:{'PayPal-Request-Id':reqId},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{description:items[index].name,amount:{currency_code:'USD',value:items[index].amount}}]})});
  if(typeof order.id!=='string'||!/^[A-Za-z0-9-]{1,64}$/.test(order.id))throw new Error('Order ID missing; inspect PayPal before retrying.');const approvalUrl=safeApprovalUrl(order.links);slot.create={state:'done',id:order.id,...(approvalUrl?{approvalUrl}:{})};save(receiptPath,receipt);return {orderId:order.id,approvalUrl:approvalUrl??null,state:approvalUrl?'awaiting_buyer_approval':'approval_link_unavailable',item:items[index]};
 }
 const id=slot.create?.id;if(!id||slot.create?.state!=='done')throw new Error('Create the order first.');
 if(action==='status')return verify(c,id,undefined,BUYER);
 if(slot.capture?.state==='done')return {orderId:id,state:'capture_request_already_accepted',verification:await verify(c,id,undefined,BUYER)};
 const check=await verify(c,id,undefined,BUYER);if(!('orderStatus' in check)||check.orderStatus!=='APPROVED'||check.buyerMatches!==true||check.orderAmounts.length!==1||check.orderAmounts[0].currency!=='USD'||check.orderAmounts[0].amount===null||Number(check.orderAmounts[0].amount)!==Number(items[index].amount))throw new Error('Capture blocked: buyer approval, buyer identity or amount is not verified.');
 const access=await token(c,fetcher);slot.capture={state:'pending'};save(receiptPath,receipt);const reqId=createHash('sha256').update(receipt.run+':capture:'+index).digest('hex').slice(0,32);await api(access,`/v2/checkout/orders/${encodeURIComponent(id)}/capture`,fetcher,{method:'POST',headers:{'PayPal-Request-Id':reqId},body:'{}'});slot.capture={state:'done'};save(receiptPath,receipt);return {orderId:id,state:'capture_request_accepted',verification:await verify(c,id,undefined,BUYER)};
 }finally{closeSync(fd);unlinkSync(lock);}
}
