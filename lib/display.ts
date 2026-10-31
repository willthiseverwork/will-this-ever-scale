import type { Analysis, InvoiceRecord, Leak } from './types';

export function verifiedInvoicesMatch(verified:unknown,requested:InvoiceRecord[],expectedTotal:number,minAge=14):boolean {
 if(!Array.isArray(verified)||!requested.length||verified.length!==requested.length)return false;
 if(verified.some((v,i)=>!v||typeof v!=='object'||v.requestedId!==requested[i].id||v.currency!==requested[i].currency||typeof v.amount!=='number'||!Number.isFinite(v.amount)||Math.round(v.amount*100)!==Math.round(requested[i].amount*100)||typeof v.id!=='string'||!v.id||typeof v.title!=='string'||!v.title||typeof v.age_days!=='number'||!Number.isFinite(v.age_days)||v.age_days<minAge))return false;
 return Math.round(verified.reduce((n,v)=>n+v.amount,0)*100)===Math.round(expectedTotal*100);
}

export function money(value:number, currency:string, signed=false) {
  const absolute=Math.abs(value);
  const minimumFractionDigits=absolute>0&&absolute<10?2:0;
  const formatted=new Intl.NumberFormat('en-US',{style:'currency',currency,minimumFractionDigits,maximumFractionDigits:minimumFractionDigits}).format(absolute);
  return signed&&value<0?`−${formatted}`:formatted;
}

/** Preserve cents when rounding individual displayed parts leaves a fractional total. */
export function reconciledMoney(value:number,currency:string,signed=false) {
  const v=Math.round(Math.abs(value)*100)/100;
  const digits=Number.isInteger(v)&&v>=10?0:2;
  return `${signed&&value<0?'−':''}${new Intl.NumberFormat('en-US',{style:'currency',currency,minimumFractionDigits:digits,maximumFractionDigits:digits}).format(v)}`;
}

export function displayMonth<T extends {cameIn:number;fees:number;refunds:number;costs:number;ads:number}>(month:T) {
  const round=(n:number)=>Math.abs(n)>0&&Math.abs(n)<10?Math.round(n*100)/100:Math.round(n);
  const cameIn=round(month.cameIn),fees=round(month.fees),refunds=round(month.refunds),costs=round(month.costs),ads=round(month.ads);
  return {...month,cameIn,fees,refunds,costs,ads,kept:Math.round((cameIn-fees-refunds-costs-ads)*100)/100};
}

export function wholePercent(value:number) {
  const rounded=Math.round(value);
  return `${rounded===0&&value>0?Number(value.toFixed(1)):rounded}%`;
}

export function inOneHundred(value:number) { return `${Math.round(value)} in 100`; }

export function titleLowercase(value:string) { return value?value[0].toLocaleLowerCase()+value.slice(1):value; }

export function localMonth(clock=new Date()) { return `${clock.getFullYear()}-${String(clock.getMonth()+1).padStart(2,'0')}`; }

export function headlineMonth(analysis:Analysis, sellerClock=new Date()) {
  const latest=analysis.months.at(-1);
  if(!latest) return undefined;
  const fixed=analysis.clock_basis==='fixed'&&analysis.as_of;
  const clock=fixed?new Date(analysis.as_of!):sellerClock;
  const current=fixed?`${clock.getUTCFullYear()}-${String(clock.getUTCMonth()+1).padStart(2,'0')}`:localMonth(clock);
  const complete=!!fixed&&clock.getUTCDate()===new Date(Date.UTC(clock.getUTCFullYear(),clock.getUTCMonth()+1,0)).getUTCDate();
  return latest.month===current&&!complete&&analysis.months.length>1?analysis.months.at(-2):latest;
}

