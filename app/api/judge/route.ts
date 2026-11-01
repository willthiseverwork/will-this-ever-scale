import {judgeCodeMatches,judgeCookie} from '../../../lib/access';
import {sameOrigin} from '../../../lib/workspace-auth';
export const runtime='nodejs';
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Invalid origin.'},{status:403});
 try{const body=await request.json();if(!judgeCodeMatches(body?.code))return Response.json({error:'That code is not valid.'},{status:401});return Response.json({ok:true},{headers:{'Set-Cookie':judgeCookie(),'Cache-Control':'no-store'}});}catch{return Response.json({error:'Judge access is unavailable.'},{status:503});}
}
