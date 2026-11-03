import {randomBytes} from 'node:crypto';
import historyFixture from '../../../../fixtures/hobby-shops/demo-history.json';
import type {Txn} from '../../../../lib/types';
import {paypalLoginCookie} from '../../../../lib/paypal-login';
import { readLimitedJson } from '../../../../lib/request';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession,sessionId,sameOrigin } from '../../../../lib/paypal-session';
import { token,transactions,pages,api,normalizeTransactions } from '../../../../lib/paypal';
import { sandboxAnalysis,sandboxReanalysisRows } from '../../../../lib/paypal-analysis';
import { observeSubscriptions } from '../../../../lib/paypal-subscriptions';
import { toolkitInvoices,toolkitTransactions,sandboxInsightsGap } from '../../../../lib/paypal-toolkit';
import { reserveSandboxRequest } from '../../../../lib/action-store';
import {hasPaidOrJudgeAccess} from '../../../../lib/access';
export const runtime='nodejs';
const schema=z.object({source:z.enum(['demo','connected','login']).optional(),inputs:z.object({costPerItem:z.number().nonnegative().optional(),costsByItem:z.record(z.number().nonnegative()).optional(),fixedFee:z.number().nonnegative().optional(),returningBuyerTargetPercent:z.number().finite().min(0).max(99).optional(),refundReductionPercent:z.number().finite().min(0).max(100).optional(),monthlyAdSpend:z.number().nonnegative().optional(),smallOrderThreshold:z.number().positive().optional(),homeCountry:z.string().optional()}).optional()}).strict();
export async function POST(r:Request){
 if(!sameOrigin(r))return NextResponse.json({error:'Invalid request origin.'},{status:403});
 if(!await hasPaidOrJudgeAccess(r))return NextResponse.json({error:'Start a trial, subscribe, or use judge access to connect a sandbox.'},{status:403});
 try{const {inputs,source='connected'}=schema.parse(await readLimitedJson(r,65536));const c=source==='login'&&!paypalLoginCookie(r)?undefined:source==='demo'||source==='login'?{clientId:process.env.PAYPAL_SANDBOX_CLIENT_ID||'',clientSecret:process.env.PAYPAL_SANDBOX_CLIENT_SECRET||''}:getSession(sessionId(r));if(!c?.clientId||!c.clientSecret)return NextResponse.json({error:source==='demo'?'Demo sandbox is unavailable. Use the sample instead.':'Sandbox session expired. Connect again.'},{status:source==='demo'?503:401});const secret=process.env.PAYPAL_ACTION_SIGNING_SECRET;if(!secret||!await reserveSandboxRequest(r,'read',secret))return NextResponse.json({error:'Too many sandbox requests. Please try again in a minute.'},{status:429});const access=await token(c);let transactionSource='PayPal AI SDK';
 const [txResult,invoiceResult,planResult]=await Promise.allSettled([(async()=>{try{return await toolkitTransactions(c);}catch{transactionSource='PayPal REST fallback';return transactions(access);}})(),(async()=>{try{return await toolkitInvoices(c);}catch{return pages(access,'/v2/invoicing/invoices','items');}})(),pages(access,'/v1/billing/plans','plans')]);
 let invoices:any[]|null=null;let invoiceDetails=0;let invoiceDetailFailures=0;
 if(invoiceResult.status==='fulfilled'){invoices=[];for(const summary of invoiceResult.value){if(!summary.id){invoiceDetailFailures++;continue;}try{const full=await api(access,'/v2/invoicing/invoices/'+encodeURIComponent(summary.id));invoices.push(full);invoiceDetails++;}catch{invoiceDetailFailures++;}}}
 const subscriptions=txResult.status==='fulfilled'?await observeSubscriptions(access,txResult.value):null;
 const planDetails=planResult.status==='fulfilled'?await Promise.allSettled(planResult.value.map((p:any)=>p.id?api(access,'/v1/billing/plans/'+encodeURIComponent(p.id)):Promise.reject(new Error('Missing plan ID')))):[];
 const coverage:any={transactions:txResult.status==='fulfilled'?{returned:txResult.value.length,period:'12 months',source:transactionSource,note:'Transaction Search can lag and event classification is limited.'}:{status:'unavailable',note:'Sales are unknown.'},invoices:invoices?{listed:invoiceResult.status==='fulfilled'?invoiceResult.value.length:0,detailsRetrieved:invoiceDetails,detailsUnavailable:invoiceDetailFailures,note:'Invoices are separate from transaction income.'}:{status:'unavailable'},plans:planResult.status==='fulfilled'?{count:planResult.value.length,detailsRetrieved:planDetails.filter(p=>p.status==='fulfilled').length,detailsUnavailable:planDetails.filter(p=>p.status==='rejected').length}:{status:'unavailable'},subscriptions:subscriptions||{status:'unknown',note:txResult.status==='fulfilled'?'No explicit subscription IDs were found in available transactions; account-wide subscription coverage remains unknown.':'Transaction Search was unavailable, so subscription references and account-wide coverage are unknown.'},insights:sandboxInsightsGap};
 const hasSandboxSales=txResult.status==='fulfilled'&&normalizeTransactions(txResult.value).some(row=>['sale','invoice_payment','subscription_payment'].includes(row.kind)&&row.gross>0&&row.status==='completed');const history=(source==='demo'||source==='login')&&hasSandboxSales?historyFixture as Txn[]:[];const buyerSalt=randomBytes(32);const analysis=sandboxAnalysis(txResult.status==='fulfilled'?txResult.value:null,invoices,inputs,new Date(),history,buyerSalt);if(!analysis)return NextResponse.json({analysis:null,coverage,error:'No completed sales or usable invoice balances were available to analyze.'},{status:422,headers:{'Cache-Control':'no-store'}});
 if(subscriptions){Object.assign(analysis,{subscriptions});analysis.gaps?.push(subscriptions.coverageNote);}else analysis.gaps?.push('Subscription details are unavailable; account-wide coverage is unknown.');
 if(invoiceDetailFailures)analysis.gaps?.push(`${invoiceDetailFailures} invoice details could not be read; invoice results are incomplete.`);
 return NextResponse.json({analysis,coverage,source,reanalysisRows:sandboxReanalysisRows(txResult.status==='fulfilled'?txResult.value:null,invoices,history,buyerSalt)},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Could not retrieve or analyze PayPal sandbox data. Check access and try again.'},{status:502});}
}
