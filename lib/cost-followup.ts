import type {CostResult} from './cost-interview';
import type {Field,Interview} from './voice/interview-engine';
import {fieldLabels,fieldOrder} from './voice/interview-engine';

export type CostFollowup={item:string;currency:string;result:CostResult;notCounted:string[]};
/** The displayed calculation and skipped answers stay in the current browser session only. */
export function costFollowupContext(item:string,currency:string,result:CostResult,interview:Interview):CostFollowup{
 const notCounted=fieldOrder[interview.kind].filter((field:Field)=>interview.slots[field].status!=='confirmed').map(field=>fieldLabels[field]);
 return {item,currency,result,notCounted};
}
/** Answer only a question interpreting a cost result; leave other chat questions on their existing paths. */
export function answerCostFollowup(question:string,context:CostFollowup|null,mentionedItem?:string):string|null{
 if(!/\bprofit\b/i.test(question)||!/(?:\b(?:this|that|result|keep|kept|left|cost|costs|per sale|margin)\b|[$£€]\s*\d)/i.test(question))return null;
 if(!context)return 'Complete a cost check first, then I can explain what the amount includes.';
 if(mentionedItem&&mentionedItem!==context.item)return 'The completed cost check is for a different item. Check the costs for this item first.';
 const asked=question.match(/\b(?:does|is)\s*(?:the\s*)?[$£€]\s*(\d+(?:\.\d{1,2})?)/i);
 if(asked&&Math.abs(Number(asked[1])-Math.abs(context.result.keep))>.005)return 'That amount does not match the latest cost check. Check the amount and ask again.';
 const money=(value:number)=>new Intl.NumberFormat(context.currency==='GBP'?'en-GB':'en-US',{style:'currency',currency:context.currency}).format(value);
 const result=context.result,known=result.parts.filter(part=>part.value!==undefined&&!context.notCounted.includes(({Buying:'Buying one',Materials:'Materials for a batch',Posting:'Posting an order','Your time':'Your time per order',Help:'Help per month'} as Record<string,string>)[part.label])).map(part=>`${part.label.toLowerCase()} ${money(part.value!)}`);
 const included=[`estimated PayPal fee ${money(result.fee)} based on shop-wide fees`,...known].join(', ');
 const remainder=result.keep<0?`${money(Math.abs(result.keep))} lost`:`${money(result.keep)} left`;
 const missing=context.notCounted.length?` Not counted yet: ${context.notCounted.map(x=>x.toLowerCase()).join(', ')}.`:'';
 return `${remainder} per sale is what remains after the costs in this check (${included}). It is not necessarily your full profit.${missing} Check whether postage includes packaging, and add any other costs before deciding what to do next.`;
}
