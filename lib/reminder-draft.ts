import {createHmac,timingSafeEqual} from 'node:crypto';
import {reminderNote} from './paypal-actions';
export type NoteSource='demo'|'connected';
// Restrict output to an audited, ordinary vocabulary. This prevents names,
// links, amounts, deadlines, pressure, or new product claims from entering a note.
const vocabulary=new Set(('hi hello a friendly gentle quick reminder about your custom order you can pay any time with the payment link in this email thank thanks for support whenever are ready just sending an is to and').split(' '));
export function validReminderNote(text:unknown):text is string {
 if(typeof text!=='string'||!text.trim()||text!==text.trim()||text.length>240||/[^\x20-\x7e]|[\d@:/{}<>]/.test(text))return false;
 if(!/\breminder\b/i.test(text)||!(/\b(?:pay|payment)\b/i.test(text)&&/\blink\b/i.test(text)&&/\bemail\b/i.test(text)))return false;
 const words=text.match(/[A-Za-z]+/g)||[];if(!words.length||words.some(word=>!vocabulary.has(word.toLowerCase())))return false;
 return !/\b(?:no\s+payment|no\s+pay|no\s+link|no\s+email|not\s+pay|ignore\s+(?:the\s+)?(?:payment|link))\b/i.test(text);
}
/** The prompt is static: no seller data, rows, names, IDs or item labels. */
export function buildReminderPrompt(){return 'Write only a warm, plain invoice reminder, at most 240 characters. Remind the buyer about their order and say they can pay with the link in this email. No names, numbers, dates, links, emoji, deadlines, urgency, pressure, discounts, or claims about payment status. Use only these ordinary words: '+[...vocabulary].join(', ')+'. Do not add a subject, explanation, quotation marks, or any other text.';}
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
