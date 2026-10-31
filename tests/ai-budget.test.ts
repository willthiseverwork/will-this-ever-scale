import test from 'node:test';
import assert from 'node:assert/strict';
import { BudgetConflict, reserveAiBudget, type BudgetStore } from '../lib/ai-budget';

class MemoryStore implements BudgetStore {
  records=new Map<string,{body:string;etag:string}>();
  revision=0;
  async read(path:string){const value=this.records.get(path);return value?{...value}:null;}
  async create(path:string,body:string){if(this.records.has(path))throw new BudgetConflict();this.records.set(path,{body,etag:String(++this.revision)});}
  async replace(path:string,body:string,etag:string){const previous=this.records.get(path);if(!previous||previous.etag!==etag)throw new BudgetConflict();this.records.set(path,{body,etag:String(++this.revision)});}
}
const october=new Date('2026-10-31T23:59:59Z'), november=new Date('2026-11-01T00:00:00Z');
test('concurrent model calls compete atomically for the last monthly slot',async()=>{
  const store=new MemoryStore(),path='ai-budget/2026-10.json';
  await store.create(path,JSON.stringify({version:1,month:'2026-10',count:499}));
  const results=await Promise.all(Array.from({length:8},()=>reserveAiBudget({store,now:october})));
  assert.equal(results.filter(r=>r.allowed).length,1);
  assert.equal(JSON.parse((await store.read(path))!.body).count,500);
});
test('a new UTC month has its own allowance and never changes the previous month',async()=>{
  const store=new MemoryStore();
  assert.equal((await reserveAiBudget({store,now:october,limit:1})).allowed,true);
  assert.deepEqual(await reserveAiBudget({store,now:october,limit:1}),{allowed:false,reason:'exhausted'});
  assert.equal((await reserveAiBudget({store,now:november,limit:1})).allowed,true);
  assert.equal(JSON.parse((await store.read('ai-budget/2026-10.json'))!.body).count,1);
  assert.equal(JSON.parse((await store.read('ai-budget/2026-11.json'))!.body).count,1);
});
test('corrupt records, storage errors and invalid configuration fail closed',async()=>{
  const store=new MemoryStore();await store.create('ai-budget/2026-10.json','{"version":1,"month":"2026-10","count":1,"email":"private@example.com"}');
  assert.deepEqual(await reserveAiBudget({store,now:october}),{allowed:false,reason:'unavailable'});
  const broken:BudgetStore={read:async()=>{throw new Error('unavailable');},create:async()=>{},replace:async()=>{}};
  assert.deepEqual(await reserveAiBudget({store:broken,now:october}),{allowed:false,reason:'unavailable'});
  assert.deepEqual(await reserveAiBudget({store:new MemoryStore(),now:october,limit:501}),{allowed:false,reason:'unavailable'});
  assert.deepEqual(await reserveAiBudget({now:october,token:''}),{allowed:false,reason:'unavailable'});
  assert.deepEqual(await reserveAiBudget({store:new MemoryStore(),now:october,limit:0}),{allowed:false,reason:'exhausted'});
});
test('repeated concurrency conflicts stop after three attempts',async()=>{
  let attempts=0;const store:BudgetStore={read:async()=>({body:'{"version":1,"month":"2026-10","count":1}',etag:'old'}),create:async()=>{},replace:async()=>{attempts++;throw new BudgetConflict();}};
  assert.deepEqual(await reserveAiBudget({store,now:october}),{allowed:false,reason:'unavailable'});assert.equal(attempts,3);
});
test('real Blob SDK sends overwrite and ETag headers on the second reservation',async()=>{
  const {MockAgent,getGlobalDispatcher,setGlobalDispatcher}=await import('undici');
  const previousDispatcher=getGlobalDispatcher(),previousFetch=globalThis.fetch,agent=new MockAgent();
  agent.disableNetConnect();setGlobalDispatcher(agent);
  let reads=0;const writes:Array<{overwrite:string|null;etag:string|null}>=[];
  const metadata={url:'https://test.private.blob.vercel-storage.com/ai-budget/2026-10.json',downloadUrl:'https://test.private.blob.vercel-storage.com/ai-budget/2026-10.json?download=1',pathname:'ai-budget/2026-10.json',contentType:'application/json',contentDisposition:'inline',etag:'etag-1'};
  const mock=agent.get('https://vercel.com');
  const reply=(opts:{headers:unknown})=>{const headers=new Headers(opts.headers as HeadersInit);writes.push({overwrite:headers.get('x-allow-overwrite'),etag:headers.get('x-if-match')});return {statusCode:200,data:metadata};};
  mock.intercept({path:/^\/api\/blob\/\?pathname=/,method:'PUT'}).reply(reply);
  mock.intercept({path:/^\/api\/blob\/\?pathname=/,method:'PUT'}).reply(reply);
  globalThis.fetch=(async(input:RequestInfo|URL)=>{
    const url=new URL(String(input));assert.equal(url.hostname,'test.private.blob.vercel-storage.com');assert.equal(url.searchParams.get('cache'),'0');
    if(++reads===1)return new Response(null,{status:404});
    const body=JSON.stringify({version:1,month:'2026-10',count:1});
    return new Response(body,{status:200,headers:{etag:'etag-1','content-length':String(Buffer.byteLength(body)),'content-type':'application/json'}});
  }) as typeof fetch;
  try{
    const token='vercel_blob_rw_test_secret';
    assert.deepEqual(await reserveAiBudget({token,now:october}),{allowed:true,reason:'reserved'});
    assert.deepEqual(await reserveAiBudget({token,now:october}),{allowed:true,reason:'reserved'});
    assert.equal(reads,2);assert.equal(writes.length,2);
    assert.equal(writes[0].overwrite,'0');assert.equal(writes[0].etag,null);
    assert.equal(writes[1].overwrite,'1');assert.equal(writes[1].etag,'etag-1');
  }finally{globalThis.fetch=previousFetch;setGlobalDispatcher(previousDispatcher);await agent.close();}
});
