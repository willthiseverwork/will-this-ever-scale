import {createHmac,timingSafeEqual} from 'node:crypto';
import {reminderNote} from './paypal-actions';
export type NoteSource='demo'|'connected'|'login';
// Whole grammatical sentences are the allowed unit, not a bag of safe words.
// Keep these patterns narrow: no names, claims, deadlines, amounts or links.
const notePattern=/^(?:Hi|Hello), (?:a|just a) (?:friendly|gentle|quick) reminder about your (?:custom )?order\. (?:You can pay (?:any time|whenever you are ready)|When you are ready, you can pay) (?:with|using) the (?:payment )?link in this email\. (?:Thank you|Thanks(?: for your support)?)[.!]$/i;
export function validReminderNote(text:unknown):text is string {
 if(typeof text!=='string'||!text.trim()||text!==text.trim()||text.length>240||/[^\x20-\x7e]|[\d@:/{}<>]/.test(text))return false;
 return notePattern.test(text);
}
/** The prompt is static: no seller data, rows, names, IDs or item labels. */
export function buildReminderPrompt(){return 'Write one warm invoice reminder in exactly three complete sentences, at most 240 characters. Follow this example: Hi, a friendly reminder about your order. You can pay any time with the link in this email. Thank you! You may replace Hi with Hello; friendly with gentle or quick; any time with whenever you are ready; the link with the payment link; and Thank you with Thanks for your support. Keep the sentence structure and meaning. Use a comma after the greeting and full stops after the reminder and payment sentences. Do not combine the example and variations into a word list. No names, numbers, dates, URLs, emoji, deadlines, urgency, discounts, payment-status claims, subject, explanation or quotation marks. Return only the three sentences.';}
export async function draftReminder(source:NoteSource,generate?:(prompt:string)=>Promise<string>):Promise<{note:string;source:'ai'|'template'}>{
 const fallback={note:reminderNote(source),source:'template' as const};
 // Demo runs never call a provider. A reviewed static cache can be added later.
 if(source==='demo')return fallback;
 if(!generate&&(process.env.VERCEL||process.env.NODE_ENV==='production')&&process.env.AI_RATE_LIMIT_ENFORCED!=='true')return fallback;
 try{
  let call=generate;
  if(!call){const {selectModel}=await import('./ai-provider');const model=await selectModel();if(!model)return fallback;const {generateText}=await import('ai');call=async prompt=>{const result=await generateText({model,maxOutputTokens:120,maxRetries:0,prompt});if(result.finishReason!=='stop')throw new Error('Incomplete reminder draft');return result.text;};}
  const prompt=buildReminderPrompt();for(let attempt=0;attempt<2;attempt++){const note=(await call(prompt)).trim();if(validReminderNote(note))return {note,source:'ai'};}
 }catch{/* Model and budget failures keep the immediately available fixed text. */}
 return fallback;
}
export function signReminderNote(note:string,source:NoteSource,secret:string,now=Date.now()){
 if(!validReminderNote(note)||Buffer.byteLength(secret)<32)throw new Error('Invalid reminder draft');
 const payload=Buffer.from(JSON.stringify({version:1,purpose:'reminder-note',source,note,expires:now+300000})).toString('base64url');return payload+'.'+createHmac('sha256',secret).update('reminder-note:'+payload).digest('base64url');
}
export function verifyReminderNote(token:string,source:NoteSource,secret:string,now=Date.now()):string|undefined{
 try{const [payload,signature,...extra]=token.split('.');if(extra.length||!payload||!signature||payload.length>2048)return;const expected=createHmac('sha256',secret).update('reminder-note:'+payload).digest(),actual=Buffer.from(signature,'base64url');if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return;const data=JSON.parse(Buffer.from(payload,'base64url').toString());if(data.version!==1||data.purpose!=='reminder-note'||data.source!==source||!Number.isSafeInteger(data.expires)||data.expires<now||data.expires>now+300000||!validReminderNote(data.note))return;return data.note;}catch{return;}
}
