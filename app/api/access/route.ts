import {hasPaidOrJudgeAccess} from '../../../lib/access';
export const runtime='nodejs';
export async function GET(request:Request){return Response.json({allowed:await hasPaidOrJudgeAccess(request)},{headers:{'Cache-Control':'no-store'}});}
