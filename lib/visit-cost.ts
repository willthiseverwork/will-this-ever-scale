import {dedupeRows} from './engine';
import {isObservedSettledSale,shopFeeEvidence,singleItemEvidence} from './order-fee';
import {costResult,type CostAnswers,type SellerKind} from './cost-interview';
import type {Txn} from './types';

/** A temporary cost check only uses orders whose complete cart proves the item was alone. */
export function visitCost(input:{rows:Txn[];title:string;currency:string;kind:SellerKind;answers:CostAnswers;ordersPerMonth:number;source?:'demo'|'csv'|'sandbox'}){
 const key=(r:Txn)=>JSON.stringify([r.id,r.kind,r.date.slice(0,10),r.currency,r.gross]);
 const groups=new Map<string,Txn[]>();for(const row of input.rows){if(!row.id||row.currency!==input.currency)continue;const k=key(row);groups.set(k,[...(groups.get(k)||[]),row]);}
 const conflicted=new Set([...groups].filter(([,g])=>new Set(g.map(r=>JSON.stringify([r.status??null,r.fee,r.fee_known??null,r.item_title??null,r.cart_complete??null,r.cart_items??null]))).size>1).map(([k])=>k));
 const rows=dedupeRows(input.rows).filter(r=>r.currency===input.currency&&isObservedSettledSale(r)&&(r.item_title===input.title||r.cart_items?.some(i=>i.name===input.title)));
 const selected=rows.filter(r=>!conflicted.has(key(r))&&(input.source==='sandbox' ? (r.cart_items?.length===1 && r.cart_items[0].name===input.title) : singleItemEvidence(r,input.title,()=>false)));
 const excluded=rows.length-selected.length;
 if(!selected.length)return {status:'unavailable' as const,excluded};
 const known=selected.filter(r=>r.fee_known===true),shop=shopFeeEvidence(input.rows,input.currency),gross=selected.reduce((a,r)=>a+r.gross,0);
 // Do not silently estimate a mixture of recorded and missing fees.
 const fee=known.length===selected.length?known.reduce((a,r)=>a+Math.abs(r.fee),0)/selected.length:known.length===0&&shop.gross>0?gross/selected.length*shop.fees/shop.gross:null;
 const result=costResult({kind:input.kind,answers:input.answers,cameIn:gross/selected.length,fee,units:input.answers.units,ordersPerMonth:input.ordersPerMonth,currency:input.currency});
 return {status:'available' as const,result,orders:selected.length,excluded,feeEstimated:known.length===0&&fee!==null,paypalSource:input.source==='sandbox'};
}

/** Build the same visible amounts for the result and later visit-only reuse. */
export function visitCostLines(value:Extract<ReturnType<typeof visitCost>,{status:'available'}>,currency:string,item:string){
 const fmt=(n:number)=>new Intl.NumberFormat(currency==='GBP'?'en-GB':'en-US',{style:'currency',currency}).format(n),r=value.result,parts=r.parts.filter(p=>p.value!==undefined||p.range),unknown=r.parts.filter(p=>p.value===undefined&&!p.range).map(p=>p.label.toLowerCase()),sum=(end:'min'|'max')=>parts.reduce((n,p)=>n+(p.range?.[end]??p.value??0),0),cost=parts.length?(parts.some(p=>p.range)?`${fmt(sum('min'))} to ${fmt(sum('max'))}`:fmt(r.cost)):'not yet',keep=r.fee===null?'not yet':r.keepRange?`${fmt(r.keepRange.min)} to ${fmt(r.keepRange.max)}`:fmt(r.keep),detail=parts.map(p=>`${p.label==='Materials'?'making':p.label==='Posting'?'postage and packing':p.label.toLowerCase()} ${p.range?`${fmt(p.range.min)} to ${fmt(p.range.max)}`:fmt(p.value!)}`).join(' · ');
 return {buyerPays:fmt(r.cameIn),fee:r.fee===null?'not yet':`−${fmt(r.fee)}`,feeLabel:value.feeEstimated?'PayPal fee (estimated)':'PayPal fee',cost:cost==='not yet'?cost:`−${cost}`,detail,keep,unknown,coverage:`${value.paypalSource?`Based on ${value.orders} ${item} ${value.orders===1?'order':'orders'}, as PayPal listed them.`:`Based on ${value.orders} ${value.orders===1?'order':'orders'} of ${item}.`}${value.excluded?` ${value.excluded} ${value.excluded===1?'order was':'orders were'} left out because the contents were mixed or unconfirmed.`:''}`};
}
