import {createHash,timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {generateText} from 'ai';
import {selectModel} from '../../../../lib/ai-provider';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=25;
// Best-effort per-instance guard only. This is not a distributed one-use lock.
let used=false;
const privateHeaders={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
function hidden(){return new Response(null,{status:404,headers:privateHeaders});}
export async function GET(){return hidden();}
export async function OPTIONS(){return hidden();}
const names=new Set(['AccessDeniedException','UnrecognizedClientException','ExpiredTokenException','InvalidClientTokenId','ValidationException','ResourceNotFoundException','ThrottlingException','TooManyRequestsException','ServiceUnavailableException','ModelNotReadyException','ModelTimeoutException','AbortError','TimeoutError','AI_APICallError']);
const statuses=new Set([400,401,403,404,408,409,413,429,500,502,503,504]);
function sanitize(text:string):string {
 return text.slice(0,2048)
  .replace(/https?:\/\/[^\s"'<>]+/gi,'[url]')
  .replace(/arn:[a-z0-9-]+:[^\s"'<>]+/gi,'[arn]')
  .replace(/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,'[access-key]')
  .replace(/\bBearer\s+[^\s,;]+/gi,'[bearer]')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]')
  .replace(/\b\d{12,}\b/g,'[number]')
  .replace(/\b[A-Za-z0-9_\-]{32,}\b/g,'[token]')
  .replace(/[\x00-\x1f\x7f]/g,' ').slice(0,300);
}
function details(error:unknown){
 let current:unknown=error, status:number|undefined, errorName='unknown',requestId:string|undefined,message:string|undefined;
 try {for(let depth=0;depth<3&&current&&typeof current==='object';depth++){
  const e=current as {name?:unknown;statusCode?:unknown;responseHeaders?:unknown;responseBody?:unknown;cause?:unknown};
  if(typeof e.name==='string'&&names.has(e.name))errorName=e.name;
  if(typeof e.statusCode==='number'&&statuses.has(e.statusCode))status=e.statusCode;
  const headers=e.responseHeaders;const get=(key:string):unknown=>headers instanceof Headers?headers.get(key):headers&&typeof headers==='object'?(headers as Record<string,unknown>)[key]:undefined;
  const id=get('x-amzn-requestid')??get('x-amzn-request-id');if(typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id))requestId=id;
  const type=get('x-amzn-errortype');if(typeof type==='string'){const name=type.split(':',1)[0];if(names.has(name))errorName=name;}
  if(typeof e.responseBody==='string'&&e.responseBody.length<=8192){try{const body=JSON.parse(e.responseBody) as {message?:unknown;Message?:unknown};const value=body.message??body.Message;if(typeof value==='string')message=sanitize(value);}catch{/* Never return an unparsed response. */}}
  current=e.cause;
 }}catch{/* Ignore untrusted error shapes. */}
 const lower=(message||'').toLowerCase();
 const reason=/marketplace|subscription|agreement|payment method/.test(lower)?'model_agreement':/use case|first.time|ftu/.test(lower)?'provider_prerequisite':/region/.test(lower)?'region':/not authorized|not authorised|permission|explicit deny|identity.based policy/.test(lower)?'authorization':errorName==='ThrottlingException'?'throttled':errorName==='TimeoutError'||errorName==='AbortError'?'timeout':'unknown';
 return {outcome:'failed' as const,error_name:errorName,reason,...(status===undefined?{}:{provider_status:status}),...(requestId?{request_id:requestId}:{}),...(message?{provider_message:message}:{})};
}
export async function POST(request:Request){
 const secret=process.env.WTES_DIAGNOSTIC_TOKEN,expires=process.env.WTES_DIAGNOSTIC_EXPIRES_AT;
 const expiresAt=expires&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(expires)?Date.parse(expires):NaN;
 const now=Date.now();
 if(process.env.VERCEL_ENV!=='production'||process.env.AI_PROVIDER!=='bedrock'||process.env.WTES_BEDROCK_AUTH!=='vercel_oidc'||process.env.AI_RATE_LIMIT_ENFORCED!=='false'||!secret||!/^[A-Za-z0-9_-]{32,128}$/.test(secret)||!Number.isFinite(expiresAt)||expiresAt<=now||expiresAt-now>300000||used)return hidden();
 if(new URL(request.url).search)return hidden();
 const supplied=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1];if(!supplied)return hidden();
 const hash=(value:string)=>createHash('sha256').update(value,'utf8').digest();if(!timingSafeEqual(hash(supplied),hash(secret)))return hidden();
 // Reject any content and streamed/unknown-length body before making a provider call.
 const length=request.headers.get('content-length');if(request.headers.has('transfer-encoding')||(length!==null&&length!=='0'))return hidden();
 if(request.body){const reader=request.body.getReader();try{const part=await reader.read();if(!part.done&&part.value.byteLength>0){await reader.cancel();return hidden();}}finally{reader.releaseLock();}}
 if(used)return hidden();used=true;
 try{const model=await selectModel();if(!model)return NextResponse.json({outcome:'unavailable',reason:'configuration'},{headers:privateHeaders});
  await generateText({model,prompt:'Reply with OK.',providerOptions:{bedrock:{reasoningConfig:{type:'disabled'}}},maxOutputTokens:40,maxRetries:0,abortSignal:AbortSignal.timeout(20000)});
  return NextResponse.json({outcome:'success'},{headers:privateHeaders});
 }catch(error){return NextResponse.json(details(error),{headers:privateHeaders});}
}
