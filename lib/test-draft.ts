import {z} from 'zod';

const plainWords=/^[A-Za-z_{}'’,.!?;:()\-\s]+$/;
const forbidden=/\b(?:because|caused by|due to|therefore|conversion|retention|funnel|segment|cohort|optimi[sz]e|leverage|synergy)\b/i;
const numberWords=/\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\b/i;
export const testDraftSchema=z.object({leakId:z.string().regex(/^[a-z_]{1,80}$/),answerIds:z.array(z.string().regex(/^[a-z_]{1,80}$/)).max(8),template:z.string().min(1).max(500),numbers:z.record(z.number().finite().min(-1e12).max(1e12))}).strict().superRefine((value,ctx)=>{if(Object.keys(value.numbers).length>16)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Too many engine numbers.'});});
const placeholders=(text:string)=>[...text.matchAll(/\{([a-z_]+)\}/g)].map(match=>match[1]);
const words=(text:string)=>text.replace(/\{[a-z_]+\}/g,'').trim().split(/\s+/).filter(Boolean);
/** Reject any new number, placeholder, cause or jargon before browser-side filling. */
export function validTestDraft(text:unknown,template:string):text is string {
 if(typeof text!=='string'||text!==text.trim()||text.length>500||!plainWords.test(text)||/\d/.test(text)||numberWords.test(text)||forbidden.test(text)||words(text).length>30)return false;
 const expected=placeholders(template),actual=placeholders(text);
 if(expected.length!==actual.length||expected.some((key,index)=>key!==actual[index]))return false;
 return true;
}
export function buildTestPrompt(input:z.infer<typeof testDraftSchema>) {
 const body=testDraftSchema.parse(input);
 return `Rewrite this seller test in at most 30 plain words. Keep exactly the same action and these placeholders in the same order: ${placeholders(body.template).map(key=>`{${key}}`).join(', ')||'none'}. Do not add or write numbers, causes, explanations, jargon, names, emails, item titles, links, or rows. Return only the sentence. Test: ${body.template}`;
}
export async function draftTest(input:z.infer<typeof testDraftSchema>,generate?:(prompt:string)=>Promise<string>):Promise<{sentence:string;source:'ai'|'template'}>{
 const body=testDraftSchema.parse(input),fallback={sentence:body.template,source:'template' as const};
 if(!generate&&(process.env.VERCEL||process.env.NODE_ENV==='production')&&process.env.AI_RATE_LIMIT_ENFORCED!=='true')return fallback;
 try {let call=generate;if(!call){const {selectModel}=await import('./ai-provider');const model=await selectModel();if(!model)return fallback;const {generateText}=await import('ai');call=async prompt=>{const out=await generateText({model,maxOutputTokens:100,maxRetries:0,prompt});if(out.finishReason!=='stop')throw new Error('Incomplete test draft');return out.text;};}
  const prompt=buildTestPrompt(body);for(let attempt=0;attempt<2;attempt++){const sentence=(await call(prompt)).trim();if(validTestDraft(sentence,body.template))return {sentence,source:'ai'};}
 }catch{/* The fixed playbook test is immediately usable when the model or allowance is unavailable. */}
 return fallback;
}
/** Browser-only substitution; model text never receives the seller's strings. */
export function fillValidatedTest(sentence:string,template:string,values:Record<string,string|number>):string|null {
 if(!validTestDraft(sentence,template))return null;
 return sentence.replace(/\{([a-z_]+)\}/g,(_,key:string,offset:number)=>{const value=values[key];if(typeof value!=='string'&&typeof value!=='number')return '';const text=String(value),prefix=sentence.slice(0,offset).trimEnd();return ['item','top_group'].includes(key)&&prefix&&!/[.!?]$/.test(prefix)?text[0].toLocaleLowerCase()+text.slice(1):text;});
}
