import test from 'node:test';
import assert from 'node:assert/strict';
import {reserveVoiceClip,voiceAvailable,type VoiceBudgetStore} from '../lib/voice-budget';

function memory():VoiceBudgetStore{const values=new Map<string,{body:string;etag:string}>();let n=0;return {async read(path){return values.get(path)||null;},async create(path,body){if(values.has(path))throw new Error('exists');values.set(path,{body,etag:String(++n)});},async replace(path,body,etag){const before=values.get(path);if(!before||before.etag!==etag)throw new Error('changed');values.set(path,{body,etag:String(++n)});}};}
const identity='a'.repeat(64),now=new Date('2026-11-02T12:00:00Z');
test('voice clips stop at twenty per identity each UTC day',async()=>{const store=memory();for(let n=0;n<20;n+=1)assert.equal((await reserveVoiceClip(identity,{store,now})).allowed,true);assert.deepEqual(await reserveVoiceClip(identity,{store,now}),{allowed:false,reason:'daily'});assert.equal((await reserveVoiceClip(identity,{store,now:new Date('2026-11-03T00:00:00Z')})).allowed,true);});
test('voice monthly capacity hides the mic after 300 maximum-minute clips',async()=>{const store=memory();for(let n=0;n<300;n+=1){const id=n.toString(16).padStart(64,'0');assert.equal((await reserveVoiceClip(id,{store,now})).allowed,true);}assert.deepEqual(await voiceAvailable({store,now}),{allowed:false,reason:'monthly'});assert.deepEqual(await reserveVoiceClip('f'.repeat(64),{store,now}),{allowed:false,reason:'monthly'});});
