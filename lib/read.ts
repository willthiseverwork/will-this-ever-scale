import { z } from 'zod';
import type { Analysis } from './types';

// Deliberately no free-text fields: a product title can itself contain a name or email.
const finite = z.number().finite().min(-1e12).max(1e12);
const leakId = z.enum(['one_time_buyers','refunds_one_item','small_order_fees','cross_border_fees','below_cost_items','fewer_new_buyers','subscription_failed_payments']);
export const aggregateSchema = z.object({
  currency:z.string().regex(/^[A-Z]{3}$/),
  money_map:z.object({came_in:finite,paypal_fees:finite,refunds:finite,costs:finite,ad_spend:finite,kept:finite}).strict(),
  ranked_leaks:z.array(z.object({id:leakId,money_per_month:finite}).strict()).max(10),
  quick_win:z.object({one_off_amount:finite.nonnegative(),invoices:z.number().int().min(0).max(1000000)}).strict().optional(),
  returning_buyers:z.number().int().min(0).max(1000000).optional(),
  invoice_candidates:z.array(z.object({index:z.number().int().min(1).max(1000000),amount:finite.positive(),age_days:z.number().int().min(14).max(36500)}).strict()).max(20).optional(),
}).strict().superRefine((v,ctx)=>{const candidates=v.invoice_candidates||[];if(candidates.length&&(!v.quick_win||candidates.length>v.quick_win.invoices||new Set(candidates.map(c=>c.index)).size!==candidates.length||candidates.reduce((n,c)=>n+c.amount,0)>v.quick_win.one_off_amount+0.001))ctx.addIssue({code:z.ZodIssueCode.custom,message:'Invoice evidence is inconsistent.'});});
export type ReadAggregate = z.infer<typeof aggregateSchema>;
export function readAggregate(a:Analysis):ReadAggregate {
  const q=a.quick_win, records=a.invoice_records||[];
  // Only send indexed numeric evidence when the full browser-side invoice list
  // reconciles to the engine quick win. IDs and labels never leave the browser.
  const complete=!!q&&records.length===q.evidence.invoices&&records.every(r=>r.currency===a.currency&&Number.isFinite(r.amount)&&r.amount>0&&Number.isInteger(r.age_days)&&r.age_days!>=14&&r.age_days!<=36500)&&Math.abs(records.reduce((n,r)=>n+r.amount,0)-(q.one_off_amount||0))<0.001;
  const invoice_candidates=complete?records.slice(0,20).map((r,i)=>({index:i+1,amount:r.amount,age_days:r.age_days!})):[];
  return aggregateSchema.parse({currency:a.currency,money_map:a.money_map,ranked_leaks:a.ranked_leaks.map(l=>({id:l.id,money_per_month:l.money_per_month})),...(Number.isInteger(a.buyers.returning_buyers)&&a.buyers.returning_buyers>0?{returning_buyers:a.buyers.returning_buyers}:{}),...(q?{quick_win:{one_off_amount:q.one_off_amount,invoices:q.evidence.invoices}}:{}),...(invoice_candidates.length?{invoice_candidates}:{})});
}
export function templateRead(a:ReadAggregate | Analysis) {
  const v='months' in a?readAggregate(a):a; const top=v.ranked_leaks[0], q=v.quick_win;
  const amount=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:v.currency,maximumFractionDigits:2}).format(n);
  return `You took in ${amount(v.money_map.came_in)} and kept ${amount(v.money_map.kept)} after the deductions included here. ${top?`The largest estimated monthly opportunity is ${top.id.replaceAll('_',' ')}, at ${amount(top.money_per_month)} a month if the assumption holds.`:'There is not enough evidence to rank a monthly opportunity.'} ${q?`${amount(q.one_off_amount)} is waiting in ${q.invoices} unpaid invoices.`:'No qualifying unpaid invoice records were supplied.'} Answer the short questions before deciding what to test.`;
}
// Match complete numeric tokens, so 99 cannot borrow the 9 in 1,999. Formatting
// variants (commas and decimal zeroes) compare by numeric value, without rounding.
export function inspectReadValidation(text:string,a:ReadAggregate | Analysis) {
  const v='months' in a?readAggregate(a):aggregateSchema.parse(a);
  const allowed=new Set<number>();
  const collect=(x:unknown):void=>{if(typeof x==='number') allowed.add(x); else if(Array.isArray(x)) x.forEach(collect); else if(x&&typeof x==='object') Object.values(x).forEach(collect);}; collect(v);
  const numberWordPattern=/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|half|quarter|twice|double|triple)\b/gi;
  const offendingNumberWords=[...new Set((text.match(numberWordPattern)||[]).map(word=>word.toLowerCase()))];
  const spelledNumberPattern=offendingNumberWords.length>0;
  const embedded=/\d[a-z_]|[a-z_]\d/i.test(text);
  // Reject partial decimal tokens and malformed numeric grouping instead of
  // silently skipping fragments or borrowing separately allowed integers.
  const malformed=/(?<![\w\d])\.\d|\d\.\d+\.\d|\d,\d{1,2}(?!\d)|\d,\d{4,}/.test(text);
  const tokens=text.match(/(?<![\w.])-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?(?!\w|\.\d)/g)||[];
  const numericTokenMismatch=embedded||malformed||tokens.some(t=>!allowed.has(Number(t.replaceAll(',',''))));
  return {numericValidation:!!text.trim()&&text.length<=2000&&!spelledNumberPattern&&!numericTokenMismatch,spelledNumberPattern,numericTokenMismatch,offendingNumberWords};
}
export function validateRead(text:string,a:ReadAggregate | Analysis) {return inspectReadValidation(text,a).numericValidation;}

