import type {Txn} from './types';

export type LinkedTest={findingId:string;testKind?:string;startedAt:string;subject?:string[]};
export type TestComparison={days:number;baseline:number;result:number;baselineCount:number;resultCount:number};
const sales=(rows:Txn[])=>rows.filter(row=>row.kind==='sale'&&row.gross>0);
const range=(rows:Txn[],from:string,to:string)=>rows.filter(row=>row.date>=from&&row.date<to);
const plus=(day:string,n:number)=>{const d=new Date(day+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const minus=(day:string,n:number)=>plus(day,-n);
/** Compare observed records only; it never says a test caused a difference. */
export function linkTest(rows:Txn[],test:LinkedTest,windowDays:number):TestComparison|null {
 const last=rows.map(row=>row.date).sort().at(-1);if(!last||last<=test.startedAt)return null;
 const days=Math.min(windowDays,Math.max(1,Math.floor((Date.parse(last+'T00:00:00Z')-Date.parse(test.startedAt+'T00:00:00Z'))/86400000)+1));
 const after=range(sales(rows),test.startedAt,plus(test.startedAt,days));const before=range(sales(rows),minus(test.startedAt,days),test.startedAt);
 if(test.findingId==='lapsed_buyers'&&test.subject?.length){const subjects=new Set(test.subject);const selected=after.filter(row=>row.buyer_key&&subjects.has(row.buyer_key));return {days,baseline:0,result:selected.reduce((sum,row)=>sum+row.gross,0),baselineCount:0,resultCount:selected.length};}
 if(test.findingId==='one_time_buyers'){
  const pre=sales(rows).filter(row=>row.date<test.startedAt),counts=new Map<string,number>();for(const row of pre)if(row.buyer_key)counts.set(row.buyer_key,(counts.get(row.buyer_key)||0)+1);const once=new Set([...counts].filter(([,count])=>count===1).map(([key])=>key));const picked=(list:Txn[])=>list.filter(row=>row.buyer_key&&once.has(row.buyer_key));const a=picked(after),b=picked(before);return {days,baseline:b.reduce((sum,row)=>sum+row.gross,0),result:a.reduce((sum,row)=>sum+row.gross,0),baselineCount:b.length,resultCount:a.length};
 }
 return {days,baseline:before.reduce((sum,row)=>sum+row.gross,0),result:after.reduce((sum,row)=>sum+row.gross,0),baselineCount:before.length,resultCount:after.length};
}
