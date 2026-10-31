import { NextResponse } from 'next/server';
import { z } from 'zod';
import { readLimitedJson } from '../../../lib/request';
import { templateSuggestions, suggestActions } from '../../../lib/ai-suggestions';
import { descriptorListSchema, groupItems } from '../../../lib/item-grouping';
import { aggregateSchema, makeReadWithSource, templateRead } from '../../../lib/read';
import { demoReadWithSource } from '../../../lib/demo-cache';
import { demoTransactions, DEMO_AS_OF } from '../../../lib/demo';
import { analyze } from '../../../lib/engine';

const body=z.discriminatedUnion('source',[
  z.object({source:z.literal('aggregate'),aggregate:aggregateSchema}).strict(),
  z.object({source:z.literal('demo')}).strict(),
  z.object({source:z.literal('grouping'),descriptors:descriptorListSchema}).strict(),
]);
// A process-local safeguard, not a distributed limit across serverless instances.
const requests=new Map<string,number[]>();
export async function POST(request:Request) {
  try {
    const b=body.parse(await readLimitedJson(request,16000));
    if(b.source==='demo') {const analysis=analyze(demoTransactions(),{asOf:DEMO_AS_OF,fixedFee:.49,monthlyAdSpend:0});return NextResponse.json({...demoReadWithSource(analysis),suggestions:[]});}
    // Serverless instances cannot share this counter. Fail closed to the free template
    // until a shared atomic limiter is configured; do not risk unbounded AI spend.

    // In local development all requests share a conservative bucket.
    const ip=process.env.VERCEL ? (request.headers.get('x-vercel-forwarded-for')?.split(',')[0].trim()||'unknown') : 'unknown';
    const now=Date.now(), recent=(requests.get(ip)||[]).filter(t=>now-t<3600000);
    if(recent.length>=10) return NextResponse.json({error:'Too many requests. Please try again later.'},{status:429});
    recent.push(now); requests.set(ip,recent);
    const disabled=(process.env.VERCEL || process.env.NODE_ENV==='production') && process.env.AI_RATE_LIMIT_ENFORCED!=='true';
    if(b.source==='grouping')return NextResponse.json(disabled?{mappings:[],source:'template'}:await groupItems(b.descriptors));
    if(disabled)return NextResponse.json({read:templateRead(b.aggregate),read_source:'template',suggestions:templateSuggestions(b.aggregate)});
    const [result,suggestions]=await Promise.all([makeReadWithSource(b.aggregate),suggestActions(b.aggregate)]);
    return NextResponse.json({...result,suggestions});
  } catch { return NextResponse.json({error:'Invalid aggregate request.'},{status:400}); }
}
