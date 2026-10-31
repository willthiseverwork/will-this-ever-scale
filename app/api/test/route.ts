import { NextResponse } from 'next/server';
// Playbook evaluation runs in the browser, where item titles and engine results remain private.
export async function POST(){return NextResponse.json({error:'Run playbook tests locally.'},{status:410});}
