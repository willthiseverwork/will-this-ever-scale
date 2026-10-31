import {sameOrigin,session} from '../../../../lib/workspace-auth';
import {startCheckout} from '../../../../lib/billing';
export const runtime='nodejs';
export async function POST(request:Request){if(!sameOrigin(request))return Response.json({error:'Invalid origin.'},{status:403});const user=session(request);if(!user)return Response.json({error:'Sign in required.'},{status:401});try{return Response.json(await startCheckout(user.userId),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Checkout is unavailable. If you already have a subscription, manage it from billing settings.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
