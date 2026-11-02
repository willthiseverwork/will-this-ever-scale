import {createHmac} from 'node:crypto';
import {session} from '../../../../lib/workspace-auth';

export const runtime='nodejs';

/** A stable browser-only derivation key for pseudonymous CSV join fields.
 * It is derived per signed-in user and never logged or stored as plaintext. */
export async function GET(request:Request){
 const s=session(request),secret=process.env.WTES_WORKSPACE_SECRET;
 if(!s)return Response.json({error:'Sign in required.'},{status:401,headers:{'Cache-Control':'no-store'}});
 if(!secret||Buffer.byteLength(secret)<32)return Response.json({error:'Private storage is unavailable.'},{status:503,headers:{'Cache-Control':'no-store'}});
 const salt=createHmac('sha256',secret).update(`wtes-upload-salt:${s.userId}`).digest('base64url');
 return Response.json({salt},{headers:{'Cache-Control':'no-store'}});
}
