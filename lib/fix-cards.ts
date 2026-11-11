import raw from '../playbook.json';
import {testMeasure} from './test-measure';
import {repeatBuyerTitle} from './display';
import type { FixCard, Leak, Txn } from './types';

type Lesson = {money:string;money_math:string;so_what:string;steps:string[];help:FixCard['help'];check:string;sources:FixCard['sources']};
const lessons = raw.leaks as unknown as Array<{id:string;name:string;lesson?:Lesson}>;
function cardMath(leak:Leak,currency:string,amount:number,lessonMath:string):string {
  const e=leak.evidence;
  const number=(key:string)=>typeof e[key]==='number'&&Number.isFinite(e[key])?e[key] as number:undefined;
  const fmt=(x:number)=>new Intl.NumberFormat('en-US',{maximumFractionDigits:2}).format(x);
  const money=(x:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(x);
  let calculation='';
  if(leak.id==='one_time_buyers') {const orders=number('additional_orders'),avg=number('average_order'),kept=number('kept_share');if(orders!==undefined&&avg!==undefined&&kept!==undefined)calculation=`${fmt(orders)} additional orders ÷ 3 months × ${money(avg)} average order × ${fmt(kept)}% kept ≈ ${money(amount)} a month.`;}
  if(leak.id==='refunds_one_item') {const refunds=number('refunds'),reduction=leak.assumption?.value;if(refunds!==undefined&&reduction!==undefined)calculation=`${money(refunds)} refunded over 3 months ÷ 3 × ${fmt(reduction)}% prevented ≈ ${money(amount)} a month.`;}
  if(leak.id==='small_order_fees') {const annual=number('annual_savings'),count=number('small_orders');if(annual!==undefined&&count!==undefined)calculation=`${fmt(count)} qualifying payments: ${money(annual)} estimated annual saving ÷ 12 ≈ ${money(amount)} a month.`;}
  if(leak.id==='sets') {const singles=number('single_orders'),second=number('second_price'),cost=number('item_cost');if(singles!==undefined&&second!==undefined)calculation=`${fmt(singles)} single-piece orders ÷ 3 months × 10% × (${money(second)} × 90%${cost===undefined?'':` − ${money(cost)} item cost`}) ≈ ${money(amount)} a month${cost===undefined?' in added sales':' in estimated margin'}.`;}
  if(leak.id==='unpaid_invoices') {const count=number('invoices');if(count!==undefined)calculation=`${fmt(count)} qualifying unpaid invoices total ${money(amount)} now.`;}
  if(leak.id==='held_money') {const count=number('payments');if(count!==undefined)calculation=`${fmt(count)} confirmed held payments without tracking total ${money(amount)} now.`;}
  return [lessonMath||leak.method,calculation].filter(Boolean).join(' ');
}
export function cardFor(leak:Leak,currency:string):FixCard|undefined {
  if(leak.id==='small_order_fees'){const e=leak.evidence,n=(key:string)=>Number(e[key]||0),symbol=new Intl.NumberFormat('en-GB',{style:'currency',currency,maximumFractionDigits:2}).format.bind(new Intl.NumberFormat('en-GB',{style:'currency',currency,maximumFractionDigits:2}));const threshold=symbol(10),annual=leak.money_per_month||0;return {id:leak.id,title:'Small orders eaten by fees',money:{amount:annual,currency,period:'year',estimate:false},money_math:`${n('small_orders')} orders under ${threshold}; fees ${n('small_fee_rate')}% on them vs ${n('rest_fee_rate')}% on the rest.`,so_what:`PayPal's fees took ${n('small_fee_rate')}% of these orders and ${n('rest_fee_rate')}% of the rest.`,steps:[`Find your 3 cheapest items and their current prices.`,`Raise each by ${symbol(1)} or sell them as a 2-pack.`,`Leave it for 30 days.`],help:{kind:'you_do',label:`Add ${symbol(1)} to small orders`},check:{metric:`Orders under ${threshold}`,how:`Keep it if they do not drop by more than 1 in 5.`,days:30},sources:[]};}
  if(leak.id==='items_stopped')return {id:leak.id,title:'Items that stopped selling',money:{amount:leak.money_per_month||0,currency,period:'year',estimate:false},money_math:leak.method,so_what:`${String(leak.evidence.item||'This item')} used to sell. Check that it is still visible and available.`,steps:['Check that it is listed and in stock.','Post it once this month.','Check for one sale in 30 days.'],help:{kind:'you_do',label:'Check the listing'},check:{metric:'Sales of this item',how:'One sale in 30 days is a useful signal.',days:30},sources:[]};
  if(leak.id==='item_jumped')return {id:leak.id,title:'Something took off',money:{amount:leak.money_per_month||0,currency,period:'year',estimate:false},money_math:leak.method,so_what:`${String(leak.evidence.item||'This item')} sold more in the last three months. Make sure you can keep up.`,steps:['Check stock for the next month.','Put it first in your shop and posts.','Make one variation.'],help:{kind:'you_do',label:'Feature this item'},check:{metric:'Next month’s sales',how:'Keep it if they stay at this pace.',days:30},sources:[]};
  if(leak.id==='best_month'){const label=new Intl.DateTimeFormat('en-GB',{month:'long',timeZone:'UTC'}).format(new Date(`${String(leak.evidence.month||'2000-01')}-01T00:00:00Z`));return {id:leak.id,title:'Your best month',money:{amount:leak.money_per_month||0,currency,period:'now',estimate:false},money_math:leak.method,so_what:`${label} was your strongest month. Plan stock, photos and one post before it comes around again.`,steps:['Set a reminder one month before it returns.','Check stock and photos.','Plan one post.'],help:{kind:'you_do',label:'Prepare for this month'},check:{metric:'Sales in that calendar month',how:'Check how it does when the month arrives.',days:30},sources:[]};}
  if(leak.id==='lapsed_buyers')return {id:leak.id,title:'Your quiet regulars',money:{amount:leak.money_per_month||0,currency,period:'now',estimate:false},money_math:leak.method,so_what:'These people used to come back. A short, personal message is the simplest way to ask them back.',steps:['Pick the regular buyers shown in the math.','Send one short message: “We miss you. Your next order ships free if you write BACK before the end of the month.”','Check for an order in two weeks.'],help:{kind:'you_do',label:'Copy the message from your test'},check:{metric:'Orders from these regular buyers',how:'Check for an order in two weeks.',days:14},sources:[]};
  const entry=lessons.find(x=>x.id===leak.id), l=entry?.lesson;
  const amount=leak.kind==='quick_win'?leak.one_off_amount:leak.money_per_month;
  if(!entry||!l||amount===undefined||!Number.isFinite(amount)||!l.so_what||!l.steps.length||!l.help?.label||!l.check) return undefined;
  const validUrl=(s:string)=>{try{return new URL(s).protocol==='https:';}catch{return false;}};
  if((l.help.link&&!validUrl(l.help.link))||l.sources.some(s=>!s.title||!validUrl(s.url)))return undefined;
  const fill=(s:string)=>s.replace(/\{top_pairs\}/g,String(leak.evidence.top_pairs||''));
  if(l.steps.some(s=>s.includes('{top_pairs}'))&&!leak.evidence.top_pairs)return undefined;
  const evidencePeriod=leak.evidence.card_period;
  return {id:leak.id,title:leak.id==='one_time_buyers'?repeatBuyerTitle(Number(leak.evidence.once_buyers),Number(leak.evidence.buyers)):entry.name,money:{amount,currency,period:evidencePeriod==='year'?'year':evidencePeriod==='now'||leak.kind==='quick_win'?'now':'month',estimate:leak.kind!=='quick_win'},money_math:cardMath(leak,currency,amount,l.money_math),so_what:l.so_what,steps:l.steps.map(fill),help:l.help,check:{metric:l.check,how:testMeasure(leak.id,l.check),days:30},sources:l.sources};
}
export const SETS_SINGLE_SHARE=0.60, SETS_MIN_MONTHLY=20;
export function micropaymentSaving(gross:number):number { return gross<26.67?Math.max(0,0.40-0.015*gross):0; }
export function smallFeeFinding(sales:Txn[],currency:string,homeCountry:string|undefined,asOf:Date):Leak|undefined {
  if(currency!=='USD'||homeCountry?.toUpperCase()!=='US')return;
  const cutoff=new Date(asOf);cutoff.setUTCFullYear(cutoff.getUTCFullYear()-1);
  const eligible=sales.filter(t=>{const date=new Date(t.date),cross=t.country&&t.country.toUpperCase()!=='US'?0.015*t.gross:0;return !!t.country&&date>=cutoff&&date<=asOf&&t.gross<26.67&&Math.abs(Math.abs(t.fee)-(0.0349*t.gross+0.49+cross))<=0.02000001;});
  const amount=eligible.reduce((a,t)=>a+micropaymentSaving(t.gross),0)/12;
  if(amount<5)return;
  return {id:'small_order_fees',kind:'monthly',money_per_month:Math.round(amount*100)/100,method:'Savings on qualifying standard-rate payments over the last 12 months, divided by 12.',evidence:{small_orders:eligible.length,orders:sales.length,threshold:26.67,qualifying_gross:eligible.reduce((a,t)=>a+t.gross,0),annual_savings:eligible.reduce((a,t)=>a+micropaymentSaving(t.gross),0)}};
}
export function setsFinding(sales:Txn[],asOf:Date,cost?:number):Leak|undefined {
  const cutoff=asOf.getTime()-90*86400000, recent=sales.filter(t=>{const d=Date.parse(t.date);return d>=cutoff&&d<=asOf.getTime();});
  const orders=recent.filter(t=>t.cart_items?.length&&t.cart_items.every(i=>i.name&&i.quantity>0&&i.unit_price>0));
  if(orders.length!==recent.length)return;
  if(!orders.length)return;
  const singles=orders.filter(t=>t.cart_items!.reduce((a,i)=>a+i.quantity,0)===1);
  if(singles.length/orders.length<SETS_SINGLE_SHARE)return;
  const pairs=new Map<string,{count:number;second:number}>();
  const add=(a:{name:string;unit_price:number},b:{name:string;unit_price:number})=>{if(a.name===b.name)return;const sorted=[a,b].sort((x,y)=>x.name.localeCompare(y.name));const key=sorted.map(x=>x.name).join(' + '),v=pairs.get(key)||{count:0,second:0};v.count++;v.second+=sorted[1].unit_price;pairs.set(key,v);};
  for(const t of orders){const items=t.cart_items!;for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++)add(items[i],items[j]);}
  for(let i=0;i<orders.length;i++)for(let j=i+1;j<orders.length;j++){const a=orders[i],b=orders[j];if(a.buyer_key&&a.buyer_key===b.buyer_key&&Math.abs(Date.parse(a.date)-Date.parse(b.date))<=30*86400000)for(const x of a.cart_items!)for(const y of b.cart_items!)add(x,y);}
  const top=[...pairs].sort((a,b)=>b[1].count-a[1].count||a[0].localeCompare(b[0])).slice(0,3);if(!top.length)return;
  const count=top.reduce((a,[,v])=>a+v.count,0),second=top.reduce((a,[,v])=>a+v.second,0)/count;
  const amount=singles.length/3*.1*Math.max(0,second*.9-(cost??0));if(amount<SETS_MIN_MONTHLY)return;
  return {id:'sets',kind:'monthly',money_per_month:Math.round(amount*100)/100,method:cost===undefined?'Single-piece orders per month × 10% × average second-piece price × 90%: added sales.':'Single-piece orders per month × 10% × (90% of average second-piece price less supplied item cost): estimated margin.',evidence:{top_pairs:top.map(([key])=>key).join(', '),single_orders:singles.length,orders:orders.length,second_price:second,...(cost===undefined?{}:{item_cost:cost})}};
}