export function monthLabel(month:string, style:'short'|'long'='long') {
  return new Intl.DateTimeFormat('en-US',{month:style,year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`));
}

export function leakTitle(leak:Leak, names:Record<string,string>) { return names[leak.id]||leak.id; }

export function worthLine(id:string) {
  return ({one_time_buyers:'What getting back to your best months is worth.',refunds_one_item:'What preventing half of these refunds is worth.',small_order_fees:'What a lower payment fee could save.',below_cost_items:'What these sales lose you each month.',fewer_new_buyers:'What getting back to your earlier number of new buyers is worth.',subscription_failed_payments:'What failed payments added up to each month.'} as Record<string,string>)[id]||'';
}

export function evidenceLine(leak:Leak,currency:string,readCard=false) {
  const e=leak.evidence;
  if(leak.id==='one_time_buyers'&&typeof e.current_share==='number'&&typeof e.target_share==='number')return readCard?`${inOneHundred(e.current_share)} buyers came back in the last 3 months, ${inOneHundred(e.target_share)} in ${String(e.best_window||'your best window')}.`:`${inOneHundred(e.current_share)} buyers came back recently, ${inOneHundred(e.target_share)} in your best months.`;
  if(leak.id==='refunds_one_item'&&typeof e.item==='string')return typeof e.refund_rate==='number'?`${e.item}: refunded ${wholePercent(e.refund_rate)} of the time.`:`${money(Number(e.refunds||0),currency)} refunded on ${e.item} in the last 3 months.`;
  if(leak.id==='small_order_fees'&&typeof e.threshold==='number')return `On qualifying orders under ${new Intl.NumberFormat('en-US',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(e.threshold)}.`;
  if(leak.id==='below_cost_items'&&typeof e.item==='string')return `Each sale of ${e.item} loses money after your costs and fees.`;
  if(leak.id==='fewer_new_buyers'&&typeof e.recent_new==='number'&&typeof e.previous_new==='number')return `${e.recent_new} new buyers in the last 3 months, ${e.previous_new} in the 3 before.`;
  if(leak.id==='subscription_failed_payments'&&typeof e.n_failed==='number')return `${e.n_failed} subscription payments failed in the last 3 months.`;
  return '';
}

export function displayedMoneyMap(analysis:Analysis) {
  const month=headlineMonth(analysis);
  if(!month) return undefined;
  return displayMonth(month);
}

/** Show only inputs supplied by the engine. Missing values remain explicit. */
export function calculationLines(leak:Leak,analysis:Analysis,costPerItem?:number):string[] {
  const e=leak.evidence,c=analysis.currency;
  const n=(key:string)=>typeof e[key]==='number'?e[key] as number:undefined;
  const exact=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:c,minimumFractionDigits:2,maximumFractionDigits:2}).format(v);
  const result=money(leak.money_per_month||0,c);
  if(leak.id==='one_time_buyers'&&n('additional_orders')!==undefined&&n('average_order')!==undefined&&n('kept_share')!==undefined) return [
    `Buyers, last 3 months: ${n('buyers')}`,
    `Came back, last 3 months: ${inOneHundred(n('current_share')||0)}`,
    `Came back, ${e.best_window||'best window'}: ${inOneHundred(n('target_share')||0)}`,
    `More buyers back each month: ${(n('additional_orders')!/3).toFixed(2)}`,
    `Average order: ${exact(n('average_order')!)}`,
    `Kept after fees and refunds, all months: ${n('kept_share')}%`,
    `${(n('additional_orders')!/3).toFixed(2)} × ${exact(n('average_order')!)} × ${n('kept_share')}% ≈ ${result} a month`
  ];
  if(leak.id==='refunds_one_item'&&n('refunds')!==undefined) {
    const p=leak.assumption?.value??50;
    return [`Refunds on ${e.item}, last 3 months: ${exact(n('refunds')!)}`,...(n('refunded_orders')!==undefined&&n('item_orders')!==undefined?[`Refunded orders: ${n('refunded_orders')} of ${n('item_orders')}`]:[]),`If you prevent: ${p}%`,`${exact(n('refunds')!)} ÷ 3 × ${p}% ≈ ${result} a month`];
  }
  if(leak.id==='small_order_fees'&&n('annual_savings')!==undefined) return [`Qualifying orders, last 12 months: ${n('small_orders')}`,`Savings across those orders: ${exact(n('annual_savings')!)}`,`${exact(n('annual_savings')!)} ÷ 12 ≈ ${result} a month`];
  if(leak.id==='sets'&&n('single_orders')!==undefined&&n('second_price')!==undefined) {
    const price=n('second_price')!;
    return [`Single-piece orders, last 90 days: ${n('single_orders')}`,`Average second-piece price: ${exact(price)}`,...(costPerItem===undefined?['This is added sales.']:[`Your cost per item: ${exact(costPerItem)}`]),`${n('single_orders')} ÷ 3 × 10% × (${exact(price)} × 90%${costPerItem===undefined?'':` − ${exact(costPerItem)}`}) ≈ ${result} a month`];
  }
  if(leak.id==='below_cost_items'&&n('shortfall')!==undefined&&n('months')!==undefined) return [`Observed shortfall: ${exact(n('shortfall')!)}`,`${exact(n('shortfall')!)} ÷ ${n('months')} months ≈ ${result} a month`];
  if(leak.id==='fewer_new_buyers'&&n('previous_new')!==undefined&&n('recent_new')!==undefined&&n('average_order')!==undefined&&n('kept_share')!==undefined) return [`First-seen buyers, earlier 3 months: ${n('previous_new')}`,`First-seen buyers, last 3 months: ${n('recent_new')}`,`Average order: ${exact(n('average_order')!)}`,`Kept share: ${n('kept_share')}%`,`(${n('previous_new')} − ${n('recent_new')}) × ${exact(n('average_order')!)} × ${n('kept_share')}% ÷ 3 ≈ ${result} a month`];
  if(leak.id==='subscription_failed_payments'&&n('failed_total')!==undefined) return [`Failed payments, last 3 months: ${n('n_failed')}`,`${exact(n('failed_total')!)} ÷ 3 ≈ ${result} a month`];
  return [leak.card?.money_math||leak.method,'The detailed inputs are not available in this data.'];
}
