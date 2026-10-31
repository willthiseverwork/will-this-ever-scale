import {reserveAiBudget,type BudgetResult} from './ai-budget';

const MODEL='us.amazon.nova-2-lite-v1:0';
type Reserve=()=>Promise<BudgetResult>;
/** Restrict the billable boundary, including future callers and SDK transport retries. */
export function budgetedNovaFetch(fetchImpl:typeof fetch=fetch,reserve:Reserve=reserveAiBudget):typeof fetch {
 return async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  const method=init?.method??(input instanceof Request?input.method:'GET');
  const body=init?.body;
  if(url.origin!=='https://bedrock-runtime.us-east-1.amazonaws.com'||decodeURIComponent(url.pathname)!==`/model/${MODEL}/converse`||url.search||method!=='POST'||typeof body!=='string'||new TextEncoder().encode(body).byteLength>12000)throw new Error('AI request exceeds the configured limits.');
  const request=JSON.parse(body) as Record<string,unknown>;
  const config=request.inferenceConfig as {maxTokens?:number}|undefined;
  const extra=request.additionalModelRequestFields as {reasoningConfig?:{type?:string}}|undefined;
  const tier=request.serviceTier as {type?:string}|undefined;
  const keys=new Set(['system','messages','inferenceConfig','toolConfig','additionalModelRequestFields','serviceTier']);
  if(Object.keys(request).some(key=>!keys.has(key))||!Number.isInteger(config?.maxTokens)||config!.maxTokens!<1||config!.maxTokens!>300||(tier&&tier.type!=='default')||(extra&&Object.keys(extra).some(key=>key!=='reasoningConfig'))||(extra?.reasoningConfig&&extra.reasoningConfig.type!=='disabled'))throw new Error('AI request exceeds the configured limits.');
  // Only text and static tool schemas are used. Reject separately loaded media or
  // external input whose tokens could exceed the bounded request body.
  const messages=request.messages;
  if(!Array.isArray(messages)||messages.some(message=>!message||!Array.isArray(message.content)||message.content.some((part:unknown)=>!part||typeof part!=='object'||Object.keys(part).some(key=>key!=='text')||typeof (part as {text?:unknown}).text!=='string')))throw new Error('AI request exceeds the configured limits.');
  const result=await reserve();
  if(!result.allowed){console.info('ai_budget',{status:result.reason});throw new Error('AI allowance is unavailable.');}
  console.info('ai_budget',{status:'reserved'});
  return fetchImpl(input,init);
 };
}
