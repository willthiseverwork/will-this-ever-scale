import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setActionStoreForTests, type ActionStore } from '../lib/action-store';
import { POST } from '../app/api/owner/payment-link-probe/route';

test('owner probe rejects unauthenticated requests and reserves before any sandbox write', async () => {
 const secret='x'.repeat(40); process.env.WTES_PAYMENT_LINK_PROBE_SECRET=secret; process.env.PAYPAL_SANDBOX_CLIENT_ID='sandbox'; process.env.PAYPAL_SANDBOX_CLIENT_SECRET='secret';
 const records=new Map<string,string>(); const store:ActionStore={async read(path){const body=records.get(path);return body?{body,etag:'1'}:null},async create(path,body){if(records.has(path))throw new Error('exists');records.set(path,body)},async replace(){throw new Error('unused')}};
 setActionStoreForTests(store); const original=globalThis.fetch; let calls=0;
 globalThis.fetch=async (_url,init)=>{calls++; if(calls===1)return Response.json({access_token:'token'}); if(calls===2){assert.ok([...records.keys()].some(x=>x.endsWith('reservation.json')));assert.equal(init?.method,'POST');return Response.json({id:'PLB-123'},{status:201})} assert.equal(init?.method,'DELETE');return new Response(null,{status:204})};
 try {
  assert.equal((await POST(new Request('https://app.example/api/owner/payment-link-probe',{method:'POST'}))).status,404); assert.equal(calls,0);
  const request=()=>new Request('https://app.example/api/owner/payment-link-probe',{method:'POST',headers:{Authorization:'Bearer '+secret}});
  const result=await POST(request()); assert.equal(result.status,200); assert.equal((await result.json()).id,'PLB-123');
  assert.equal((await POST(request())).status,409); assert.equal(calls,3);
 } finally {globalThis.fetch=original;setActionStoreForTests(undefined);delete process.env.WTES_PAYMENT_LINK_PROBE_SECRET;delete process.env.PAYPAL_SANDBOX_CLIENT_ID;delete process.env.PAYPAL_SANDBOX_CLIENT_SECRET;}
});
