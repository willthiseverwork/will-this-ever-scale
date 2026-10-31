import {sameOrigin,session} from '../../../../lib/workspace-auth';
import {portalUrl} from '../../../../lib/billing';
export const runtime='nodejs';
export async function POST(request:Request){if(!sameOrigin(request))return Response.json({error:'Invalid origin.'},{status:403});const user=session(request);if(!user)return Response.json({error:'Sign in required.'},{status:401});try{return Response.json({url:await portalUrl(user.userId)},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Subscription management is unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
