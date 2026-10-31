import {NextResponse} from 'next/server';
import {authorizeAction,ActionRequestError} from '../../../../lib/action-request';
import {actionView} from '../../../../lib/paypal-batch';
export const runtime='nodejs';
/** Observation only. Polling can never dispatch a PayPal write. */
export async function GET(r:Request){try{const id=new URL(r.url).searchParams.get('proposalId')||'';if(!/^[a-f0-9]{64}$/.test(id))return NextResponse.json({error:'Invalid proposal.'},{status:400});const {record}=await authorizeAction(r,id);return NextResponse.json(record.steps.length?actionView(record):record.otherResult||{status:record.otherStarted?'unknown':'pending',steps:[]},{headers:{'Cache-Control':'no-store'}});}catch(error){return NextResponse.json({error:error instanceof ActionRequestError?error.message:'Action status is unavailable. Check PayPal before retrying.'},{status:error instanceof ActionRequestError?error.status:503});}}
