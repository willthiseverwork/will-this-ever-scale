import {test} from 'node:test';import assert from 'node:assert/strict';import {joinDemoHistory} from '../lib/demo-history';import type {Txn} from '../lib/types';
const row=(id:string,date='2026-01-01',gross=30,item='Silver hoops'):Txn=>({id,date,gross,fee:1,net:gross-1,item_title:item,currency:'USD',kind:'sale'});
test('matching transaction IDs and missing-ID fingerprints are deduplicated',()=>{const existing=[row('P1'),row('','2026-01-02')];const history=[row('P1'),row('H2','2026-01-02'),row('','2026-01-01'),row('H3','2026-01-03')];assert.deepEqual(joinDemoHistory(existing,history).map(x=>x.id),['P1','','H3'])});
test('different transaction IDs remain distinct even with identical date and amount',()=>assert.equal(joinDemoHistory([row('one')],[row('two')]).length,2));

test('browser projection does not expose synthetic buyer name or email',async()=>{const {sandboxReanalysisRows}=await import('../lib/paypal-analysis');const history=Object.assign(row('h'),{buyer_name:'Anna',buyer_email:'anna@example.com',buyer_key:'a'.repeat(64)});const result=sandboxReanalysisRows([],null,[history]);assert.equal(result.length,1);assert.equal(JSON.stringify(result).includes('Anna'),false);assert.equal(JSON.stringify(result).includes('anna@example.com'),false)});

test('distinct sale and refund events survive even when PayPal reuses an ID',()=>{const sale=row('P1');const refund={...row('P1'),kind:'refund' as const,gross:-30};assert.deepEqual(joinDemoHistory([sale],[refund]).map(x=>x.kind),['sale','refund']);});