type AiDiagnosticPhase='read_unavailable'|'read_validated'|'read_validation_exhausted'|'read_call_failed'|'suggestions_unavailable'|'suggestions_validated'|'suggestions_invalid'|'suggestions_call_failed'|'suggestions_no_evidence';
const safeErrorNames:Record<string,string>={AccessDeniedException:'access_denied',UnrecognizedClientException:'authentication',ExpiredTokenException:'authentication',InvalidClientTokenId:'authentication',ValidationException:'validation',ResourceNotFoundException:'not_found',ThrottlingException:'throttled',TooManyRequestsException:'throttled',ServiceUnavailableException:'unavailable',ModelNotReadyException:'unavailable',ModelTimeoutException:'timeout',AbortError:'timeout',TimeoutError:'timeout',AI_APICallError:'provider_error'};
/** Logs only fixed phase/category and an allowlisted HTTP status, never provider messages or payloads. */
export function aiDiagnostic(phase:AiDiagnosticPhase,error?:unknown){
 let category='unknown';let status:number|undefined;let current:unknown=error;
 try { for(let depth=0;depth<3&&current&&typeof current==='object';depth++){
  const item=current as {name?:unknown;statusCode?:unknown;responseHeaders?:unknown;cause?:unknown};
  if(typeof item.name==='string'&&Object.hasOwn(safeErrorNames,item.name)&&category==='unknown')category=safeErrorNames[item.name];
  if(typeof item.statusCode==='number'&&[400,401,403,404,408,409,413,429,500,502,503,504].includes(item.statusCode))status=item.statusCode;
  const headers=item.responseHeaders;
  const raw=headers instanceof Headers?headers.get('x-amzn-errortype'):(headers&&typeof headers==='object'?(headers as Record<string,unknown>)['x-amzn-errortype']:undefined);
  if(typeof raw==='string'){const key=raw.split(':',1)[0];if(Object.hasOwn(safeErrorNames,key))category=safeErrorNames[key];}
  current=item.cause;
 }} catch { category='unknown'; status=undefined; }
 console.info('ai_diagnostic',{phase,category,...(status===undefined?{}:{status})});
}
type ReadPlaceholder='SALES'|'KEPT'|'TOP_MONTHLY'|'UNPAID'|'INVOICES';
function readPlaceholders(payload:ReadAggregate):Partial<Record<ReadPlaceholder,string>> {
 const a=aggregateSchema.parse(payload);const money=(n:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:a.currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(n);
 return {SALES:money(a.money_map.came_in),KEPT:money(a.money_map.kept),...(a.ranked_leaks[0]?{TOP_MONTHLY:money(a.ranked_leaks[0].money_per_month)}:{}),...(a.quick_win&&a.quick_win.invoices>0?{UNPAID:money(a.quick_win.one_off_amount),INVOICES:String(a.quick_win.invoices)}:{})};
}
/** Only supplied placeholders may become numbers, and their values come from the engine. */
export function renderReadDraft(text:string,payload:ReadAggregate):string|null {
 const a=aggregateSchema.parse(payload),values=readPlaceholders(a);
 if(!text.trim()||text.length>2000||/@|https?:\/\//i.test(text))return null;
 const found=[...text.matchAll(/\{\{([A-Z_]+)\}\}/g)].map(m=>m[1]);const keys=Object.keys(values);
 if(found.length!==keys.length||new Set(found).size!==found.length||keys.some(key=>!found.includes(key))||found.some(key=>!Object.hasOwn(values,key)))return null;
 const remainder=text.replace(/\{\{[A-Z_]+\}\}/g,'');
 if(/[{}\d]/.test(remainder)||inspectReadValidation(remainder,a).spelledNumberPattern)return null;
 const rendered=text.replace(/\{\{([A-Z_]+)\}\}/g,(_,key:ReadPlaceholder)=>values[key]!);
 return validateRead(rendered,a)?rendered:null;
}
export function buildReadPrompt(payload:ReadAggregate):string {
 const a=aggregateSchema.parse(payload),values=readPlaceholders(a);
 const topNames:Record<string,string>={one_time_buyers:'buyers who have not returned',refunds_one_item:'refunds on an item',small_order_fees:'small-order fees',cross_border_fees:'cross-border fees',below_cost_items:'items sold below cost',fewer_new_buyers:'fewer new buyers',subscription_failed_payments:'failed subscription payments'};
 const top=a.ranked_leaks[0]?topNames[a.ranked_leaks[0].id]:undefined;
 return `Write exactly 3 short plain-language sentences. No bullets or headings. Use every listed placeholder exactly once and only as written: ${Object.keys(values).map(key=>`{{${key}}}`).join(', ')}. Never write any digits or number words yourself. Placeholders already include currency symbols where needed. {{SALES}} is sales and {{KEPT}} is money kept after included deductions, which may not include all business costs.${top?' {{TOP_MONTHLY}} is an estimated monthly opportunity concerning '+top+'; state clearly it depends on an assumption.':''}${a.quick_win&&a.quick_win.invoices>0?' {{UNPAID}} is cash waiting in {{INVOICES}} unpaid invoices.':''} Do not infer causes, invent advice, or claim an estimate is guaranteed.`;
}

export async function makeReadWithSource(a:ReadAggregate | Analysis, generate?:(prompt:string)=>Promise<string>):Promise<{read:string;read_source:'model'|'template'}> {
  const payload='months' in a?readAggregate(a):aggregateSchema.parse(a); const fallback=templateRead(payload);
  try {
    const {generateText}=await import('ai'); const {selectModel}=await import('./ai-provider'); const model=generate?null:await selectModel(); if(!generate&&!model){aiDiagnostic('read_unavailable');return {read:fallback,read_source:'template'};}
    const prompt=buildReadPrompt(payload);
    let resultTextForRetry = '';
    for(let attempt=0;attempt<2;attempt++) {
      const instruction=attempt?`Correct the draft using only the required placeholders; do not write any numbers. ${prompt}\nOutput to correct: ${resultTextForRetry}`:prompt;
      const output=generate?await generate(instruction):await generateText({model:model!,maxOutputTokens:300,maxRetries:0,prompt:instruction});
      const result=typeof output==='string'?output:output.text;
      const completed=typeof output==='string'||output.finishReason==='stop';
      // Direct-number responses are accepted only by the injected test seam;
      // real provider responses must use engine-filled placeholders.
      const rendered=generate&&!result.includes('{{')?(validateRead(result,payload)?result:null):renderReadDraft(result,payload);
      if(completed&&rendered){aiDiagnostic('read_validated');return {read:rendered,read_source:'model'};}
      resultTextForRetry=result;
    }
    aiDiagnostic('read_validation_exhausted');
  } catch(error) { aiDiagnostic('read_call_failed',error); }
  return {read:fallback,read_source:'template'};
}
export async function makeRead(a:ReadAggregate|Analysis){return (await makeReadWithSource(a)).read;}
