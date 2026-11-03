/** Owner-assisted sandbox seed. The buyer must approve each order in PayPal. Never use live credentials. */
import {createHash,randomUUID} from 'node:crypto';
import {closeSync,existsSync,fsyncSync,openSync,readFileSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import {isAbsolute} from 'node:path';
import {pathToFileURL} from 'node:url';
import {api,token} from '../lib/paypal';
type Buyer={email:string;payerId:string};
type Slot={buyer:number;name:string;value:string;pair?:boolean;create?:{state:'pending'|'done';id?:string;approvalUrl?:string};capture?:{state:'pending'|'done'}};
type InvoiceSlot={create?:{state:'pending'|'done';id?:string};send?:{state:'pending'|'done'}};
type Receipt={version:1;run:string;accountHash:string;slots:Slot[];invoices?:InvoiceSlot[]};
const items=[['Stud earrings','5.00'],['Silver hoops','30.00'],['Stacking rings','30.00'],['Necklaces','55.00']] as const;
function save(path:string,r:Receipt){const temporary=path+'.tmp',fd=openSync(temporary,'w',0o600);try{writeFileSync(fd,JSON.stringify(r,null,2));fsyncSync(fd)}finally{closeSync(fd)}renameSync(temporary,path)}
function approvalUrl(links:any){const href=Array.isArray(links)?links.find((x:any)=>['approve','payer-action'].includes(x.rel))?.href:undefined;try{const url=new URL(href);if(url.protocol==='https:'&&url.hostname==='www.sandbox.paypal.com'&&!url.username&&!url.password)return url.toString()}catch{}return undefined}
export async function seedDemoOrders(args:{clientId:string;clientSecret:string;buyers:Buyer[];receiptPath:string;phase:'create'|'capture'|'invoices';confirmed:boolean;fetcher?:typeof fetch}){
 const {clientId,clientSecret,buyers,receiptPath,phase,confirmed,fetcher=fetch}=args;
 if(!confirmed||!clientId||!clientSecret||!isAbsolute(receiptPath)||!Array.isArray(buyers)||buyers.length<5||buyers.some(b=>!b||!/^\S+@\S+$/.test(b.email)||!/^[-A-Za-z0-9]+$/.test(b.payerId)))throw new Error('Require --confirm, sandbox credentials, five or more sandbox buyers and an absolute receipt path.');
 const lock=receiptPath+'.lock',fd=openSync(lock,'wx',0o600);
 try{
  const accountHash=createHash('sha256').update(clientId+'\0'+buyers.map(b=>b.payerId).join('\0')).digest('hex');let receipt:Receipt;
  if(existsSync(receiptPath)){receipt=JSON.parse(readFileSync(receiptPath,'utf8'));if(receipt.version!==1||receipt.accountHash!==accountHash||!receipt.run||receipt.slots?.length!==40)throw new Error('Receipt does not match sandbox account and buyers.');}
  else {if(phase!=='create')throw new Error('Create orders first.');receipt={version:1,run:randomUUID(),accountHash,slots:Array.from({length:40},(_,i)=>({buyer:i%buyers.length,name:i<8?'Silver hoops':items[i%items.length][0],value:i<8?'60.00':items[i%items.length][1],...(i<8?{pair:true}:{})}))};save(receiptPath,receipt)}
  if(receipt.slots.some(s=>s.create?.state==='pending'||s.capture?.state==='pending')||receipt.invoices?.some(s=>s.create?.state==='pending'||s.send?.state==='pending'))throw new Error('A prior write has an unknown outcome. Inspect PayPal and reconcile the receipt before retrying.');
  const access=await token({clientId,clientSecret},fetcher);
  if(phase==='invoices'){
   if(receipt.slots.some(s=>s.capture?.state!=='done'))throw new Error('Capture all approved demo orders before creating invoices.');
   receipt.invoices??=[{},{},{}];save(receiptPath,receipt);
   for(let i=0;i<3;i++){
    const invoice=receipt.invoices[i];
    if(!invoice.create){invoice.create={state:'pending'};save(receiptPath,receipt);const date=new Date();date.setUTCDate(date.getUTCDate()-30);
     const result=await api(access,'/v2/invoicing/invoices',fetcher,{method:'POST',headers:{'PayPal-Request-Id':createHash('sha256').update(`${receipt.run}:invoice:${i}`).digest('hex').slice(0,32)},body:JSON.stringify({detail:{currency_code:'USD',invoice_date:date.toISOString().slice(0,10)},primary_recipients:[{billing_info:{email_address:buyers[i%buyers.length].email}}],items:[{name:'Jewelry order',quantity:'1',unit_amount:{currency_code:'USD',value:'180.00'}}]})});
     const id=result.id||(result.href||result.links?.find((x:any)=>x.rel==='self')?.href)?.match(/\/invoices\/([^/?]+)$/)?.[1];if(typeof id!=='string'||!/^INV2-[A-Za-z0-9-]+$/.test(id))throw new Error('Invoice ID missing. Inspect PayPal before retrying.');invoice.create={state:'done',id};save(receiptPath,receipt);
    }
    if(!invoice.send){invoice.send={state:'pending'};save(receiptPath,receipt);await api(access,`/v2/invoicing/invoices/${encodeURIComponent(invoice.create!.id!)}/send`,fetcher,{method:'POST',headers:{'PayPal-Request-Id':createHash('sha256').update(`${receipt.run}:send:${i}`).digest('hex').slice(0,32)},body:JSON.stringify({send_to_invoicer:false,send_to_recipient:true})});const verified=await api(access,`/v2/invoicing/invoices/${encodeURIComponent(invoice.create!.id!)}`,fetcher);if(verified.id!==invoice.create!.id||!['SENT','UNPAID'].includes(verified.status)||verified.due_amount?.currency_code!=='USD'||Number(verified.due_amount?.value)!==180)throw new Error('Invoice send or balance not confirmed. Inspect PayPal before retrying.');invoice.send={state:'done'};save(receiptPath,receipt)}
   }
   return receipt;
  }
  for(let i=0;i<receipt.slots.length;i++){
   const slot=receipt.slots[i],requestId=createHash('sha256').update(`${receipt.run}:${phase}:${i}`).digest('hex').slice(0,32);
   if(phase==='create'){
    if(slot.create?.state==='done')continue;slot.create={state:'pending'};save(receiptPath,receipt);
    const order=await api(access,'/v2/checkout/orders',fetcher,{method:'POST',headers:{'PayPal-Request-Id':requestId},body:JSON.stringify({intent:'CAPTURE',purchase_units:[{amount:{currency_code:'USD',value:slot.value,breakdown:{item_total:{currency_code:'USD',value:slot.value}}},items:slot.pair?[{name:'Silver hoops',quantity:'1',unit_amount:{currency_code:'USD',value:'30.00'}},{name:'Stacking rings',quantity:'1',unit_amount:{currency_code:'USD',value:'30.00'}}]:[{name:slot.name,quantity:'1',unit_amount:{currency_code:'USD',value:slot.value}}]}]})});
    const link=approvalUrl(order.links);if(typeof order.id!=='string'||!/^[-A-Za-z0-9]+$/.test(order.id)||!link)throw new Error('Create response lacks an ID or safe approval link. Inspect PayPal before retrying.');slot.create={state:'done',id:order.id,approvalUrl:link};save(receiptPath,receipt);
   }else{
    if(slot.capture?.state==='done')continue;const id=slot.create?.id;if(!id||slot.create?.state!=='done')throw new Error('Create all orders first.');
    const order=await api(access,`/v2/checkout/orders/${encodeURIComponent(id)}?fields=payment_source`,fetcher);const payer=order.payer?.payer_id||order.payment_source?.paypal?.account_id;const unit=order.purchase_units?.[0];
    if(order.id!==id||order.status!=='APPROVED'||payer!==buyers[slot.buyer].payerId||order.purchase_units?.length!==1||unit.amount?.currency_code!=='USD'||Number(unit.amount?.value)!==Number(slot.value))throw new Error(`Order ${i+1} is not verified approved by the intended sandbox buyer at the expected amount. Stop and inspect it.`);
    slot.capture={state:'pending'};save(receiptPath,receipt);const captured=await api(access,`/v2/checkout/orders/${encodeURIComponent(id)}/capture`,fetcher,{method:'POST',headers:{'PayPal-Request-Id':requestId},body:'{}'});
    if(captured.id!==id||captured.status!=='COMPLETED'||!captured.purchase_units?.[0]?.payments?.captures?.some((x:any)=>x.status==='COMPLETED'&&x.amount?.currency_code==='USD'&&Number(x.amount.value)===Number(slot.value)))throw new Error(`Capture ${i+1} is unconfirmed. Inspect PayPal before retrying.`);
    slot.capture={state:'done'};save(receiptPath,receipt);
   }
  }
  return receipt;
 }finally{closeSync(fd);unlinkSync(lock)}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const arg=(key:string)=>{const i=process.argv.indexOf(key);return i<0?'':process.argv[i+1]||''};let buyers:Buyer[]=[];try{buyers=JSON.parse(process.env.PAYPAL_SANDBOX_DEMO_BUYERS||'[]')}catch{}const phase=arg('--phase');if(phase!=='create'&&phase!=='capture'&&phase!=='invoices'){console.error('Use --phase create, --phase capture or --phase invoices.');process.exitCode=1}else seedDemoOrders({clientId:process.env.PAYPAL_SANDBOX_CLIENT_ID||'',clientSecret:process.env.PAYPAL_SANDBOX_CLIENT_SECRET||'',buyers,receiptPath:arg('--receipt'),phase,confirmed:process.argv.includes('--confirm')}).then(r=>console.log(`${phase}: ${phase==='invoices'?(r.invoices||[]).filter(x=>x.send?.state==='done').length:r.slots.filter(x=>phase==='create'?x.create?.state==='done':x.capture?.state==='done').length}/${phase==='invoices'?3:40}. See private receipt for approval URLs, buyer indexes and invoice IDs.`)).catch(e=>{console.error(e.message);process.exitCode=1})}
