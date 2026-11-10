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
 const quiet=[...groups.values()].filter(rows=>{if(rows.length<3)return false;const first=Date.parse(rows[0].date),last=Date.parse(rows.at(-1)!.date),usual=(last-first)/(rows.length-1)/86400000,quietDays=(Date.parse(latest)-last)/86400000;return quietDays>Math.max(60,usual*2);}).map(rows=>({orders:rows.length,lastDate:rows.at(-1)!.date,average:sum(rows.map(row=>row.gross))/rows.length,total:sum(rows.map(row=>row.gross)),quietDays:Math.round((Date.parse(latest)-Date.parse(rows.at(-1)!.date))/86400000),lastItem:rows.at(-1)!.item_group||rows.at(-1)!.item_title||'an item'}));
 if(quiet.length<3)return;
 const money=n(sum(quiet.map(row=>row.average))); if(money<10)return;
 return {id:'lapsed_buyers',kind:'monthly',money_per_month:money,method:'One more order from each regular buyer whose usual ordering gap has passed.',evidence:{card_period:'now',quiet_buyers:quiet.length,quiet_total_orders:sum(quiet.map(row=>row.orders)),quiet_spend:n(sum(quiet.map(row=>row.total))),quiet_money:money}};
}

export function abroadFeesFinding(sales:Txn[],currency:string,months:number,homeCountry?:string):Leak|undefined {
 if(!supportedCurrencies.has(currency))return;
 const known=sales.filter(row=>!!row.country); if(!known.length)return;
 const counts=new Map<string,number>();for(const row of known){const code=row.country!.trim().toUpperCase();counts.set(code,(counts.get(code)||0)+1);}
 const home=homeCountry?.trim().toUpperCase()||[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0];if(!home)return;
 const abroad=known.filter(row=>row.country!.trim().toUpperCase()!==home), domestic=known.filter(row=>row.country!.trim().toUpperCase()===home);if(!abroad.length||!domestic.length)return;
 const gross=(rows:Txn[])=>sum(rows.map(row=>row.gross)), fees=(rows:Txn[])=>sum(rows.map(row=>Math.abs(row.fee))), homeRate=fees(domestic)/gross(domestic), extra=n((fees(abroad)-gross(abroad)*homeRate)*12/months);if(extra<20)return;
 return {id:'cross_border_fees',kind:'monthly',money_per_month:extra,method:'Observed fees on sales outside the main country, less the observed home-country fee rate, annualised from this file.',evidence:{card_period:'year',home_country:home,abroad_orders:abroad.length,abroad_fees:n(fees(abroad)),abroad_gross:n(gross(abroad)),home_fee_rate:n(homeRate*100),months,extra_fees:extra}};
}

const day=86400000;
const item=(row:Txn)=>row.item_group||row.item_title||'Unlabelled item';
export function stoppedItemsFinding(sales:Txn[],months:number):Leak|undefined {
 if(months<8||sales.length<100)return;const last=Date.parse(sales.at(-1)!.date),cutoff=last-120*day,groups=new Map<string,Txn[]>();for(const row of sales)groups.set(item(row),[...(groups.get(item(row))||[]),row]);
 const matches=[...groups.entries()].map(([name,rows])=>{const before=rows.filter(row=>Date.parse(row.date)<cutoff),recent=rows.filter(row=>Date.parse(row.date)>=cutoff),first=Date.parse(rows[0].date),lastSale=Date.parse(rows.at(-1)!.date),span=Math.max(1,Math.ceil((lastSale-first)/30/day)+1),gross=sum(before.map(row=>row.gross));return {name,before,recent,gross,span,annual:n(gross/span*12),monthsAgo:Math.floor((last-lastSale)/30/day)};}).filter(x=>x.before.length>=3&&x.gross>=50&&!x.recent.length).sort((a,b)=>b.annual-a.annual||a.name.localeCompare(b.name));const top=matches[0];if(!top)return;
 return {id:'items_stopped',kind:'monthly',money_per_month:top.annual,method:'Sales before the last 120 days, annualised over the months the item sold.',evidence:{card_period:'year',item:top.name,before_sales:n(top.gross),span_months:top.span,orders:top.before.length,months_ago:top.monthsAgo,other_items:matches.slice(1,3).map(x=>x.name).join(', ')}};
}
export function jumpedItemFinding(sales:Txn[]):Leak|undefined {
 const last=Date.parse(sales.at(-1)?.date||'');if(!Number.isFinite(last))return;const previousStart=last-180*day,recentStart=last-90*day;if(Date.parse(sales[0].date)>previousStart)return;
 const groups=new Map<string,Txn[]>();for(const row of sales)groups.set(item(row),[...(groups.get(item(row))||[]),row]);const choices=[...groups.entries()].map(([name,rows])=>{const recent=rows.filter(row=>Date.parse(row.date)>recentStart),previous=rows.filter(row=>{const d=Date.parse(row.date);return d>previousStart&&d<=recentStart});return {name,recent,previous,recentGross:sum(recent.map(row=>row.gross)),previousGross:sum(previous.map(row=>row.gross))};}).filter(x=>x.recent.length>=3&&x.recentGross>=50&&x.recentGross>=2*x.previousGross).sort((a,b)=>(b.recentGross-b.previousGross)-(a.recentGross-a.previousGross)||a.name.localeCompare(b.name))[0];if(!choices)return;
 return {id:'item_jumped',kind:'monthly',money_per_month:n((choices.recentGross-choices.previousGross)*4),method:'Difference between the latest and prior 90-day sales, annualised at the latest pace.',evidence:{card_period:'year',item:choices.name,last_90:n(choices.recentGross),previous_90:n(choices.previousGross),orders:choices.recent.length}};
}
export function bestMonthFinding(sales:Txn[],months:number):Leak|undefined {
 if(months<12)return;const totals=new Map<string,number>();for(const row of sales){const key=row.date.slice(0,7);totals.set(key,(totals.get(key)||0)+row.gross);}const best=[...totals.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0],average=sum([...totals.values()])/months;if(!best||best[1]<average*1.5)return;
 return {id:'best_month',kind:'monthly',money_per_month:n(best[1]),method:'Highest calendar-month sales compared with the average calendar month in this file.',evidence:{card_period:'now',month:best[0],best_sales:n(best[1]),usual_sales:n(average),multiple:n(best[1]/average)}};
}
