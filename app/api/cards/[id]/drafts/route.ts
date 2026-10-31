import {NextResponse} from 'next/server';
import {z} from 'zod';
import {sameOrigin} from '../../../../../lib/paypal-session';
import {readLimitedJson} from '../../../../../lib/request';
import {cardDrafts} from '../../../../../lib/card-drafts';
export async function POST(request:Request,context:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return NextResponse.json({error:'Invalid request origin.'},{status:403});
 try{z.object({source:z.enum(['demo','connected'])}).strict().parse(await readLimitedJson(request,1024));const {id}=await context.params;const drafts=cardDrafts(id);if(!drafts.length)return NextResponse.json({error:'Draft help is not available for this card yet.'},{status:404});return NextResponse.json({source:'template',drafts,notice:id==='one_time_buyers'?'Use the first message only for people who joined your list or follow your shop. Complete the link before using the draft.':'Replace the item and link placeholders with the pairs your buyers chose.'},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Invalid draft request. Keep item names and customer details in your browser.'},{status:400});}
}
