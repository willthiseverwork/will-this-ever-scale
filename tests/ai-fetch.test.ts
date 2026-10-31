import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetedNovaFetch} from '../lib/ai-fetch';
const url='https://bedrock-runtime.us-east-1.amazonaws.com/model/us.amazon.nova-2-lite-v1%3A0/converse';
const command={messages:[{role:'user',content:[{text:'Describe these totals.'}]}],inferenceConfig:{maxTokens:300}};
test('every allowed provider invocation reserves before transport; denied allowance never calls provider',async()=>{
 const events:string[]=[];const guarded=budgetedNovaFetch((async()=>{events.push('transport');return new Response('{}');}) as typeof fetch,async()=>{events.push('reserve');return {allowed:true,reason:'reserved'};});
 await guarded(url,{method:'POST',body:JSON.stringify(command)});await guarded(url,{method:'POST',body:JSON.stringify(command)});assert.deepEqual(events,['reserve','transport','reserve','transport']);
 const denied=budgetedNovaFetch((async()=>{throw new Error('must not call');}) as typeof fetch,async()=>({allowed:false,reason:'exhausted'}));await assert.rejects(()=>denied(url,{method:'POST',body:JSON.stringify(command)}),/allowance/);
});
test('unbounded, other-model, media, reasoning and premium-tier calls cannot consume budget or invoke model',async()=>{
 let reserved=0;const guarded=budgetedNovaFetch((async()=>{throw new Error('must not call');}) as typeof fetch,async()=>{reserved++;return {allowed:true,reason:'reserved'};});
 const bad=[{...command,inferenceConfig:{maxTokens:301}},{...command,inferenceConfig:{}},{...command,additionalModelRequestFields:{reasoningConfig:{type:'enabled'}}},{...command,serviceTier:{type:'priority'}},{...command,messages:[{role:'user',content:[{image:{source:{s3Location:{uri:'s3://private'}}}}]}]},{...command,messages:[{role:'user',content:[{text:'x'.repeat(12001)}]}]}];
 for(const body of bad)await assert.rejects(()=>guarded(url,{method:'POST',body:JSON.stringify(body)}));
 await assert.rejects(()=>guarded(url.replace('nova-2-lite','other'),{method:'POST',body:JSON.stringify(command)}));assert.equal(reserved,0);
});
test('the actual Bedrock SDK text request passes through the allowance without network access',async()=>{
 const {createAmazonBedrock}=await import('@ai-sdk/amazon-bedrock');const {generateText}=await import('ai');let reservations=0,transports=0;
 const guarded=budgetedNovaFetch((async(_url,init)=>{transports++;const sent=JSON.parse(String(init?.body));assert.equal(sent.inferenceConfig.maxTokens,180);return new Response(JSON.stringify({output:{message:{role:'assistant',content:[{text:'Checked sample.'}]}},stopReason:'end_turn',usage:{inputTokens:5,outputTokens:3,totalTokens:8},metrics:{latencyMs:1}}),{headers:{'content-type':'application/json'}});}) as typeof fetch,async()=>{reservations++;return {allowed:true,reason:'reserved'};});
 const provider=createAmazonBedrock({region:'us-east-1',apiKey:'',credentialProvider:async()=>({accessKeyId:'test-access',secretAccessKey:'test-secret'}),fetch:guarded});
 const result=await generateText({model:provider('us.amazon.nova-2-lite-v1:0'),prompt:'Read the sample.',maxOutputTokens:180,maxRetries:0});assert.equal(result.text,'Checked sample.');assert.equal(reservations,1);assert.equal(transports,1);
});
