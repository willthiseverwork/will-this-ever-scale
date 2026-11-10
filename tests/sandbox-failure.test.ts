import test from 'node:test';
import assert from 'node:assert/strict';
import {sandboxFailure} from '../lib/sandbox-failure';
import {PayPalError} from '../lib/paypal';

test('sandbox diagnostics redact credential-shaped values and preserve HTTP status',()=>{
 const original=console.error;let line='';console.error=(value)=>{line=String(value);};
 try{
  const result=sandboxFailure('sandbox_analyze_failed','token',new PayPalError(401,'Email person@example.com Bearer secret-token A21abcdef abcdefghijklmnopqrstuvwxyz'));
  assert.equal(result.code,'token_http_401');
  assert.ok(!line.includes('person@example.com')&&!line.includes('secret-token')&&!line.includes('A21abcdef')&&!line.includes('abcdefghijklmnopqrstuvwxyz'));
  assert.ok(result.detail.length<=200);
 }finally{console.error=original;}
});


test('diagnostics conceal unquoted names and retain only file and line from frames',()=>{
 const original=console.error;let line='';console.error=value=>{line=String(value);};
 try{
  const error=new TypeError('Invalid buyer Alice Smith');
  error.stack='TypeError: Invalid buyer Alice Smith\n    at run (/private/app/route.ts:42:11)\n    at next (/private/app/paypal.ts:16:5)';
  const result=sandboxFailure('sandbox_analyze_failed','analysis',error);
  assert.equal(result.detail,'[redacted]');
  assert.equal(result.code,'analysis_TypeError');
  assert.match(line,/at=route.ts:42\|paypal.ts:16$/);
  assert.doesNotMatch(line,/Alice|\/private/);
 }finally{console.error=original;}
});
