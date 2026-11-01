import {session} from '../../../lib/workspace-auth';
import {billingTestConfig,billingTestAuthorized,testTrial,withBillingTest} from '../../../lib/billing-test-context';
import {billingStatus,checkoutEligible,testPaymentLink} from '../../../lib/billing';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){const user=session(request),c=billingTestConfig();if(!c||!billingTestAuthorized(user?.userId))return Response.json({error:'Not found.'},{status:404,headers});try{return await withBillingTest(c,async()=>{const status=await billingStatus(c.owner),trial=await testTrial(c),paymentLink=await testPaymentLink();return Response.json({...status,paymentLink,phase:c.phase,trial:trial?{...trial,active:Date.now()<Date.parse(trial.endsAt)}:null,canStartTrial:!trial,canCheckout:checkoutEligible(trial?.endsAt||null)&&(!status.canManage||status.status==='canceled')},{headers});});}catch{return Response.json({error:'Sandbox billing unavailable.'},{status:503,headers});}}
