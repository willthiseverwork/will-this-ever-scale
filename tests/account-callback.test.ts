import {test} from 'node:test';
import assert from 'node:assert/strict';
import {GET} from '../app/api/account/callback/route';

test('failed sign-in redirects safely without reflecting codes or keeping flow cookies',async()=>{
 const names=['WTES_WORKOS_CLIENT_ID','WTES_WORKOS_API_KEY','WTES_SESSION_SECRET','WTES_APP_ORIGIN'] as const;
 const old=names.map(n=>process.env[n]),oldWarn=console.warn;const warnings:unknown[][]=[];
 Object.assign(process.env,{WTES_WORKOS_CLIENT_ID:'client_test',WTES_WORKOS_API_KEY:'test-key',WTES_SESSION_SECRET:'s'.repeat(40),WTES_APP_ORIGIN:'https://example.com'});
 console.warn=(...args:unknown[])=>{warnings.push(args)};
 try {
  const response=await GET(new Request('https://example.com/api/account/callback?code=private-code&state=private-state'));
  assert.equal(response.status,303);
  assert.equal(response.headers.get('Location'),'/account/sign-in-error');
  assert.equal(response.headers.get('Cache-Control'),'no-store');
  assert.equal(response.headers.get('Referrer-Policy'),'no-referrer');
  assert.match(response.headers.get('Set-Cookie')||'',/wtes_flow=;.*Max-Age=0/);
  assert.deepEqual(warnings,[['wtes_login_failed','invalid_flow']]);
  assert.equal(await response.text(),'');
 }finally{console.warn=oldWarn;names.forEach((n,i)=>{if(old[i]===undefined)delete process.env[n];else process.env[n]=old[i];});}
});
