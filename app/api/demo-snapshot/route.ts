import {after} from 'next/server';
import {getSnapshot,reserveRefresh,refreshSnapshot} from '../../../lib/demo-snapshot';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request){try{const snapshot=await getSnapshot();if(!snapshot||Date.now()-Date.parse(snapshot.at)>=900_000){after(async()=>{try{if(await reserveRefresh())await refreshSnapshot(new URL(request.url).origin)}catch{}});}return Response.json(snapshot?.data??{fallback:true},{headers:{'Cache-Control':'no-store'}})}catch{return Response.json({fallback:true},{headers:{'Cache-Control':'no-store'}})}}
