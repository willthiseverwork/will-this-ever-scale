import { z } from 'zod';
import { aggregateSchema, type ReadAggregate } from './read';

export type ActionSuggestion={action:'send_invoice_reminder'|'create_product_and_plan';source:'ai'|'template';reason:string;invoice_index?:number};
type Selection={toolName:string;input:unknown};
const invoiceInput=z.object({invoice_index:z.number().int().min(1).optional()}).strict();
const offerInput=z.object({}).strict();
function choices(a:ReadAggregate,source:'ai'|'template'):ActionSuggestion[]{
 const out:ActionSuggestion[]=[];const q=a.quick_win;
 if(q&&q.invoices>0&&q.one_off_amount>0)out.push({action:'send_invoice_reminder',source,reason:`${q.invoices} unpaid invoices account for ${new Intl.NumberFormat('en-US',{style:'currency',currency:a.currency}).format(q.one_off_amount)} in the supplied records.`});
 if(a.ranked_leaks.some(l=>l.id==='one_time_buyers')&&(a.returning_buyers||0)>0)out.push({action:'create_product_and_plan',source,reason:`${a.returning_buyers} buyers returned in the supplied records.`});
 return out;
}
/** The model selects at most one allowed suggestion; all displayed reasons are fixed evidence templates. */
export function validateSelection(raw:unknown,a:ReadAggregate):ActionSuggestion|null {
 const parsed=aggregateSchema.safeParse(a);if(!parsed.success||!Array.isArray(raw)||raw.length!==1)return null;
 const call=raw[0] as Selection;if(!call||typeof call!=='object')return null;
 if(call.toolName==='recommend_invoice_reminder'){
  const args=invoiceInput.safeParse(call.input);if(!args.success)return null;
  const base=choices(parsed.data,'ai').find(x=>x.action==='send_invoice_reminder');if(!base)return null;
  if(args.data.invoice_index!==undefined){const candidate=parsed.data.invoice_candidates?.find(c=>c.index===args.data.invoice_index);if(!candidate)return null;return {...base,invoice_index:candidate.index};}
  return base;
 }
 if(call.toolName==='recommend_returning_offer'){
  if(!offerInput.safeParse(call.input).success)return null;
  return choices(parsed.data,'ai').find(x=>x.action==='create_product_and_plan')||null;
 }
 return null;
}
export function templateSuggestions(a:ReadAggregate):ActionSuggestion[]{return choices(aggregateSchema.parse(a),'template');}
export async function suggestActions(a:ReadAggregate,select?:()=>Promise<unknown>):Promise<ActionSuggestion[]>{
 const payload=aggregateSchema.parse(a),fallback=templateSuggestions(payload);if(!fallback.length)return [];
 try {
  let calls:unknown;
  if(select) calls=await select();
  else {
   const {selectModel}=await import('./ai-provider');const model=await selectModel();if(!model)return fallback;
   const {generateText,tool}=await import('ai');
   const result=await generateText({model,maxOutputTokens:180,toolChoice:'auto',tools:{
    recommend_invoice_reminder:tool({description:'Suggest reviewing a reminder for unpaid invoices; never send it.',inputSchema:invoiceInput}),
    recommend_returning_offer:tool({description:'Suggest reviewing a product and subscription plan when returning buyers are evidenced; never create it.',inputSchema:offerInput})
   },prompt:`Select at most one appropriate action from the tools for this aggregate. Do not invent facts. No tool executes. If no evidence supports an action, select none. ${JSON.stringify(payload)}`});
   calls=result.toolCalls;
  }
  const selected=validateSelection(calls,payload);return selected?[selected]:fallback;
 } catch{return fallback;}
}
