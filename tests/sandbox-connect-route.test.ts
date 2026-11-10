import test from 'node:test';
import assert from 'node:assert/strict';
import {judgeCookie} from '../lib/access';
import {POST} from '../app/api/sandbox/connect/route';

test('authenticated malformed sandbox connection returns the existing 400 response with diagnostics',async()=>{
 const previous=process.env.WTES_BILLING_SECRET;
 process.env.WTES_BILLING_SECRET='test-only-secret-with-at-least-32-bytes';
 const original=console.error;console.error=()=>{};
 try{
  const url='https://example.test/api/sandbox/connect';
  const response=await POST(new Request(url,{method:'POST',headers:{origin:'https://example.test',cookie:judgeCookie().split(';')[0],'content-type':'application/json'},body:'{}'}));
  const body=await response.json();
  assert.equal(response.status,400);
  assert.equal(body.error,'Could not connect to PayPal sandbox. Check credentials and permissions.');
  assert.equal(body.stage,'parse');assert.equal(body.code,'parse_ZodError');assert.equal(typeof body.detail,'string');
 }finally{console.error=original;if(previous===undefined)delete process.env.WTES_BILLING_SECRET;else process.env.WTES_BILLING_SECRET=previous;}
});
