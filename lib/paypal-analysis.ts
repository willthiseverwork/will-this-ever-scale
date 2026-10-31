import { analyze } from './engine';
import { normalizeTransactions,windows } from './paypal';
import { templateRead } from './read';
import type { Analysis,Inputs } from './types';
export function sandboxAnalysis(raw:any[]|null,invoices:any[]|null,inputs:Inputs={},now=new Date()):Analysis|null{
 const rows=raw?normalizeTransactions(raw):[];const sales=rows.filter(t=>['sale','invoice_payment','subscription_payment'].includes(t.kind)&&t.gross>0&&t.status==='completed');
 let analysis:Analysis;
 if(sales.length){analysis=analyze(rows,inputs);}else{
  const totals=new Map<string,number>();for(const i of invoices||[]){const a=i.due_amount;if(a?.currency_code&&Number(a.value)>0)totals.set(a.currency_code,(totals.get(a.currency_code)||0)+Number(a.value));}
  const currency=[...totals].sort((a,b)=>b[1]-a[1])[0]?.[0];if(!currency)return null;
  const range=windows(now);analysis={currency,excludedCurrencies:Object.fromEntries([...totals].filter(([c])=>c!==currency)),period:{start:range[0][0].slice(0,7),end:now.toISOString().slice(0,7)},months:[],money_map:{came_in:0,paypal_fees:0,refunds:0,costs:0,ad_spend:0,kept:0},buyers:{},item_groups:[],ranked_leaks:[],small_leaks:[],risks:[],gaps:[raw?'No completed sales found in returned transaction records.':'Transaction Search was unavailable; sales are unknown.'],read:''};
 }
 const due=(invoices||[]).filter((i:any)=>['SENT','UNPAID','PARTIALLY_PAID'].includes(i.status)&&i.due_amount?.currency_code===analysis.currency&&Number(i.due_amount?.value)>0&&i.detail?.invoice_date&&now.getTime()-Date.parse(i.detail.invoice_date)>=14*86400000);
 if(due.length){const total=Math.round(due.reduce((n:number,i:any)=>n+Number(i.due_amount.value),0)*100)/100;analysis.quick_win={id:'unpaid_invoices',kind:'quick_win',one_off_amount:total,method:'Sent invoices with outstanding balances, issued at least 14 days ago.',evidence:{invoices:due.length,unpaid_total:total}};}
 if(!sales.length){analysis.read=raw?'No completed sales were found in the returned transaction records.':'Sales are unavailable because Transaction Search could not be read.';if(analysis.quick_win)analysis.read+=` ${new Intl.NumberFormat('en-US',{style:'currency',currency:analysis.currency}).format(analysis.quick_win.one_off_amount||0)} is outstanding across ${analysis.quick_win.evidence.invoices} qualifying sandbox invoices.`;else if(!invoices)analysis.read+=' Invoices could not be checked.';}
 else{analysis.read=templateRead(analysis);if(!invoices)analysis.read=analysis.read.replace('No qualifying unpaid invoice records were supplied.','Unpaid invoices could not be checked.');}
 return analysis;
}
