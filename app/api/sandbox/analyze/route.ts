import { readLimitedJson } from '../../../../lib/request';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession,sessionId,sameOrigin } from '../../../../lib/paypal-session';
import { token,transactions,pages,api } from '../../../../lib/paypal';
import { sandboxAnalysis } from '../../../../lib/paypal-analysis';
import { observeSubscriptions } from '../../../../lib/paypal-subscriptions';
import { toolkitInvoices,toolkitTransactions,sandboxInsightsGap } from '../../../../lib/paypal-toolkit';
export const runtime='nodejs';
const schema=z.object({inputs:z.object({costPerItem:z.number().nonnegative().optional(),costsByItem:z.record(z.number().nonnegative()).optional(),fixedFee:z.number().nonnegative().optional(),returningBuyerTargetPercent:z.number().finite().min(0).max(99).optional(),refundReductionPercent:z.number().finite().min(0).max(100).optional(),monthlyAdSpend:z.number().nonnegative().optional(),smallOrderThreshold:z.number().positive().optional(),homeCountry:z.string().optional()}).optional()}).strict();
export async function POST(r:Request){
 if(!sameOrigin(r))return NextResponse.json({error:'Invalid request origin.'},{status:403});const c=getSession(sessionId(r));if(!c)return NextResponse.json({error:'Sandbox session expired. Connect again.'},{status:401});
 try{const {inputs}=schema.parse(await readLimitedJson(r,65536));const access=await token(c);let transactionSource='PayPal AI SDK';
 const [txResult,invoiceResult,planResult]=await Promise.allSettled([(async()=>{try{return await toolkitTransactions(c);}catch{transactionSource='PayPal REST fallback';return transactions(access);}})(),(async()=>{try{return await toolkitInvoices(c);}catch{return pages(access,'/v2/invoicing/invoices','items');}})(),pages(access,'/v1/billing/plans','plans')]);
 let invoices:any[]|null=null;let invoiceDetails=0;let invoiceDetailFailures=0;
 if(invoiceResult.status==='fulfilled'){invoices=[];for(const summary of invoiceResult.value){if(!summary.id){invoiceDetailFailures++;continue;}try{const full=await api(access,'/v2/invoicing/invoices/'+encodeURIComponent(summary.id));invoices.push(full);invoiceDetails++;}catch{invoiceDetailFailures++;}}}
 const subscriptions=txResult.status==='fulfilled'?await observeSubscriptions(access,txResult.value):null;
 const planDetails=planResult.status==='fulfilled'?await Promise.allSettled(planResult.value.map((p:any)=>p.id?api(access,'/v1/billing/plans/'+encodeURIComponent(p.id)):Promise.reject(new Error('Missing plan ID')))):[];
 const coverage:any={transactions:txResult.status==='fulfilled'?{returned:txResult.value.length,period:'12 months',source:transactionSource,note:'Transaction Search can lag and event classification is limited.'}:{status:'unavailable',note:'Sales are unknown.'},invoices:invoices?{listed:invoiceResult.status==='fulfilled'?invoiceResult.value.length:0,detailsRetrieved:invoiceDetails,detailsUnavailable:invoiceDetailFailures,note:'Invoices are separate from transaction income.'}:{status:'unavailable'},plans:planResult.status==='fulfilled'?{count:planResult.value.length,detailsRetrieved:planDetails.filter(p=>p.status==='fulfilled').length,detailsUnavailable:planDetails.filter(p=>p.status==='rejected').length}:{status:'unavailable'},subscriptions:subscriptions||{status:'unknown',note:txResult.status==='fulfilled'?'No explicit subscription IDs were found in available transactions; account-wide subscription coverage remains unknown.':'Transaction Search was unavailable, so subscription references and account-wide coverage are unknown.'},insights:sandboxInsightsGap};
 const analysis=sandboxAnalysis(txResult.status==='fulfilled'?txResult.value:null,invoices,inputs);if(!analysis)return NextResponse.json({analysis:null,coverage,error:'No completed sales or usable invoice balances were available to analyze.'},{status:422,headers:{'Cache-Control':'no-store'}});
 if(subscriptions){Object.assign(analysis,{subscriptions});analysis.gaps?.push(subscriptions.coverageNote);}else analysis.gaps?.push('Subscription details are unavailable; account-wide coverage is unknown.');
 if(invoiceDetailFailures)analysis.gaps?.push(`${invoiceDetailFailures} invoice details could not be read; invoice results are incomplete.`);
 return NextResponse.json({analysis,coverage},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Could not retrieve or analyze PayPal sandbox data. Check access and try again.'},{status:502});}
}
