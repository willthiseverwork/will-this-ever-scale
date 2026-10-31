import {createHash,timingSafeEqual} from 'node:crypto';
import {NextResponse} from 'next/server';
import {generateText} from 'ai';
import {selectModel} from '../../../../lib/ai-provider';
import {analyze} from '../../../../lib/engine';
import {demoTransactions,DEMO_AS_OF} from '../../../../lib/demo';
import {readAggregate,buildReadPrompt,inspectReadValidation} from '../../../../lib/read';
import {buildGroupingPrompt,parseGroupingOutput,type ItemDescriptor} from '../../../../lib/item-grouping';
import {buildSuggestionPrompt,buildSuggestionTools,validateSelection} from '../../../../lib/ai-suggestions';

export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=30;
const headers={'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'};
function hidden(){return new Response(null,{status:404,headers});}
export async function GET(){return hidden();}
export async function OPTIONS(){return hidden();}
const allowedNames=new Set(['AccessDeniedException','UnrecognizedClientException','ExpiredTokenException','InvalidClientTokenId','ValidationException','ResourceNotFoundException','ThrottlingException','TooManyRequestsException','ServiceUnavailableException','ModelNotReadyException','ModelTimeoutException','AbortError','TimeoutError','AI_APICallError']);
const allowedStatuses=new Set([400,401,403,404,408,409,413,429,500,502,503,504]);
function sanitizeProviderMessage(text:string):string {
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
function failure(error:unknown){
 let name='unknown',status:number|undefined,requestId:string|undefined,message:string|undefined,current:unknown=error;
 try{for(let depth=0;depth<3&&current&&typeof current==='object';depth++){
  const e=current as {name?:unknown;statusCode?:unknown;responseHeaders?:unknown;responseBody?:unknown;cause?:unknown};
  if(typeof e.name==='string'&&allowedNames.has(e.name))name=e.name;
  if(typeof e.statusCode==='number'&&allowedStatuses.has(e.statusCode))status=e.statusCode;
  const h=e.responseHeaders;const get=(key:string):unknown=>h instanceof Headers?h.get(key):h&&typeof h==='object'?(h as Record<string,unknown>)[key]:undefined;
  const type=get('x-amzn-errortype');if(typeof type==='string'){const key=type.split(':',1)[0];if(allowedNames.has(key))name=key;}
  const id=get('x-amzn-requestid')??get('x-amzn-request-id');if(typeof id==='string'&&/^[a-f0-9-]{36}$/i.test(id))requestId=id;
  if(typeof e.responseBody==='string'&&e.responseBody.length<=8192){try{const body=JSON.parse(e.responseBody) as {message?:unknown;Message?:unknown};const value=body.message??body.Message;if(typeof value==='string')message=sanitizeProviderMessage(value);}catch{/* Never return an unparsed response. */}}
  current=e.cause;
 }}catch{/* Never return raw error objects or messages. */}
 return {outcome:'provider_error' as const,error_name:name,...(status===undefined?{}:{provider_status:status}),...(requestId?{request_id:requestId}:{}),...(message?{provider_message:message}:{})};
}
export async function POST(request:Request){
 const token=process.env.WTES_NOVA_TEST_TOKEN,expires=process.env.WTES_NOVA_TEST_EXPIRES_AT;
 const expiry=expires&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(expires)?Date.parse(expires):NaN;const now=Date.now();
 if(process.env.VERCEL_ENV!=='production'||process.env.AI_PROVIDER!=='bedrock'||process.env.WTES_BEDROCK_AUTH!=='vercel_oidc'||process.env.AWS_BEDROCK_REGION!=='us-east-1'||process.env.AWS_BEDROCK_MODEL!=='us.amazon.nova-2-lite-v1:0'||process.env.AI_RATE_LIMIT_ENFORCED!=='false'||!token||!/^[A-Za-z0-9_-]{32,128}$/.test(token)||!Number.isFinite(expiry)||expiry<=now||expiry-now>3600000)return hidden();
 if(new URL(request.url).search)return hidden();const stage=request.headers.get('x-wtes-stage');if(stage!=='read'&&stage!=='grouping'&&stage!=='suggestions')return hidden();
 const supplied=request.headers.get('authorization')?.match(/^Bearer ([A-Za-z0-9_-]{32,128})$/)?.[1];if(!supplied)return hidden();const hash=(v:string)=>createHash('sha256').update(v,'utf8').digest();if(!timingSafeEqual(hash(supplied),hash(token)))return hidden();
 const length=request.headers.get('content-length');if(request.headers.has('transfer-encoding')||(length!==null&&length!=='0'))return hidden();
 if(request.body){const reader=request.body.getReader();try{const part=await reader.read();if(!part.done){await reader.cancel();return hidden();}}finally{reader.releaseLock();}}
 try{
  const model=await selectModel();if(!model)return NextResponse.json({stage,outcome:'unavailable',reason:'configuration'},{headers});
  // Identical synthetic inputs to the browser's initial demo; never accept caller data.
  const aggregate=readAggregate(analyze(demoTransactions(),{monthlyAdSpend:0,asOf:DEMO_AS_OF,fixedFee:.49}));
  if(stage==='read'){
   const result=await generateText({model,prompt:buildReadPrompt(aggregate),maxOutputTokens:300,maxRetries:0,abortSignal:AbortSignal.timeout(25000)});
   const checks=inspectReadValidation(result.text,aggregate),piiPattern=/@|https?:\/\/|[A-Za-z0-9_-]{32,}/i.test(result.text);
   const finishReason=['stop','length','content-filter','tool-calls','error','other','unknown'].includes(result.finishReason)?result.finishReason:'unknown';
   if(!checks.numericValidation||piiPattern||finishReason!=='stop')return NextResponse.json({stage,outcome:'invalid_output',finishReason,textLength:result.text.length,numericValidation:checks.numericValidation,piiPattern,spelledNumberPattern:checks.spelledNumberPattern,numericTokenMismatch:checks.numericTokenMismatch},{headers});
   return NextResponse.json({stage,outcome:'validated',read_source:'model',read:result.text,aggregate,needs_factual_review:true},{headers});
  }
  if(stage==='grouping'){
   const fixture:ItemDescriptor[]=[{index:1,features:['silver','hoop','earring'],orders:3},{index:2,features:['silver','hoop','earring'],orders:2},{index:3,features:['ring','necklace'],orders:1}];
   const result=await generateText({model,prompt:buildGroupingPrompt(fixture),maxOutputTokens:300,maxRetries:0,abortSignal:AbortSignal.timeout(25000)});
   const {jsonParsed,schemaValid,mappings}=parseGroupingOutput(result.text,fixture);
   const expectedMappingMatch=!!mappings&&mappings.length===2&&[1,2].every(i=>mappings.some(m=>m.index===i&&m.group==='silver_hoops'))&&!mappings.some(m=>m.index===3);
   const finishReason=['stop','length','content-filter','tool-calls','error','other','unknown'].includes(result.finishReason)?result.finishReason:'unknown';
   const passed=finishReason==='stop'&&expectedMappingMatch;
   const metrics={finishReason,textLength:result.text.length,jsonParsed,schemaValid,expectedMappingMatch};
   return NextResponse.json(passed?{stage,outcome:'validated',mappings,...metrics}:{stage,outcome:'invalid_output',...metrics},{headers});
  }
  const result=await generateText({model,prompt:buildSuggestionPrompt(aggregate),tools:buildSuggestionTools(),toolChoice:'auto',maxOutputTokens:180,maxRetries:0,abortSignal:AbortSignal.timeout(25000)});
  const suggestion=validateSelection(result.toolCalls,aggregate);
  const finishReason=['stop','length','content-filter','tool-calls','error','other','unknown'].includes(result.finishReason)?result.finishReason:'unknown';
  const toolCallCount=Math.min(result.toolCalls.length,20),validated=!!suggestion;
  return NextResponse.json(suggestion?{stage,outcome:'validated',suggestion,finishReason,toolCallCount,validated}:{stage,outcome:'invalid_output',finishReason,toolCallCount,validated},{headers});
 }catch(error){return NextResponse.json({stage,...failure(error)},{headers});}
}
