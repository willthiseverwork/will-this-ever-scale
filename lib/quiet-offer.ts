import type {Txn} from './types';
export type QuietBuyer={key:string;name:string;email?:string};
export type OfferKind='postage'|'discount';
export function offerDate(today:string){const date=new Date(today+'T12:00:00Z');if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==today)throw new Error('Invalid date');date.setUTCDate(date.getUTCDate()+28);return date.toISOString().slice(0,10)}
export function offerMessage(name:string,kind:OfferKind,today:string){const date=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(offerDate(today)+'T12:00:00Z'));return `Hi ${name||'there'}, it’s been a while! ${kind==='postage'?"Here’s free postage":"Here’s 10% off"} on your next order: just use code BACK by ${date}. Thank you for shopping with me.`}
export function messagesForBuyers<T extends QuietBuyer>(template:string,firstName:string,buyers:T[]){return buyers.map(b=>({buyer:b,message:template.replace(`Hi ${firstName||'there'},`,`Hi ${b.name||'there'},`)}))}
export function offerFollowup(rows:Txn[],buyerKeys:string[],started:string,asOf:string,currency?:string){const keys=new Set(buyerKeys),returned=new Map<string,number>(),end=asOf<offerDate(started)?asOf:offerDate(started);for(const row of rows){if(!row.buyer_key||!keys.has(row.buyer_key)||row.date.slice(0,10)<=started||row.date.slice(0,10)>end||(currency&&row.currency!==currency)||!['sale','invoice_payment','subscription_payment'].includes(row.kind)||row.gross<=0||/pending|failed|denied|refused|declined|cancelled|unpaid/i.test(row.status||''))continue;returned.set(row.buyer_key,(returned.get(row.buyer_key)||0)+row.gross)}return {buyers:[...returned.keys()],sales:[...returned.values()].reduce((a,b)=>a+b,0)}}
export function quietRegulars(rows:Txn[],currency?:string){
 const sales=rows.filter(x=>(!currency||x.currency===currency)&&x.buyer_key&&['sale','invoice_payment','subscription_payment'].includes(x.kind)&&x.gross>0&&!/pending|failed|denied|refused|declined|cancelled|unpaid/i.test(x.status||'')).sort((a,b)=>a.date.localeCompare(b.date));const latest=sales.at(-1)?.date;if(!latest)return [];
 const groups=new Map<string,Txn[]>();for(const row of sales){const key=row.buyer_key!;groups.set(key,[...(groups.get(key)||[]),row])}
 return [...groups.entries()].flatMap(([key,orders])=>{if(orders.length<3)return [];const first=Date.parse(orders[0].date),last=Date.parse(orders.at(-1)!.date),gap=(last-first)/(orders.length-1)/86400000,quiet=(Date.parse(latest)-last)/86400000;if(quiet<=Math.max(60,gap*2))return [];return [{key,orders:orders.length,last:orders.at(-1)!.date,average:orders.reduce((n,x)=>n+x.gross,0)/orders.length,gapWeeks:gap/7}]});
}

/** Require an observed transaction at or after the deadline before presenting a follow-up. */
export function offerCoverageThrough(rows:Txn[],started:string,currency:string){const due=offerDate(started);return rows.some(row=>row.currency===currency&&row.date.slice(0,10)>=due);}

/** Treat calendar dates as UTC so they do not shift in the viewer's timezone. */
export function quietDate(value:string){const day=value.slice(0,10),date=new Date(day+'T12:00:00Z');return Number.isFinite(date.getTime())?new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date):day;}
