import {dedupeRows,isSettledSale} from './engine';
import {isObservedSettledSale,shopFeeEvidence,singleItemEvidence} from './order-fee';
import {costResult,singularItem,type CostAnswers,type SellerKind} from './cost-interview';
import type {Txn} from './types';

/** Select unambiguous single-item orders; file rows without cart lines carry one item title. */
export function visitCost(input:{rows:Txn[];title:string;currency:string;kind:SellerKind;answers:CostAnswers;ordersPerMonth:number;source?:'demo'|'csv'|'sandbox'}){
 const key=(r:Txn)=>JSON.stringify([r.id,r.kind,r.date.slice(0,10),r.currency,r.gross]);
 const groups=new Map<string,Txn[]>();for(const row of input.rows){if(!row.id||row.currency!==input.currency)continue;const k=key(row);groups.set(k,[...(groups.get(k)||[]),row]);}
 const conflicted=new Set([...groups].filter(([,g])=>new Set(g.map(r=>JSON.stringify([r.status??null,r.fee,r.fee_known??null,r.item_title??null,r.cart_complete??null,r.cart_items??null]))).size>1).map(([k])=>k));
 const matches=(a?:string)=>!!a&&a.trim().toLocaleLowerCase()===input.title.trim().toLocaleLowerCase();
 const rows=dedupeRows(input.rows).filter(r=>r.currency===input.currency&&isSettledSale(r)&&(matches(r.item_title)||r.cart_items?.some(i=>matches(i.name))));
 const selected=rows.filter(r=>isObservedSettledSale(r)&&!conflicted.has(key(r))&&(input.source==='csv' && !r.cart_items?.length ? matches(r.item_title) : input.source==='sandbox' ? (r.cart_items?.length===1 && matches(r.cart_items[0].name)) : singleItemEvidence(r,r.cart_items?.[0]?.name||input.title,()=>false)&&matches(r.cart_items?.[0]?.name)));
 const omitted=rows.filter(r=>!selected.includes(r)),mixed=omitted.filter(r=>isObservedSettledSale(r)&&!conflicted.has(key(r))&&(r.cart_items?.length||0)>1).length,excluded=omitted.length;
 if(!selected.length)return {status:'unavailable' as const,excluded};
 const known=selected.filter(r=>r.fee_known===true),shop=shopFeeEvidence(input.rows,input.currency),gross=selected.reduce((a,r)=>a+r.gross,0);
 // Do not silently estimate a mixture of recorded and missing fees.
 const fee=known.length===selected.length?known.reduce((a,r)=>a+Math.abs(r.fee),0)/selected.length:known.length===0&&shop.gross>0?gross/selected.length*shop.fees/shop.gross:null;
 const result=costResult({kind:input.kind,answers:input.answers,cameIn:gross/selected.length,fee,units:input.answers.units,ordersPerMonth:input.ordersPerMonth,currency:input.currency});
 return {status:'available' as const,result,orders:selected.length,excluded,mixed,feeEstimated:known.length===0&&fee!==null,paypalSource:input.source==='sandbox'};
}

/** Build the same visible amounts for the result and later visit-only reuse. */
export function visitCostLines(value:Extract<ReturnType<typeof visitCost>,{status:'available'}>,currency:string,item:string){
 const mixed=value.mixed??0,fmt=(n:number)=>new Intl.NumberFormat(currency==='GBP'?'en-GB':'en-US',{style:'currency',currency}).format(n),r=value.result,parts=r.parts.filter(p=>p.value!==undefined||p.range),unknown=r.parts.filter(p=>p.value===undefined&&!p.range).map(p=>p.label.toLowerCase()),sum=(end:'min'|'max')=>parts.reduce((n,p)=>n+(p.range?.[end]??p.value??0),0),cost=parts.length?(parts.some(p=>p.range)?`${fmt(sum('min'))} to ${fmt(sum('max'))}`:fmt(r.cost)):'not yet',keep=r.fee===null?'not yet':r.keepRange?`${fmt(r.keepRange.min)} to ${fmt(r.keepRange.max)}`:fmt(r.keep),detail=parts.map(p=>`${p.label==='Materials'?'making':p.label==='Posting'?'postage and packing':p.label.toLowerCase()} ${p.range?`${fmt(p.range.min)} to ${fmt(p.range.max)}`:fmt(p.value!)}`).join(' · ');
 return {buyerPays:fmt(r.cameIn),fee:r.fee===null?'not yet':`−${fmt(r.fee)}`,feeLabel:value.feeEstimated?'PayPal fee (estimated)':'PayPal fee',cost:cost==='not yet'?cost:`−${cost.replace(' to ',' to −')}`,costUnsigned:cost,detail,keep,unknown,coverage:`Worked out from ${value.orders} ${value.orders===1?'order':'orders'} that had only ${item.toLowerCase()} in ${value.orders===1?'it':'them'}.${mixed?` ${mixed} ${mixed===1?'other order also had':'other orders also had'} other items, so ${mixed===1?'its costs can’t':'their costs can’t'} be split.`:''}${value.excluded-mixed?` ${value.excluded-mixed} ${value.excluded-mixed===1?'other order could':'other orders could'} not be used because ${value.excluded-mixed===1?'its':'their'} contents, payment status or other details could not be confirmed.`:''}`};
}

/** Explain only confirmed ranges and the help amount actually included in the order cost. */
export function costExplanationLines(answers:CostAnswers,result:import('./cost-interview').CostResult,ordersPerMonth:number,currency:string){
 const amount=(n:number)=>new Intl.NumberFormat(currency==='GBP'?'en-GB':'en-US',{style:'currency',currency}).format(n);
 const specs:Record<string,{label:string;money:boolean;factor?:number}>={units:{label:'per order',money:false},buy:{label:'per item',money:true},batch:{label:'a batch',money:true},pieces:{label:'pieces a batch',money:false},waste:{label:'waste',money:false,factor:100},post:{label:'postage per order',money:true},pay:{label:'pay',money:true},helpers:{label:'help a month',money:true}};
 const ranges=Object.entries(answers.ranges||{}).flatMap(([key,r])=>{if(!r||!specs[key])return [];const spec=specs[key],fmt=(v:number)=>spec.money?amount(v):`${v*(spec.factor||1)}${key==='waste'?'%':''}`;return [`${fmt(r.min)} to ${fmt(r.max)} ${spec.label}`]});
 const lines=ranges.length?[`A range because you said ${ranges.join(' and ')}.`]:[];
 const help=result.parts.find(p=>p.label==='Help');if(answers.helpers!==undefined&&answers.helpers>0&&ordersPerMonth>0&&help?.value!==undefined){const displayed=Math.round(ordersPerMonth);lines.push(`Help ${amount(answers.helpers)} a month, shared over ${displayed===ordersPerMonth?'your':'about'} ${displayed} orders a month = ${amount(help.value)} an order.`)}return lines;
}
