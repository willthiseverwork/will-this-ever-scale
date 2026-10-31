import {NextResponse} from 'next/server';
import {z} from 'zod';
import {readLimitedJson} from '../../../../lib/request';
import {sameOrigin} from '../../../../lib/paypal-session';
import {authorizeAction,ActionRequestError} from '../../../../lib/action-request';
import {stopAction} from '../../../../lib/paypal-batch';
export const runtime='nodejs';
export async function POST(r:Request){if(!sameOrigin(r))return NextResponse.json({error:'Invalid request origin.'},{status:403});try{const b=z.object({proposalId:z.string().regex(/^[a-f0-9]{64}$/)}).strict().parse(await readLimitedJson(r,4096));const {secret}=await authorizeAction(r,b.proposalId);return NextResponse.json(await stopAction(b.proposalId,secret),{headers:{'Cache-Control':'no-store'}});}catch(error){return NextResponse.json({error:error instanceof ActionRequestError?error.message:'Could not confirm the stop. Keep this page open and check PayPal.'},{status:error instanceof ActionRequestError?error.status:503});}}
