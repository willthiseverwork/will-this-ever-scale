import {beginLogin} from '../../../../lib/workspace-auth';
import {storageConfigured} from '../../../../lib/workspace-store';
export const runtime='nodejs';
export async function GET(request:Request){try{if(!storageConfigured())throw new Error();const x=beginLogin(new URL(request.url).searchParams.get('next')||undefined);return new Response(null,{status:302,headers:{Location:x.url,'Set-Cookie':x.cookie,'Cache-Control':'no-store'}});}catch{return Response.json({error:'Account setup is incomplete.'},{status:503,headers:{'Cache-Control':'no-store'}});}}
