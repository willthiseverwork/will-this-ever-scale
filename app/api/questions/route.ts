import { NextResponse } from 'next/server'; import { z } from 'zod'; import { questionsFor } from '../../../lib/playbook';
export async function POST(r:Request){const {leakId}=z.object({leakId:z.string()}).parse(await r.json());return NextResponse.json({questions:questionsFor(leakId)});}
