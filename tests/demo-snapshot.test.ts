import test from 'node:test';import assert from 'node:assert/strict';import {reserveRefresh,attemptRefresh} from '../lib/demo-snapshot';
test('snapshot generation locks serialize concurrent attempts, respect the boundary and recover an interrupted worker',async()=>{const entries=new Map<string,number>();let clock=Date.parse('2026-11-10T19:00:00Z');const store={read:async(path:string)=>entries.get(path)??null,create:async(path:string)=>{if(entries.has(path))throw new Error('exists');entries.set(path,clock)}};const snapshot='2026-11-10T19:00:00Z';assert.equal(await reserveRefresh(snapshot,clock+899999,store),false);clock+=900000;const simultaneous=await Promise.all([reserveRefresh(snapshot,clock,store),reserveRefresh(snapshot,clock,store)]);assert.deepEqual(simultaneous.sort(),[false,true]);assert.equal(await reserveRefresh(snapshot,clock+959999,store),false);clock+=960000;assert.equal(await reserveRefresh(snapshot,clock,store),true);const next=new Date(clock).toISOString();assert.equal(await reserveRefresh(next,clock+899999,store),false);clock+=900000;assert.equal(await reserveRefresh(next,clock,store),true)});
test('refresh rechecks generation and records lock failures without starting a read',async()=>{let reads=0,starts=0;const failures:Array<[string,string]>=[],base={current:async()=>({at:'old'}),reserve:async()=>false,refresh:async()=>{reads++},start:async()=>{starts++},record:async(stage:'lock'|'schedule'|'storage'|'status',code:string)=>{failures.push([stage,code])}};await attemptRefresh('https://example.test','new',base);assert.equal(reads,0);await attemptRefresh('https://example.test','old',base);assert.equal(starts,0);await attemptRefresh('https://example.test','old',{...base,reserve:async()=>{throw new Error('private provider payload')}});assert.deepEqual(failures,[['lock','storage_unavailable']]);assert.equal(reads,0)});

test('status distinguishes an active refresh from a lock left by an interrupted worker',async()=>{const {statusForLock}=await import('../lib/demo-snapshot');const locked=Date.parse('2026-11-10T19:00:00Z'),old={at:'2026-11-10T18:00:00Z',ok:true};assert.equal(statusForLock(old,locked,locked+1000).code,'in_progress');assert.equal(statusForLock(old,locked,locked+66000).code,'interrupted_or_timed_out');const started={at:'2026-11-10T19:00:01Z',ok:false,stage:'refresh',code:'in_progress'};assert.equal(statusForLock(started,locked,locked+67000).code,'interrupted_or_timed_out');const done={at:'2026-11-10T19:00:20Z',ok:true};assert.deepEqual(statusForLock(done,locked,locked+66000),done)});
test('refresh deadline records a bounded, sanitized timeout',async()=>{const {withRefreshDeadline}=await import('../lib/demo-snapshot');await assert.rejects(()=>withRefreshDeadline(new Promise(()=>{}),5),/read_timeout/);assert.equal(await withRefreshDeadline(Promise.resolve('ok'),100),'ok')});
test('storage and status-write failures are classified without starting PayPal',async()=>{let calls=0;const errors:Array<[string,string]>=[],base={current:async()=>({at:'old'}),reserve:async()=>true,refresh:async()=>{calls++},start:async()=>{},record:async(stage:'lock'|'schedule'|'storage'|'status',code:string)=>{errors.push([stage,code])}};await attemptRefresh('https://example.test','old',{...base,current:async()=>{throw new Error('private')}});await attemptRefresh('https://example.test','old',{...base,start:async()=>{throw new Error('private')}});assert.equal(calls,0);assert.deepEqual(errors,[['storage','storage_unavailable'],['status','storage_unavailable']]);});

test('demo grouping reuses successful grouping for the same trimmed title set and refreshes for changes',async()=>{
 const {groupDemoRows}=await import('../lib/demo-snapshot');
 const grouping={shop:'This shop sells bags and rings.',groups:[{name:'Bags',titles:['Bag']},{name:'Rings',titles:['Ring']}],unplaced:[],source:'ai' as const};
 let calls=0;const mock=async()=>{calls++;return Response.json(grouping)};
 const rows=(titles:string[])=>titles.map(item_title=>({item_title,gross:1,kind:'sale'})) as import('../lib/types').Txn[];
 const first=await groupDemoRows(rows(['Bag','Ring']),'https://example.test',null,mock);
 assert.equal(calls,1);assert.deepEqual(first.grouping,grouping);
 const same=await groupDemoRows(rows([' Ring ','Bag','Bag']),'https://example.test',first.cache,mock);
 assert.equal(calls,1);assert.deepEqual(same.grouping,grouping);assert.equal(same.rows[0].item_group,'Rings');
 const changed=await groupDemoRows(rows(['Bag','New']),'https://example.test',first.cache,mock);
 assert.equal(calls,2);assert.deepEqual(changed.grouping,grouping);
});
test('failed or legacy grouping is not cached and is retried',async()=>{
 const {groupDemoRows}=await import('../lib/demo-snapshot');let calls=0;
 const rows=[{item_title:'Bag',gross:1,kind:'sale'}] as import('../lib/types').Txn[];
 const fail=async()=>{calls++;return new Response(null,{status:503})};
 const fallback=await groupDemoRows(rows,'https://example.test',null,fail);
 assert.equal(fallback.grouping.source,'fallback');assert.equal(fallback.cache,undefined);
 await groupDemoRows(rows,'https://example.test',fallback.cache,fail);
 await groupDemoRows(rows,'https://example.test',{grouping:fallback.grouping},fail);
 assert.equal(calls,3);
});
