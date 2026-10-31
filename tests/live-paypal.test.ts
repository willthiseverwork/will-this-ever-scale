import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { createLiveTransactionReader } from '../lib/live-paypal';
import { collectTransactionSnapshots, exactObservationFingerprint } from '../lib/paypal-sync';

test('disabled live reader never contacts PayPal', async () => {
 let called = false;
 const reader = createLiveTransactionReader({ enabled: false, grant: { accessToken: 'not-real', merchantBindingVerified: true, transactionReadGranted: true }, fetcher: async () => { called = true; throw new Error('unexpected'); } });
 await assert.rejects(reader.page(new Date('2026-01-01Z'), new Date('2026-01-02Z'), 1));
 assert.equal(called, false);
});
test('reader fixes host and rejects redirects and windows over 31 days', async () => {
 let requested = ''; let init: RequestInit | undefined;
 const reader = createLiveTransactionReader({ enabled: true, grant: { accessToken: 'test-token', merchantBindingVerified: true, transactionReadGranted: true }, fetcher: async (url, options) => { requested = String(url); init = options; return new Response(JSON.stringify({ total_items: 0 }), {status: 200}); } });
 await reader.page(new Date('2026-01-01Z'), new Date('2026-02-01Z'), 1);
 assert.equal(new URL(requested).origin, 'https://api-m.paypal.com');
 assert.equal(init?.redirect, 'error');
 await assert.rejects(reader.page(new Date('2026-01-01Z'), new Date('2026-02-02Z'), 1));
});
test('pagination failure leaves failed window uncommitted and status partial', async () => {
 const reader = { async page(start: Date, _end: Date, page: number) {
  if (start >= new Date('2026-02-01Z') && page === 2) throw new Error('failed');
  return { transactions: [{transaction_info: {transaction_id: 'x'}}], totalPages: start >= new Date('2026-02-01Z') ? 2 : 1 };
 }};
 const r = await collectTransactionSnapshots(reader, new Date('2026-01-01Z'), new Date('2026-02-10Z'));
 assert.equal(r.status, 'partial'); assert.equal(r.windows.length, 1); assert.equal(r.completedThrough, '2026-02-01T00:00:00.000Z'); assert.equal(r.invoices, 'unavailable');
});
test('fingerprint ignores object key order and distinguishes observations with the same transaction id', () => {
 const a = {transaction_info: {transaction_id:'same', transaction_event_code:'T0000'}};
 const b = {transaction_info: {transaction_event_code:'T0000', transaction_id:'same'}};
 const c = {transaction_info: {transaction_id:'same', transaction_event_code:'T1107'}};
 assert.equal(exactObservationFingerprint(a), exactObservationFingerprint(b)); assert.notEqual(exactObservationFingerprint(a), exactObservationFingerprint(c));
});

test('daily sync never commits partial results and preserves a stable commit ID', async () => {
 const {runDailySnapshot}=await import('../lib/paypal-sync');let calls=0;
 const committer={async commitComplete(){calls++;return 'committed' as const;}};
 const failing={async page(){throw new Error('unavailable');}};
 const options={committer,operationId:'merchant_run_123456789',expectedRevision:null,start:new Date('2026-01-01Z'),end:new Date('2026-01-02Z'),now:new Date('2026-01-03Z')};
 assert.equal((await runDailySnapshot({...options,reader:failing})).status,'partial');assert.equal(calls,0);
 let operation='';const complete={async page(){return {transactions:[],totalPages:1};}};
 const saved={async commitComplete(input:{operationId:string}){operation=input.operationId;return 'already_committed' as const;}};
 assert.equal((await runDailySnapshot({...options,reader:complete,committer:saved})).status,'already_committed');assert.equal(operation,options.operationId);
});
