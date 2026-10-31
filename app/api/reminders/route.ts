import { NextResponse } from 'next/server'; import { z } from 'zod';
// Do not write an email to a publicly readable Blob. This endpoint stays deliberately off
// until a private encrypted reminder store is wired into the Vercel project.
export async function POST(r:Request){z.object({email:z.string().email(),leakId:z.string(),date:z.string()}).parse(await r.json());return NextResponse.json({error:'Reminders are waiting for private storage configuration.'},{status:503});}
