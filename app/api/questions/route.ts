import { readLimitedJson } from '../../../lib/request';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { questionsFor } from '../../../lib/playbook';
export async function POST(r:Request){try {const {leakId}=z.object({leakId:z.string().max(100)}).strict().parse(await readLimitedJson(r,1024));return NextResponse.json({questions:questionsFor(leakId)});}catch{return NextResponse.json({error:'Unknown playbook entry.'},{status:400});}}
