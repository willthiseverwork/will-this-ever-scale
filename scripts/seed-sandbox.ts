/** Explicit sandbox demo seed. A local journal prevents blind retries after uncertain effects. */
import { randomUUID,createHash } from 'node:crypto';
import { openSync,closeSync,writeFileSync,readFileSync,renameSync,fsyncSync,unlinkSync,existsSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';
import { api,token } from '../lib/paypal';
type SeedEnv={PAYPAL_SANDBOX_CLIENT_ID?:string;PAYPAL_SANDBOX_CLIENT_SECRET?:string;PAYPAL_SANDBOX_BUYER_EMAIL?:string};
type Step={state:'pending'|'done';id?:string};
type Receipt={version:1;run:string;accountHash:string;steps:Record<string,Step>;orders:string};
const products=['Stud earrings','Silver hoops','Stacking rings','Necklaces','Jewelry bundle'];
function save(path:string,r:Receipt){const tmp=path+'.tmp';const fd=openSync(tmp,'w',0o600);try{writeFileSync(fd,JSON.stringify(r,null,2));fsyncSync(fd);}finally{closeSync(fd);}renameSync(tmp,path);}
export async function seedSandbox(env:SeedEnv,confirmed:boolean,fetcher:typeof fetch=fetch,receiptPath?:string){
 if(!confirmed)throw new Error('Pass --confirm-create-sandbox-demo after reviewing the target account.');
 const {PAYPAL_SANDBOX_CLIENT_ID:clientId,PAYPAL_SANDBOX_CLIENT_SECRET:clientSecret,PAYPAL_SANDBOX_BUYER_EMAIL:buyer}=env;
 if(!clientId||!clientSecret||!buyer||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(buyer))throw new Error('Provide sandbox credentials and a sandbox personal buyer email.');
 if(!receiptPath||!isAbsolute(receiptPath))throw new Error('Provide an absolute local receipt path.');
 const lock=receiptPath+'.lock';const lockFd=openSync(lock,'wx',0o600);
 try{
  const accountHash=createHash('sha256').update(clientId+'\0'+buyer.toLowerCase()).digest('hex');
  let receipt:Receipt;if(existsSync(receiptPath)){receipt=JSON.parse(readFileSync(receiptPath,'utf8'));if(receipt.version!==1||receipt.accountHash!==accountHash||!receipt.run||!receipt.steps)throw new Error('Receipt does not match this sandbox account and buyer.');}else{receipt={version:1,run:randomUUID().replaceAll('-',''),accountHash,steps:{},orders:'Not created or captured; buyer approval and separate execution are required.'};save(receiptPath,receipt);}
  if(Object.values(receipt.steps).some(x=>x.state==='pending'))throw new Error('Prior step has an unknown outcome. Inspect sandbox and reconcile receipt before any retry.');
  const access=await token({clientId,clientSecret},fetcher);
  async function run(key:string,path:string,body:unknown,needId=true){if(receipt.steps[key]?.state==='done')return receipt.steps[key].id;receipt.steps[key]={state:'pending'};save(receiptPath!,receipt);const result=await api(access,path,fetcher,{method:'POST',headers:{'PayPal-Request-Id':createHash('sha256').update(receipt.run+':'+key).digest('hex').slice(0,32)},body:JSON.stringify(body)});const id=result.id||(result.href||result.links?.find((x:any)=>x.rel==='self')?.href)?.match(/\/invoices\/([^/?]+)$/)?.[1];if(needId&&!id)throw new Error('PayPal response omitted ID. Inspect sandbox before reconciling.');receipt.steps[key]={state:'done',...(id?{id}:{})};save(receiptPath!,receipt);return id as string|undefined;}
  for(let i=0;i<products.length;i++)await run(`product_${i}`,'/v1/catalogs/products',{name:products[i],description:`Sandbox demo: ${products[i]}`,type:'PHYSICAL'});
  for(let i=0;i<3;i++){const id=await run(`invoice_${i}`,'/v2/invoicing/invoices',{detail:{currency_code:'USD',invoice_date:'2026-10-01'},primary_recipients:[{billing_info:{email_address:buyer}}],items:[{name:'Jewelry order',quantity:'1',unit_amount:{currency_code:'USD',value:'180.00'}}]});await run(`send_${i}`,`/v2/invoicing/invoices/${encodeURIComponent(id!)}/send`,{send_to_invoicer:false,send_to_recipient:true},false);}
  return receipt;
 }finally{closeSync(lockFd);unlinkSync(lock);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const i=process.argv.indexOf('--receipt');const receipt=i>=0?process.argv[i+1]:undefined;seedSandbox({PAYPAL_SANDBOX_CLIENT_ID:process.env.PAYPAL_SANDBOX_CLIENT_ID,PAYPAL_SANDBOX_CLIENT_SECRET:process.env.PAYPAL_SANDBOX_CLIENT_SECRET,PAYPAL_SANDBOX_BUYER_EMAIL:process.env.PAYPAL_SANDBOX_BUYER_EMAIL},process.argv.includes('--confirm-create-sandbox-demo'),fetch,receipt).then(r=>{console.log(`Sandbox seed completed; receipt: ${receipt}. Product create responses: 5; invoice send requests accepted: 3; face value: USD 540. Verify invoice status and amounts in PayPal. ${r.orders}`);}).catch(()=>{console.error('Seed failed or outcome is unknown. Inspect sandbox and receipt before any retry.');process.exitCode=1;});}
