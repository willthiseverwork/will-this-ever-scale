import type {CostResult} from './cost-interview';
import type {Field,Interview} from './voice/interview-engine';
import {fieldLabels,fieldOrder} from './voice/interview-engine';

import type {FeeSelection} from './order-fee';
export type CostFollowup={originalItem?:string;feeCoverage?:FeeSelection;item:string;currency:string;result:CostResult;notCounted:string[];notApplicable:string[];estimated:boolean};
/** The displayed calculation and skipped answers stay in the current browser session only. */
export function costFollowupContext(item:string,currency:string,result:CostResult,interview:Interview,feeCoverage?:FeeSelection):CostFollowup{
 const notCounted=fieldOrder[interview.kind].filter((field:Field)=>!['confirmed','not_applicable'].includes(interview.slots[field].status)).map(field=>fieldLabels[field]);
 const notApplicable=fieldOrder[interview.kind].filter(field=>interview.slots[field].status==='not_applicable').map(field=>fieldLabels[field]);
 return {item,currency,result,...(feeCoverage?{feeCoverage}:{}),notCounted,notApplicable,estimated:fieldOrder[interview.kind].some(field=>interview.slots[field].status==='confirmed'&&/(?:about|roughly|around|approximately|ish)\b/i.test(interview.slots[field].candidate?.said||''))};
}
/** Render only the code-calculated, confirmed result; unconfirmed costs stay unknown. */
export function renderCostFollowup(context:CostFollowup):string{
 const money=(value:number)=>new Intl.NumberFormat(context.currency==='GBP'?'en-GB':'en-US',{style:'currency',currency:context.currency}).format(value);
 const labels=({Buying:'Buying one',Materials:'Materials for a batch',Posting:'Posting an order','Your time':'Your time',Help:'Help per month'} as Record<string,string>),result=context.result,known=result.parts.filter(part=>(part.value!==undefined||part.range!==undefined)&&!context.notCounted.includes(labels[part.label])).map(part=>context.notApplicable.includes(labels[part.label])?`${part.label.toLowerCase()} not applicable`:`${part.label==='Help'?'help allocated across average monthly orders':part.label.toLowerCase()} ${part.range?`${money(part.range.min)} to ${money(part.range.max)}`:money(part.value!)}`);
 const fee=context.feeCoverage,feeText=fee?`PayPal fee ${result.fee===null?'not counted':money(result.fee)} (${fee.actualOrders} recorded, ${fee.estimatedOrders} estimated, ${fee.unknownOrders} unknown orders; ${fee.unattributedOrders} have unconfirmed or mixed contents${fee.assumedOrders?`, including ${fee.assumedOrders} based on your single-item confirmation`:''})`:result.fee===null?'PayPal fee not counted':`estimated PayPal fee ${money(result.fee)} based on shop-wide fees`;const included=[feeText,...known].join(', ');
 const remainder=result.keepRange?`${money(result.keepRange.min)} to ${money(result.keepRange.max)} left`:result.keep<0?`${money(Math.abs(result.keep))} lost`:`${money(result.keep)} left`;
 const unresolved=result.parts.filter(part=>part.value===undefined&&!part.range).map(part=>(labels[part.label]||part.label).toLowerCase()),missingItems=[...new Set([...context.notCounted.map(x=>x.toLowerCase()),...unresolved])],missing=missingItems.length?` Not counted yet: ${missingItems.join(', ')}.`:'';
 return `${remainder} per sale is what remains after the costs in this check (${included}). ${fee?.allocatedEstimateOrders?` For ${fee.allocatedEstimateOrders} mixed or incomplete-cart orders, the fee estimate applies the shop rate to the selected line value.`:''}${fee?.unattributedOrders?' Other item costs and shared charges may be missing.':''}${fee?.unresolvedAdjustments?' Reported fee adjustments are not reconciled.':''} It is not necessarily your full profit.${context.result.parts.some(part=>part.label==='Your time'&&part.value===0)?' Unpaid owner time is not valued.':''}${context.estimated?' Some supplied costs are estimates.':''}${missing} Check whether postage includes packaging, and add any other costs before deciding what to do next.`;
}
