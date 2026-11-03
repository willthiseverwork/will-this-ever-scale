import type {Txn} from './types';
/** Join only demo sandbox sales and generated history before pseudonymisation. */
export function joinDemoHistory(sandbox:Txn[],history:Txn[]):Txn[]{
 const idKey=(x:Txn)=>[x.kind,x.currency,x.id].join('\u001f');
 const ids=new Set(sandbox.filter(x=>x.id).map(idKey));
 const noIdKey=(x:Txn)=>[x.kind,x.currency,x.date.slice(0,10),x.gross,x.item_title||''].join('\u001f');
 const keysWithoutId=new Set(sandbox.filter(x=>!x.id).map(noIdKey));
 const allKeys=new Set(sandbox.map(noIdKey));
 const joined=[...sandbox];
 for(const row of history){
  if((row.id&&ids.has(idKey(row)))||(!row.id&&allKeys.has(noIdKey(row)))||(row.id&&keysWithoutId.has(noIdKey(row))))continue;
  joined.push(row);if(row.id)ids.add(idKey(row));else keysWithoutId.add(noIdKey(row));allKeys.add(noIdKey(row));
 }
 return joined;
}
