import {sameOrigin,session} from '../../../../lib/workspace-auth';
import {billingTestConfig,billingTestAuthorized,withBillingTest} from '../../../../lib/billing-test-context';
import {portalUrl} from '../../../../lib/billing';
export const runtime='nodejs';
export async function POST(request:Request){const u=session(request),c=billingTestConfig();if(!c||!billingTestAuthorized(u?.userId))return Response.json({error:'Not found.'},{status:404});if(!sameOrigin(request))return Response.json({error:'Invalid origin.'},{status:403});try{return await withBillingTest(c,async()=>Response.json({url:await portalUrl(c.owner)},{headers:{'Cache-Control':'no-store'}}));}catch{return Response.json({error:'Sandbox portal unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
