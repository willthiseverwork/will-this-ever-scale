import {hasPaidOrJudgeAccess} from '../../../../lib/access';
import { readLimitedJson } from '../../../../lib/request';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { sameOrigin } from '../../../../lib/paypal-session';
import { authorizeAction,actionCredentials,ActionRequestError } from '../../../../lib/action-request';
import { advanceAction } from '../../../../lib/paypal-batch';
export const runtime='nodejs';
export const maxDuration=60;
export async function POST(r:Request){if(!sameOrigin(r))return NextResponse.json({error:'Invalid request origin.'},{status:403});try{const b=z.object({proposalId:z.string().regex(/^[a-f0-9]{64}$/),approved:z.literal(true),index:z.number().int().min(0).max(19).optional()}).strict().parse(await readLimitedJson(r,4096));const {secret,approval}=await authorizeAction(r,b.proposalId);if(approval.source==='demo'&&!await hasPaidOrJudgeAccess(r))return NextResponse.json({error:'Judges: enter your code to try this in PayPal.'},{status:403});const c=actionCredentials(approval.source,approval.session);return NextResponse.json(await advanceAction(b.proposalId,b.index,c,secret),{headers:{'Cache-Control':'no-store'}});}catch(error){return NextResponse.json({error:error instanceof ActionRequestError?error.message:'The result is unknown. Check PayPal before trying again.'},{status:error instanceof ActionRequestError?error.status:503,headers:{'Cache-Control':'no-store'}});}}
