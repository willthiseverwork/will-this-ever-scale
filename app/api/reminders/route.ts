import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readLimitedJson } from '../../../lib/request';
import { randomUUID } from 'node:crypto';
import playbook from '../../../playbook.json';
const schema=z.object({email:z.string().trim().email().max(254),leakId:z.string().refine(id=>playbook.leaks.some(l=>l.id===id)),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),consent:z.literal(true)}).strict();
export async function POST(r:Request){
  try {
    const data=schema.parse(await readLimitedJson(r,2048)); const date=new Date(`${data.date}T00:00:00Z`);
    if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,10)!==data.date||date.valueOf()<Date.now()-86400000||date.valueOf()>Date.now()+366*86400000) return NextResponse.json({error:'Choose a valid upcoming date.'},{status:400});
    if(!process.env.BLOB_READ_WRITE_TOKEN) return NextResponse.json({error:'Reminder storage is unavailable. Use the calendar download instead.'},{status:503});
    const {put}=await import('@vercel/blob');
    await put(`reminders/${randomUUID()}.json`,JSON.stringify({email:data.email,leakId:data.leakId,date:data.date}),{access:'private',addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'});
    return NextResponse.json({saved:true,delivery:'not_configured'});
  } catch {return NextResponse.json({error:'Could not save the reminder. Use the calendar download instead.'},{status:400});}
}
