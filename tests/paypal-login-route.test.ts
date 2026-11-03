import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GET} from '../app/api/paypal/login/route';
import {judgeCookie} from '../lib/access';

test('login rejects malformed client IDs to the sandbox keys form and preserves valid sandbox authorization', async()=>{
 const names=['WTES_BILLING_SECRET','PAYPAL_ACTION_SIGNING_SECRET','PAYPAL_LOGIN_CLIENT_ID','PAYPAL_LOGIN_CLIENT_SECRET'];
 const previous=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 Object.assign(process.env,{WTES_BILLING_SECRET:'b'.repeat(32),PAYPAL_ACTION_SIGNING_SECRET:'s'.repeat(32),PAYPAL_LOGIN_CLIENT_SECRET:'secret'});
 try{
  const cookie=judgeCookie().split(';')[0];
  const request=(authorized=true)=>new Request('https://app.willthiseverscale.com/api/paypal/login',{headers:authorized?{cookie}:{}});
  for(const id of ['', '{\n  "Version": "2012-10-17"\n}', 'abc def', 'abc\n', 'abc/def', 'abc.def']){
   process.env.PAYPAL_LOGIN_CLIENT_ID=id;
   const response=await GET(request());
   assert.equal(response.headers.get('location'),'https://app.willthiseverscale.com/?paypal=keys');
   assert.equal(response.headers.get('set-cookie'),null);
  }
  const valid='BAA-example_1234567890';process.env.PAYPAL_LOGIN_CLIENT_ID=valid;
  const response=await GET(request());const destination=new URL(response.headers.get('location')!);
  assert.equal(destination.origin,'https://www.sandbox.paypal.com');
  assert.equal(destination.pathname,'/signin/authorize');
  assert.equal(destination.searchParams.get('client_id'),valid);
  assert.equal(destination.searchParams.get('redirect_uri'),'https://app.willthiseverscale.com/api/paypal/login/callback');
  assert.match(response.headers.get('set-cookie')!,/paypal_login_state=/);
  assert.equal((await GET(request(false))).headers.get('location'),'https://app.willthiseverscale.com/access');
 }finally{for(const name of names){const value=previous[name];if(value===undefined)delete process.env[name];else process.env[name]=value}}
});
