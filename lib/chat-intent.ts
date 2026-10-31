import {parseDataChatPlan} from './data-chat';
import type {DataChatPlan} from './data-chat-types';
import {z} from 'zod';
const vocab=['rank','item','gross','orders','refunds','fees','kept','compare','summary','whole','month','three_months'] as const;
export const intentInputSchema=z.object({tokens:z.array(z.enum(vocab)).min(1).max(12),months:z.array(z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)).max(12)}).strict().refine(v=>new Set(v.tokens).size===v.tokens.length&&new Set(v.months).size===v.months.length);
export type IntentInput=z.infer<typeof intentInputSchema>;
// These are semantic tokens only. Unknown words block the request rather than being copied, masked, or guessed.
const words:Record<string,typeof vocab[number]|'filler'>={which:'filler',what:'filler',was:'filler',were:'filler',the:'filler',my:'filler',me:'filler',show:'filler',tell:'filler',how:'filler',much:'filler',many:'filler',did:'filler',in:'filler',for:'filler',of:'filler',by:'filler',and:'filler',is:'filler',a:'filler',to:'filler',please:'filler',highest:'rank',biggest:'rank',top:'rank',popular:'rank',best:'rank',item:'item',items:'item',product:'item',products:'item',sales:'gross',revenue:'gross',gross:'gross',turnover:'gross',orders:'orders',order:'orders',refund:'refunds',refunds:'refunds',refunded:'refunds',fees:'fees',fee:'fees',kept:'kept',compare:'compare',versus:'compare',vs:'compare',difference:'compare',total:'summary',sum:'summary',all:'whole',data:'filler',time:'filler',month:'month',months:'month',last:'filler',this:'filler',three:'three_months'};
export function extractIntentInput(question:string,availableMonths:string[]):IntentInput|null {
 if(question.length>500||/[@/\\]|\b\d{4}-\d{2}-\d{2}\b/.test(question))return null;
 const found=question.toLowerCase().match(/\b\d{4}-(?:0[1-9]|1[0-2])\b/g)||[];
 const text=question.toLowerCase().replace(/\b\d{4}-(?:0[1-9]|1[0-2])\b/g,' ').replace(/[?!,.]/g,' ').trim();
 if(!text||/[^a-z\s]/.test(text))return null;
 const tokens=new Set<typeof vocab[number]>();for(const word of text.split(/\s+/)){if(!Object.hasOwn(words,word))return null;const token=words[word];if(token!=='filler')tokens.add(token);}
 const months=[...new Set(found)];if(months.some(m=>!availableMonths.includes(m)))return null;
 const result=intentInputSchema.safeParse({tokens:[...tokens],months});return result.success?result.data:null;
}
/** A valid shape is insufficient: the model may only choose metrics, operations and periods supported by supplied tokens. */
export function validateIntentPlan(value:unknown,input:IntentInput):DataChatPlan|null {
 const plan=parseDataChatPlan(value);if(!plan||plan.kind==='issues')return null;
 const t=new Set(input.tokens);if(!t.has(plan.metric)||(['gross','orders','refunds','fees','kept'] as const).filter(x=>t.has(x)).length!==1)return null;
 if(t.has('whole')&&input.months.length>0)return null;
 if(plan.kind==='rank_items'&&(!t.has('rank')||!t.has('item')||t.has('compare')))return null;
 if(plan.kind==='compare_months')return t.has('compare')&&input.months.length===2&&plan.months[0]===input.months[0]&&plan.months[1]===input.months[1]?plan:null;
 if(plan.kind==='summary'&&(t.has('rank')||t.has('compare')))return null;
 if(plan.period.kind==='whole')return t.has('whole')&&input.months.length===0?plan:null;
 if(plan.period.kind==='month')return input.months.length===1&&input.months[0]===plan.period.month?plan:null;
 return t.has('three_months')&&input.months.length===3&&plan.period.months.every((m,i)=>m===input.months[i])?plan:null;
}
