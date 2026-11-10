import {after} from 'next/server';
import {attemptRefresh,getSnapshot,recordRefreshFailure} from '../../../lib/demo-snapshot';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(request:Request){try{const snapshot=await getSnapshot();if(!snapshot||Date.now()-Date.parse(snapshot.at)>=900_000){const origin=new URL(request.url).origin;try{after(()=>attemptRefresh(origin,snapshot?.at??null))}catch{await recordRefreshFailure('schedule','unavailable')}}return Response.json(snapshot?.data??{fallback:true},{headers:{'Cache-Control':'no-store'}})}catch{await recordRefreshFailure('storage','unavailable');return Response.json({fallback:true},{headers:{'Cache-Control':'no-store'}})}}
