import {test} from 'node:test';import assert from 'node:assert/strict';
import {voiceWithFallback,novaVoiceModel,voiceModel,voiceGenerationOptions} from '../lib/voice/model';
test('a refused configured model falls back once to Nova, other failures do not',async()=>{const calls:string[]=[];const value=await voiceWithFallback('us.anthropic.example',async id=>{calls.push(id);if(calls.length===1)throw Object.assign(new Error('refused'),{statusCode:403});return 'ok'});assert.equal(value,'ok');assert.deepEqual(calls,['us.anthropic.example',novaVoiceModel]);await assert.rejects(()=>voiceWithFallback('us.anthropic.example',async()=>{throw Object.assign(new Error('network'),{statusCode:500})}));});
test('voice model refuses unconfigured and unsupported providers',()=>{assert.equal(voiceModel('unapproved.model'),null);assert.equal(voiceModel(novaVoiceModel),null)});

test('Nova requests low reasoning and Claude does not receive Nova-only options',()=>{assert.deepEqual(voiceGenerationOptions(novaVoiceModel),{providerOptions:{bedrock:{reasoningConfig:{type:'enabled',maxReasoningEffort:'low'}}}});assert.deepEqual(voiceGenerationOptions('us.anthropic.example'),{})});
