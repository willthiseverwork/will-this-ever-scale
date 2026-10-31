import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readLimitedJson } from '../../../lib/request';
import { aggregateSchema, makeRead, templateRead } from '../../../lib/read';

const body=z.discriminatedUnion('source',[
  z.object({source:z.literal('aggregate'),aggregate:aggregateSchema}).strict(),
  z.object({source:z.literal('demo')}).strict(),
]);
// A process-local safeguard, not a distributed limit across serverless instances.
const requests=new Map<string,number[]>();
export async function POST(request:Request) {
  try {
    const b=body.parse(await readLimitedJson(request,16000));
    if(b.source==='demo') return NextResponse.json({read:'This is a sample shop. The figures below show where money went and where a small test may help.'});
    // Serverless instances cannot share this counter. Fail closed to the free template
    // until a shared atomic limiter is configured; do not risk unbounded AI spend.
    if((process.env.VERCEL || process.env.NODE_ENV==='production') && process.env.AI_RATE_LIMIT_ENFORCED!=='true') return NextResponse.json({read:templateRead(b.aggregate)});
    // In local development all requests share a conservative bucket.
    const ip=process.env.VERCEL ? (request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim()||'unknown') : 'unknown';
    const now=Date.now(), recent=(requests.get(ip)||[]).filter(t=>now-t<3600000);
    if(recent.length>=10) return NextResponse.json({error:'Too many requests. Please try again later.'},{status:429});
    recent.push(now); requests.set(ip,recent);
    return NextResponse.json({read:await makeRead(b.aggregate)});
  } catch { return NextResponse.json({error:'Invalid aggregate request.'},{status:400}); }
}
