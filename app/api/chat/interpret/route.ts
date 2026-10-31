import {createHmac} from 'node:crypto';
import {ActionConflict,actionStore} from '../../../../lib/action-store';
import {readLimitedJson} from '../../../../lib/request';
import {intentInputSchema,validateIntentPlan} from '../../../../lib/chat-intent';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
async function reserve(request:Request,secret:string){
 const store=actionStore(),ip=request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||'shared';
 const bucket=createHmac('sha256',secret).update(ip).digest('hex');const path=`chat-intent-rate/${Math.floor(Date.now()/60000)}-${bucket}.json`;
 for(let n=0;n<4;n++){try{const old=await store.read(path);if(!old){await store.create(path,JSON.stringify({count:1}));return true;}const value=JSON.parse(old.body);if(!Number.isSafeInteger(value.count)||value.count<1||value.count>6)throw new Error('Invalid limit');if(value.count>=6)return false;await store.replace(path,JSON.stringify({count:value.count+1}),old.etag);return true;}catch(e){if(e instanceof ActionConflict)continue;throw e;}}return false;
}
export async function POST(request:Request){
 const fail=(status:number)=>Response.json({error:'Interpretation unavailable. Your question can still be answered locally when supported.'},{status,headers});
 try{
  const origin=process.env.WTES_APP_ORIGIN;if(!origin||request.headers.get('origin')!==origin)return fail(403);
  const data=intentInputSchema.safeParse(await readLimitedJson(request,2048));if(!data.success)return fail(400);
  const secret=process.env.PAYPAL_ACTION_SIGNING_SECRET;
  if(!secret||Buffer.byteLength(secret)<32||!process.env.BLOB_READ_WRITE_TOKEN||process.env.AI_RATE_LIMIT_ENFORCED!=='true'||process.env.VERCEL_ENV!=='production'||(process.env.AI_PROVIDER||'bedrock')!=='bedrock'||process.env.WTES_BEDROCK_AUTH!=='vercel_oidc'||process.env.AWS_BEDROCK_REGION!=='us-east-1'||process.env.AWS_BEDROCK_MODEL!=='us.amazon.nova-2-lite-v1:0')return fail(503);
  if(!await reserve(request,secret))return fail(429);
  const {selectModel}=await import('../../../../lib/ai-provider');const model=await selectModel();if(!model)return fail(503);
  const {generateText}=await import('ai');const result=await generateText({model,maxOutputTokens:200,maxRetries:0,abortSignal:AbortSignal.timeout(12000),system:'Interpret only the supplied semantic tokens. Return one JSON object only. Allowed plans: {"kind":"rank_items","metric":"gross|orders|refunds","period":{"kind":"whole"} or {"kind":"month","month":"YYYY-MM"} or {"kind":"three_months","months":[three IDs]}}; {"kind":"summary","metric":"gross|orders|refunds|fees|kept","period":same}; {"kind":"compare_months","metric":"gross|orders|refunds|fees|kept","months":[two IDs]}. Use only supplied metric and period IDs; if unclear output {}. Do not invent data or actions.',prompt:JSON.stringify(data.data)});
  if(result.finishReason!=='stop')return fail(503);let value:unknown;try{value=JSON.parse(result.text)}catch{return fail(503)}const plan=validateIntentPlan(value,data.data);return plan?Response.json({plan,source:'ai'},{headers}):fail(422);
 }catch{return fail(503)}
}
