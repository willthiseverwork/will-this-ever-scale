import { analyze } from './engine';
import { normalizeTransactions,windows } from './paypal';
import { templateRead } from './read';
import type { Analysis,Inputs,Txn } from './types';
import { cardFor } from './fix-cards';
import {createHmac,randomBytes} from 'node:crypto';
import {joinDemoHistory} from './demo-history';
/** Explicit browser allowlist; future normalizer fields cannot expand this response. */
export function projectSandboxReanalysisRow(row:Txn,pseudonymize:(id:string)=>string):Txn{
 const result:Txn={id:pseudonymize(row.id),date:row.date,kind:row.kind,gross:row.gross,fee:row.fee,net:row.net,currency:row.currency};
 if(typeof row.buyer_key==='string'&&/^[a-f0-9]{64}$/.test(row.buyer_key))result.buyer_key=row.buyer_key;
 if(typeof row.reference_id==='string'&&row.reference_id)result.reference_id=pseudonymize(row.reference_id);
 if(typeof row.item_title==='string')result.item_title=row.item_title;
 if(typeof row.item_group==='string')result.item_group=row.item_group;
 if(typeof row.country==='string'&&/^[A-Za-z]{2}$/.test(row.country))result.country=row.country;
 if(typeof row.invoice_id==='string'&&/^[A-Za-z0-9-]{1,100}$/.test(row.invoice_id))result.invoice_id=row.invoice_id;
 if(typeof row.quantity==='number'&&Number.isFinite(row.quantity)&&row.quantity>0)result.quantity=row.quantity;
 if(typeof row.quantity_known==='boolean')result.quantity_known=row.quantity_known;
 if(typeof row.fee_known==='boolean')result.fee_known=row.fee_known;
 if(typeof row.hold_confirmed==='boolean')result.hold_confirmed=row.hold_confirmed;
 if(typeof row.tracking_present==='boolean')result.tracking_present=row.tracking_present;
 if(typeof row.status==='string'&&['completed','pending','unpaid','sent','paid','cancelled','denied','unknown','S','P','D','V'].includes(row.status))result.status=row.status;
 if(Array.isArray(row.cart_items))result.cart_items=row.cart_items.filter(item=>typeof item.name==='string'&&Number.isFinite(item.quantity)&&item.quantity>0&&Number.isFinite(item.unit_price)&&item.unit_price>=0).map(item=>({name:item.name,quantity:item.quantity,unit_price:item.unit_price}));
 return result;
}
/** Ephemeral browser reanalysis only: normalized fields, never full provider objects or credentials. */
export function sandboxReanalysisRows(raw:any[]|null,invoices:any[]|null,history:Txn[]=[],buyerSalt?:Buffer):Txn[]{
 const salt=buyerSalt||randomBytes(32),pseudonymize=(id:string)=>'t_'+createHmac('sha256',salt).update(id).digest('hex');
 const rows=raw?joinDemoHistory(normalizeTransactions(raw,buyerSalt),history).map(row=>projectSandboxReanalysisRow(row,pseudonymize)):[];
 for(const invoice of invoices||[]){
  const id=invoice.id,date=invoice.detail?.invoice_date,status=invoice.status,amount=Number(invoice.due_amount?.value),currency=invoice.due_amount?.currency_code;
  if(typeof id!=='string'||!/^[A-Za-z0-9-]{1,100}$/.test(id)||typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(date)||!Number.isFinite(Date.parse(date))||!['SENT','UNPAID','PARTIALLY_PAID','PAID'].includes(status)||!Number.isFinite(amount)||amount<0||typeof currency!=='string'||!/^[A-Z]{3}$/.test(currency))continue;
  rows.push({id:'invoice-observation-'+id,invoice_id:id,date,kind:'other',gross:amount,fee:0,net:amount,currency,status:status==='PARTIALLY_PAID'?'unpaid':status.toLowerCase(),item_title:typeof invoice.items?.[0]?.name==='string'?invoice.items[0].name:`Invoice ${invoice.detail?.invoice_number||id}`});
 }
 return rows;
}
export function sandboxAnalysis(raw:any[]|null,invoices:any[]|null,inputs:Inputs={},now=new Date(),history:Txn[]=[],buyerSalt?:Buffer):Analysis|null{
 const rows=raw?joinDemoHistory(normalizeTransactions(raw,buyerSalt),history):[];const sales=rows.filter(t=>['sale','invoice_payment','subscription_payment'].includes(t.kind)&&t.gross>0&&t.status==='completed');
 let analysis:Analysis;
 if(sales.length){analysis=analyze(rows,{...inputs,asOf:now.toISOString()});}else{
  const totals=new Map<string,number>();for(const i of invoices||[]){const a=i.due_amount;if(a?.currency_code&&Number(a.value)>0)totals.set(a.currency_code,(totals.get(a.currency_code)||0)+Number(a.value));}
  const currency=[...totals].sort((a,b)=>b[1]-a[1])[0]?.[0];if(!currency)return null;
  const range=windows(now);analysis={as_of:now.toISOString(),currency,excludedCurrencies:Object.fromEntries([...totals].filter(([c])=>c!==currency)),period:{start:range[0][0].slice(0,7),end:now.toISOString().slice(0,7)},months:[],money_map:{came_in:0,paypal_fees:0,refunds:0,costs:0,ad_spend:0,kept:0},buyers:{},item_groups:[],ranked_leaks:[],small_leaks:[],risks:[],gaps:[raw?'No completed sales found in returned transaction records.':'Transaction Search was unavailable; sales are unknown.'],read:''};
 }
 if(invoices){
  const due=invoices.filter((i:any)=>['SENT','UNPAID','PARTIALLY_PAID'].includes(i.status)&&i.due_amount?.currency_code===analysis.currency&&Number.isFinite(Number(i.due_amount?.value))&&Number(i.due_amount?.value)>0&&typeof i.detail?.invoice_date==='string'&&/^\d{4}-\d{2}-\d{2}(?:$|T)/.test(i.detail.invoice_date)&&Number.isFinite(Date.parse(i.detail.invoice_date))&&now.getTime()-Date.parse(i.detail.invoice_date)>=14*86400000);
  analysis.invoice_records=due.map((i:any)=>({id:typeof i.id==='string'&&/^[A-Za-z0-9-]{1,100}$/.test(i.id)?i.id:'',title:typeof i.items?.[0]?.name==='string'?i.items[0].name:`Invoice ${i.detail?.invoice_number||i.id||''}`,date:String(i.detail.invoice_date).slice(0,10),status:String(i.status).toLowerCase(),currency:analysis.currency,amount:Math.round(Number(i.due_amount.value)*100)/100,age_days:Math.floor((now.getTime()-Date.parse(i.detail.invoice_date))/86400000)}));
  const total=Math.round(analysis.invoice_records.reduce((n,r)=>n+r.amount,0)*100)/100;const invoiceQuick=due.length?{id:'unpaid_invoices',kind:'quick_win' as const,one_off_amount:total,method:'Sent invoices with outstanding balances, issued at least 14 days ago.',evidence:{invoices:analysis.invoice_records.length,unpaid_total:total}}:undefined;
  if(invoiceQuick){const card=cardFor(invoiceQuick,analysis.currency);if(card)Object.assign(invoiceQuick,{card});}
  if(analysis.quick_win?.id!=='held_money'||total>(analysis.quick_win.one_off_amount||0))analysis.quick_win=invoiceQuick;
  analysis.cards=[...(analysis.cards||[]).filter(c=>c.id!=='unpaid_invoices'),...(invoiceQuick&&'card' in invoiceQuick?[invoiceQuick.card as NonNullable<Analysis['cards']>[number]]:[])];
  analysis.action_findings=[...(analysis.action_findings||[]).filter(l=>l.id!=='unpaid_invoices'),...(invoiceQuick?[invoiceQuick]:[])];
 }

 if(!sales.length){analysis.read=raw?'No completed sales were found in the returned transaction records.':'Sales are unavailable because Transaction Search could not be read.';if(analysis.quick_win)analysis.read+=` ${new Intl.NumberFormat('en-US',{style:'currency',currency:analysis.currency}).format(analysis.quick_win.one_off_amount||0)} is outstanding across ${analysis.quick_win.evidence.invoices} qualifying sandbox invoices.`;else if(!invoices)analysis.read+=' Invoices could not be checked.';}
 else{analysis.read=templateRead(analysis);if(!invoices)analysis.read=analysis.read.replace('No qualifying unpaid invoice records were supplied.','Unpaid invoices could not be checked.');}
 analysis.clock_basis='seller';
 return analysis;
}
