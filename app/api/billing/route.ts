import {session} from '../../../lib/workspace-auth';
import {billingStatus} from '../../../lib/billing';
import {getWorkspace,storageConfigured} from '../../../lib/workspace-store';
export const runtime='nodejs';
export async function GET(request:Request){const user=session(request);if(!user)return Response.json({error:'Sign in required.'},{status:401,headers:{'Cache-Control':'no-store'}});try{const billing=await billingStatus(user.userId);if(!storageConfigured())return Response.json({...billing,trial:null},{headers:{'Cache-Control':'no-store'}});const w=await getWorkspace(user.userId);return Response.json({...billing,trial:w.trialStartedAt?{startedAt:w.trialStartedAt,endsAt:w.trialEndsAt,active:Date.now()<Date.parse(w.trialEndsAt!)}:null},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Billing status unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
