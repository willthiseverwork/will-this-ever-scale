import type {Txn} from './types';
import {sentenceCaseItem} from './display';

export function itemAnswer(rows:Txn[],name:string,currency:string) {
 const sales=rows.filter(row=>(row.item_group||row.item_title)===name&&['sale','invoice_payment','subscription_payment'].includes(row.kind)&&row.gross>0);
 if(!sales.length)return null;
 const gross=sales.reduce((n,row)=>n+row.gross,0),fees=sales.reduce((n,row)=>n+Math.abs(row.fee),0),format=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
 return `${sentenceCaseItem(name)}: ${sales.length} ${sales.length===1?'order':'orders'}, ${format(gross)} in sales, ${format(gross/sales.length)} per order, and about ${Math.round(fees/gross*100)}% goes to PayPal fees. Check whether the price leaves enough room for your other costs.`;
}
