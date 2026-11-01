import {sameOrigin,session} from '../../../../lib/workspace-auth';
import {billingTestConfig,billingTestAuthorized,saveTestTrial} from '../../../../lib/billing-test-context';
export const runtime='nodejs';
export async function POST(request:Request){const u=session(request),c=billingTestConfig();if(!c||!billingTestAuthorized(u?.userId))return Response.json({error:'Not found.'},{status:404});if(!sameOrigin(request))return Response.json({error:'Invalid origin.'},{status:403});try{return Response.json({trial:await saveTestTrial(c)},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Synthetic trial unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
