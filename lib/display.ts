import type { Analysis, Leak } from './types';

export function money(value:number, currency:string, signed=false) {
  const absolute=Math.abs(value);
  const minimumFractionDigits=absolute>0&&absolute<10?2:0;
  const formatted=new Intl.NumberFormat('en-US',{style:'currency',currency,minimumFractionDigits,maximumFractionDigits:minimumFractionDigits}).format(absolute);
  return signed&&value<0?`−${formatted}`:formatted;
}

export function wholePercent(value:number) {
  const rounded=Math.round(value);
  return `${rounded===0&&value>0?Number(value.toFixed(1)):rounded}%`;
}

export function inOneHundred(value:number) { return `${Math.round(value)} in 100`; }

export function titleLowercase(value:string) { return value?value[0].toLocaleLowerCase()+value.slice(1):value; }

export function headlineMonth(analysis:Analysis) {
  const latest=analysis.months.at(-1);
  if(!latest) return undefined;
  const clock=analysis.as_of?new Date(analysis.as_of):new Date();
  const current=`${clock.getUTCFullYear()}-${String(clock.getUTCMonth()+1).padStart(2,'0')}`;
  const complete=clock.getUTCDate()===new Date(Date.UTC(clock.getUTCFullYear(),clock.getUTCMonth()+1,0)).getUTCDate();
  return latest.month===current&&!complete&&analysis.months.length>1?analysis.months.at(-2):latest;
}

export function monthLabel(month:string, style:'short'|'long'='long') {
  return new Intl.DateTimeFormat('en-US',{month:style,year:'numeric',timeZone:'UTC'}).format(new Date(`${month}-01T00:00:00Z`));
}

export function leakTitle(leak:Leak, names:Record<string,string>) { return names[leak.id]||leak.id; }

export function worthLine(id:string) {
  return ({one_time_buyers:'What getting back to your best months is worth.',refunds_one_item:'What preventing half of these refunds is worth.',small_order_fees:'What pairing small orders into sets would save.',below_cost_items:'What these sales lose you each month.',fewer_new_buyers:'What getting back to your earlier number of new buyers is worth.',subscription_failed_payments:'What failed payments added up to each month.'} as Record<string,string>)[id]||'';
}

export function evidenceLine(leak:Leak,currency:string,readCard=false) {
  const e=leak.evidence;
  if(leak.id==='one_time_buyers'&&typeof e.current_share==='number'&&typeof e.target_share==='number')return readCard?`${inOneHundred(e.current_share)} buyers came back in the last 3 months, ${inOneHundred(e.target_share)} in ${String(e.best_window||'your best window')}.`:`${inOneHundred(e.current_share)} buyers came back recently, ${inOneHundred(e.target_share)} in your best months.`;
  if(leak.id==='refunds_one_item'&&typeof e.item==='string')return typeof e.refund_rate==='number'?`${e.item}: refunded ${wholePercent(e.refund_rate)} of the time.`:`${money(Number(e.refunds||0),currency)} refunded on ${e.item} in the last 3 months.`;
  if(leak.id==='small_order_fees'&&typeof e.threshold==='number')return `On your orders under ${money(e.threshold,currency)}.`;
  if(leak.id==='below_cost_items'&&typeof e.item==='string')return `Each sale of ${e.item} loses money after your costs and fees.`;
  if(leak.id==='fewer_new_buyers'&&typeof e.recent_new==='number'&&typeof e.previous_new==='number')return `${e.recent_new} new buyers in the last 3 months, ${e.previous_new} in the 3 before.`;
  if(leak.id==='subscription_failed_payments'&&typeof e.n_failed==='number')return `${e.n_failed} subscription payments failed in the last 3 months.`;
  return '';
}

export function displayedMoneyMap(analysis:Analysis) {
  const month=headlineMonth(analysis);
  if(!month) return undefined;
  const kept=month.cameIn-month.fees-month.refunds-month.costs-month.ads;
  return {...month,kept:Math.round(kept*100)/100};
}
