import test from 'node:test';
import assert from 'node:assert/strict';
import history from '../fixtures/hobby-shops/demo-history.json';
import type {Txn} from '../lib/types';
import {sandboxAnalysis} from '../lib/paypal-analysis';
import {normalizeTransactions} from '../lib/paypal';
import {readAggregate} from '../lib/read';
import {GET as status} from '../app/api/sandbox/analyze/route';
import {recordDemoRead} from '../lib/sandbox-status';

const seed=Array.from({length:40},(_,i)=>({transaction_info:{transaction_id:`seed-${i}`,transaction_initiation_date:'2026-11-03T10:00:00Z',transaction_amount:{value:i<8?'60.00':'30.00',currency_code:'USD'},fee_amount:{value:'-2.00',currency_code:'USD'},transaction_status:'S',transaction_event_code:'T0000'},cart_info:{item_details:[{item_name:'Silver hoops',item_quantity:'1',item_unit_price:{value:'30.00',currency_code:'USD'}}]}}));
test('seed-shaped orders with generated history keep full findings while read aggregate excludes nonmonthly cards',()=>{
 const analysis=sandboxAnalysis(seed,[],{},new Date('2026-11-10T00:00:00Z'),history as Txn[],Buffer.alloc(32));assert.ok(analysis);assert.ok(analysis.ranked_leaks.some(l=>['best_month','item_jumped','items_stopped'].includes(l.id)));const aggregate=readAggregate(analysis);assert.ok(aggregate.ranked_leaks.every(l=>!['best_month','item_jumped','items_stopped'].includes(l.id)));assert.ok(analysis.read);assert.equal(analysis.period.end,'2026-11');
});
test('malformed PayPal rows are skipped while a valid sale with unknown fee remains usable',()=>{
 const malformed=[null,{}, {transaction_info:{transaction_id:'bad',transaction_initiation_date:'nonsense',transaction_amount:{value:'3',currency_code:'USD'}}}];const good={...seed[0],transaction_info:{...seed[0].transaction_info,fee_amount:{value:'invalid',currency_code:'USD'}},cart_info:{item_details:[null]}};const rows=normalizeTransactions([...malformed,good]);assert.equal(rows.length,1);assert.equal(rows[0].fee_known,false);assert.equal(rows[0].item_title,undefined);
});
test('status exposes only the in-process demo receipt with no-store',async()=>{recordDemoRead({at:'2026-11-10T00:00:00Z',ok:true,orders:40});const response=await status();assert.equal(response.headers.get('cache-control'),'no-store');const body=await response.json();assert.deepEqual(body.lastDemoRead,{at:'2026-11-10T00:00:00Z',ok:true,orders:40});assert.equal(body.note,'lastDemoRead resets when the server instance changes');assert.ok(JSON.stringify(body).length<2048);});


test('optional enrichment failures preserve the primary analysis',async()=>{
 const {optionalSandboxPart,optionalSandboxPartAsync}=await import('../lib/sandbox-optional');
 assert.deepEqual(optionalSandboxPart(()=>{throw new Error('reanalysis failed');}),{ok:false});
 assert.deepEqual(await optionalSandboxPartAsync(async()=>{throw new Error('subscriptions failed');}),{ok:false});
 assert.deepEqual(optionalSandboxPart(()=>['available']),{ok:true,value:['available']});
});


test('transient PayPal reads retry once after ten seconds only within time budget',async()=>{
 const {paypalReadFetch}=await import('../lib/paypal-read-retry');let calls=0,waited=0;const fetcher=(async()=>new Response('',{status:++calls===1?429:200})) as typeof fetch;const request=paypalReadFetch(0,fetcher,async ms=>{waited=ms},()=>1000);assert.equal((await request('https://example.com')).status,200);assert.equal(calls,2);assert.equal(waited,10000);calls=0;waited=0;const late=paypalReadFetch(0,fetcher,async ms=>{waited=ms},()=>40000);assert.equal((await late('https://example.com')).status,429);assert.equal(calls,1);assert.equal(waited,0);
});
