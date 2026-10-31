import {NextResponse} from 'next/server';
import {z} from 'zod';
import {sameOrigin} from '../../../../lib/paypal-session';
import {readLimitedJson} from '../../../../lib/request';
import {reserveSandboxRequest} from '../../../../lib/action-store';
import {reminderNote} from '../../../../lib/paypal-actions';
import {draftReminder,signReminderNote} from '../../../../lib/reminder-draft';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});
 try{
  const {source}=z.object({source:z.enum(['demo','connected'])}).strict().parse(await readLimitedJson(request,1024));
  const fallback={note:reminderNote(source),source:'template' as const};
  if(source==='demo')return NextResponse.json(fallback,{headers:{'Cache-Control':'no-store'}});
  const secret=process.env.PAYPAL_ACTION_SIGNING_SECRET;
  if(!secret||Buffer.byteLength(secret)<32)return NextResponse.json(fallback,{headers:{'Cache-Control':'no-store'}});
  try{if(!await reserveSandboxRequest(request,'draft',secret))return NextResponse.json(fallback,{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json(fallback,{headers:{'Cache-Control':'no-store'}});}
  const result=await draftReminder(source);return NextResponse.json({...result,...(result.source==='ai'?{noteToken:signReminderNote(result.note,source,secret)}:{})},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Invalid reminder draft request.'},{status:400});}
}
