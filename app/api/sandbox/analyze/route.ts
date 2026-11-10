import {createHmac} from 'node:crypto';
import {sandboxQuietContacts} from '../../../../lib/sandbox-quiet-contacts';
import historyFixture from '../../../../fixtures/hobby-shops/demo-history.json';
import type {Txn} from '../../../../lib/types';
import {paypalLoginCookie} from '../../../../lib/paypal-login';
import {readLimitedJson} from '../../../../lib/request';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {getSession,sessionId,sameOrigin} from '../../../../lib/paypal-session';
import {token,transactions,pages,api,normalizeTransactions} from '../../../../lib/paypal';
import {sandboxFailure} from '../../../../lib/sandbox-failure';
import {getDemoRead,recordDemoRead} from '../../../../lib/sandbox-status';
import {optionalSandboxPart,optionalSandboxPartAsync} from '../../../../lib/sandbox-optional';
import {paypalReadFetch} from '../../../../lib/paypal-read-retry';
import {sandboxAnalysis,sandboxReanalysisRows} from '../../../../lib/paypal-analysis';
import {observeSubscriptions} from '../../../../lib/paypal-subscriptions';
import {toolkitInvoices,toolkitTransactions,sandboxInsightsGap} from '../../../../lib/paypal-toolkit';
import {reserveSandboxRequest} from '../../../../lib/action-store';
import {hasPaidOrJudgeAccess} from '../../../../lib/access';
export const runtime='nodejs';
export const maxDuration=60;
export function GET(){return NextResponse.json({deployment:process.env.VERCEL_DEPLOYMENT_ID||process.env.VERCEL_URL||'unknown',lastDemoRead:getDemoRead(),note:'resets when the server instance changes'},{headers:{'Cache-Control':'no-store'}});}
const schema=z.object({source:z.enum(['demo','connected','login']).optional(),inputs:z.object({costPerItem:z.number().nonnegative().optional(),costsByItem:z.record(z.number().nonnegative()).optional(),fixedFee:z.number().nonnegative().optional(),returningBuyerTargetPercent:z.number().finite().min(0).max(99).optional(),refundReductionPercent:z.number().finite().min(0).max(100).optional(),monthlyAdSpend:z.number().nonnegative().optional(),smallOrderThreshold:z.number().positive().optional(),homeCountry:z.string().optional()}).optional()}).strict();
export async function POST(r:Request){
 if(new URL(r.url).pathname==='/api/status')return NextResponse.json({error:'Method not allowed.'},{status:405,headers:{Allow:'GET'}});
 let stage='access',source:'demo'|'connected'|'login'='connected';
 const retryFetch=paypalReadFetch(Date.now());
 const failed=(code:string)=>{if(source==='demo')recordDemoRead({at:new Date().toISOString(),ok:false,stage,code});};
 if(!sameOrigin(r))return NextResponse.json({error:'Invalid request origin.'},{status:403});
 if(!await hasPaidOrJudgeAccess(r))return NextResponse.json({error:'Start a trial, subscribe, or use judge access to connect a sandbox.'},{status:403});
 try{
  stage='parse';const parsed=schema.parse(await readLimitedJson(r,65536));source=parsed.source||'connected';const inputs=parsed.inputs;
  stage='credentials';const c=source==='login'&&!paypalLoginCookie(r)?undefined:source==='demo'||source==='login'?{clientId:process.env.PAYPAL_SANDBOX_CLIENT_ID||'',clientSecret:process.env.PAYPAL_SANDBOX_CLIENT_SECRET||''}:getSession(sessionId(r));
  if(!c?.clientId||!c.clientSecret){failed('credentials_unavailable');return NextResponse.json({error:source==='demo'?'Demo sandbox is unavailable. Use the sample instead.':'Sandbox session expired. Connect again.'},{status:source==='demo'?503:401});}
  stage='limit';const secret=process.env.PAYPAL_ACTION_SIGNING_SECRET;if(!secret||!await reserveSandboxRequest(r,'read',secret)){failed('limit_unavailable');return NextResponse.json({error:'Too many sandbox requests. Please try again in a minute.'},{status:429});}
  stage='token';const access=await token(c,retryFetch);let transactionSource='PayPal AI SDK';
  stage='transactions';const [txResult,invoiceResult,planResult]=await Promise.allSettled([(async()=>{try{return await toolkitTransactions(c);}catch{transactionSource='PayPal REST fallback';return transactions(access,retryFetch);}})(),(async()=>{try{return await toolkitInvoices(c);}catch{return pages(access,'/v2/invoicing/invoices','items',retryFetch);}})(),pages(access,'/v1/billing/plans','plans',retryFetch)]);
  stage='invoices';let invoices:any[]|null=null;let invoiceDetails=0,invoiceDetailFailures=0;
  if(invoiceResult.status==='fulfilled'){invoices=[];for(const summary of invoiceResult.value){if(!summary?.id){invoiceDetailFailures++;continue;}try{const full=await api(access,'/v2/invoicing/invoices/'+encodeURIComponent(summary.id),retryFetch);if(!full||typeof full!=='object'||Array.isArray(full)||full.id!==summary.id||typeof full.status!=='string')throw new Error('Invalid invoice detail');invoices.push(full);invoiceDetails++;}catch{invoiceDetailFailures++;}}}
  stage='subscriptions';let subscriptions:Awaited<ReturnType<typeof observeSubscriptions>>=null,subscriptionFailure=false;
  if(txResult.status==='fulfilled'){const result=await optionalSandboxPartAsync(()=>observeSubscriptions(access,txResult.value,retryFetch));if(result.ok)subscriptions=result.value;else subscriptionFailure=true;}
  stage='plans';const planDetails=planResult.status==='fulfilled'?await Promise.allSettled(planResult.value.map((p:any)=>p?.id?api(access,'/v1/billing/plans/'+encodeURIComponent(p.id),retryFetch):Promise.reject(new Error('Missing plan ID')))):[];
  stage='transactions';const normalized=txResult.status==='fulfilled'?normalizeTransactions(txResult.value):[];
  const coverage:any={transactions:txResult.status==='fulfilled'?{returned:txResult.value.length,skipped:txResult.value.length-normalized.length,period:'12 months',source:transactionSource,note:'Transaction Search can lag and event classification is limited.'}:{status:'unavailable',note:'Sales are unknown.'},invoices:invoices?{listed:invoiceResult.status==='fulfilled'?invoiceResult.value.length:0,detailsRetrieved:invoiceDetails,detailsUnavailable:invoiceDetailFailures,...(invoiceDetailFailures?{status:'partial'}:{}),note:'Invoices are separate from transaction income.'}:{status:'unavailable'},plans:planResult.status==='fulfilled'?{count:planResult.value.length,detailsRetrieved:planDetails.filter(p=>p.status==='fulfilled').length,detailsUnavailable:planDetails.filter(p=>p.status==='rejected').length,...(planDetails.some(p=>p.status==='rejected')?{status:'partial'}:{})}:{status:'unavailable'},subscriptions:subscriptionFailure?{status:'unavailable'}:subscriptions?{...subscriptions,...(subscriptions.failed||subscriptions.notQueried?{status:'partial'}:{})}:{status:'unknown',note:txResult.status==='fulfilled'?'No explicit subscription IDs were found in available transactions; account-wide subscription coverage remains unknown.':'Transaction Search was unavailable, so subscription references and account-wide coverage are unknown.'},insights:sandboxInsightsGap};
  stage='analysis';const hasSandboxSales=normalized.some(row=>['sale','invoice_payment','subscription_payment'].includes(row.kind)&&row.gross>0&&row.status==='completed');if(!hasSandboxSales)coverage.sales={status:'unavailable',note:'No completed PayPal sales were available.'};
  const history=(source==='demo'||source==='login')&&hasSandboxSales?historyFixture as Txn[]:[];const buyerSalt=createHmac('sha256',secret).update('wtes-buyer:'+c.clientId).digest();const analysis=sandboxAnalysis(txResult.status==='fulfilled'?txResult.value:null,invoices,inputs,new Date(),history,buyerSalt);
  if(!analysis){failed('analysis_no_data');return NextResponse.json({analysis:null,coverage,error:'No completed sales or usable invoice balances were available to analyze.'},{status:422,headers:{'Cache-Control':'no-store'}});}
  if(subscriptions){Object.assign(analysis,{subscriptions});analysis.gaps?.push(subscriptions.coverageNote);}else analysis.gaps?.push('Subscription details are unavailable; account-wide coverage is unknown.');
  if(invoiceDetailFailures)analysis.gaps?.push(`${invoiceDetailFailures} invoice details could not be read; invoice results are incomplete.`);
  stage='reanalysis';const rowResult=optionalSandboxPart(()=>sandboxReanalysisRows(txResult.status==='fulfilled'?txResult.value:null,invoices,history,buyerSalt));const reanalysisRows:Txn[]=rowResult.ok?rowResult.value:[];if(!rowResult.ok){coverage.reanalysis={status:'unavailable'};analysis.gaps?.push('Reanalysis rows are unavailable.');}
  stage='quiet_contacts';let quietContacts:ReturnType<typeof sandboxQuietContacts>=[];if(txResult.status==='fulfilled'&&rowResult.ok){const result=optionalSandboxPart(()=>sandboxQuietContacts(txResult.value,history,reanalysisRows,buyerSalt,analysis.currency));if(result.ok)quietContacts=result.value;else{coverage.quiet_contacts={status:'unavailable'};analysis.gaps?.push('Quiet contacts are unavailable.');}}else coverage.quiet_contacts={status:'unavailable'};
  stage='respond';const shopKey=createHmac('sha256',secret).update('wtes-shop:'+c.clientId).digest('hex');const response=NextResponse.json({analysis,coverage,source,reanalysisRows,quietContacts,shopKey},{headers:{'Cache-Control':'no-store'}});if(source==='demo')recordDemoRead({at:new Date().toISOString(),ok:true,orders:analysis.months.reduce((n,m)=>n+(m.orders||0),0)});
  return response;
 }catch(error){const failure=sandboxFailure('sandbox_analyze_failed',stage,error);failed(failure.code);return NextResponse.json({error:'Could not retrieve or analyze PayPal sandbox data. Check access and try again.',...failure},{status:502});}
}
