// Anonymous production check only. Never supplies an owner session or calls Paddle.
import assert from 'node:assert/strict';
const base=process.env.WTES_HOSTED_TEST_URL;if(!base||new URL(base).protocol!=='https:')throw new Error('Set WTES_HOSTED_TEST_URL to the HTTPS deployment under test.');
const page=await fetch(new URL('/billing-test',base),{redirect:'manual'});assert.equal(page.status,404,'anonymous test page must be unavailable');const body=await page.text();assert.equal(body.includes('Payment test — no real money'),false,'owner page must not render for anonymous visitors');
for(const [path,method] of [['/api/billing-test','GET'],['/api/billing-test/trial','POST'],['/api/billing-test/checkout','POST'],['/api/billing-test/portal','POST']]){const response=await fetch(new URL(path,base),{method,headers:{Origin:new URL(base).origin},redirect:'manual'});assert.equal(response.status,404,`${path} must reject anonymous access`);const text=await response.text();assert.equal(/clientToken|transactionId|startedAt|endsAt/.test(text),false,`${path} must not disclose test data`);}
console.log('Anonymous payment-test page and APIs are unavailable; no provider calls were made.');
