import type {Leak,Txn} from './types';

const n=(value:number)=>Math.round(value*100)/100;
const sum=(values:number[])=>values.reduce((total,value)=>total+value,0);

const supportedCurrencies=new Set(['GBP','USD','EUR','AUD','CAD','NZD','CHF']);
export function smallOrdersFinding(sales:Txn[],currency:string,months:number):Leak|undefined {
 if(!supportedCurrencies.has(currency))return;
 const small=sales.filter(sale=>sale.gross<10),rest=sales.filter(sale=>sale.gross>=10);
 if(small.length<5||small.length/sales.length<.1)return;
 const rate=(rows:Txn[])=>sum(rows.map(row=>Math.abs(row.fee)))/sum(rows.map(row=>row.gross))*100;
 const byItem=new Map<string,Txn[]>();for(const sale of small){const key=sale.item_group||sale.item_title||'Unlabelled item';byItem.set(key,[...(byItem.get(key)||[]),sale]);}
 const worst=[...byItem.entries()].map(([item,rows])=>({item,rows,rate:rate(rows)})).sort((a,b)=>b.rate-a.rate||a.item.localeCompare(b.item))[0];
 const annual=n(small.length*12/months); if(annual<10)return;
 return {id:'small_order_fees',kind:'monthly',money_per_month:annual,method:'Adding one currency unit to every completed order below 10 units, annualised from this file.',evidence:{card_period:'year',small_orders:small.length,orders:sales.length,months,annual_sales:annual,small_fee_total:n(sum(small.map(row=>Math.abs(row.fee)))),small_fee_rate:n(rate(small)),rest_fee_rate:n(rest.length?rate(rest):0),worst_item:worst?.item||'',worst_fee_rate:n(worst?.rate||0),worst_price:n(worst?.rows[0]?.gross||0),worst_fee:n(Math.abs(worst?.rows[0]?.fee||0))}};
}

export function lapsedBuyersFinding(sales:Txn[]):Leak|undefined {
 const latest=sales.at(-1)?.date;if(!latest)return;const groups=new Map<string,Txn[]>();for(const sale of sales)if(sale.buyer_key)groups.set(sale.buyer_key,[...(groups.get(sale.buyer_key)||[]),sale]);
 const quiet=[...groups.values()].filter(rows=>{if(rows.length<2)return false;const first=Date.parse(rows[0].date),last=Date.parse(rows.at(-1)!.date),usual=(last-first)/(rows.length-1)/86400000,quietDays=(Date.parse(latest)-last)/86400000;return quietDays>Math.max(60,usual*2);}).map(rows=>({orders:rows.length,lastDate:rows.at(-1)!.date,average:sum(rows.map(row=>row.gross))/rows.length,total:sum(rows.map(row=>row.gross)),quietDays:Math.round((Date.parse(latest)-Date.parse(rows.at(-1)!.date))/86400000),lastItem:rows.at(-1)!.item_group||rows.at(-1)!.item_title||'an item'}));
 if(quiet.length<3)return;
 const money=n(sum(quiet.map(row=>row.average))); if(money<10)return;
 return {id:'lapsed_buyers',kind:'monthly',money_per_month:money,method:'One more order from each regular buyer whose usual ordering gap has passed.',evidence:{card_period:'now',quiet_buyers:quiet.length,quiet_total_orders:sum(quiet.map(row=>row.orders)),quiet_spend:n(sum(quiet.map(row=>row.total))),quiet_money:money}};
}
