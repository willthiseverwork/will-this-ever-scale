import {NextResponse} from 'next/server';
import {readSandbox} from '../../../../lib/sandbox-read';
import {getDemoRead} from '../../../../lib/sandbox-status';
import {getSnapshotStatus} from '../../../../lib/demo-snapshot';
import {sameOrigin} from '../../../../lib/paypal-session';
import {readLimitedJson} from '../../../../lib/request';
import {hasPaidOrJudgeAccess} from '../../../../lib/access';
import {GET as demoSnapshot} from '../../demo-snapshot/route';
export const runtime='nodejs';
export const maxDuration=60;
export async function GET(){const snapshot=await getSnapshotStatus().catch(()=>({snapshotTime:null,snapshotOrderCount:null,lastRefresh:{ok:false,stage:'storage',code:'unavailable'}}));return NextResponse.json({...snapshot,deployment:process.env.VERCEL_DEPLOYMENT_ID||process.env.VERCEL_URL||'unknown',lastDemoRead:getDemoRead(),note:'lastDemoRead resets when the server instance changes'},{headers:{'Cache-Control':'no-store'}});}
export async function POST(r:Request){try{const body=await readLimitedJson(r.clone(),65536) as {source?:unknown};if(body?.source==='demo'){if(!sameOrigin(r)||!await hasPaidOrJudgeAccess(r))return NextResponse.json({error:'Access required.'},{status:403});return demoSnapshot(r);}}catch{}return readSandbox(r,false);}
