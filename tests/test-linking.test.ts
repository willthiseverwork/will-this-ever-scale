import assert from 'node:assert/strict';
import test from 'node:test';
import {linkTest} from '../lib/test-linking';
import type {Txn} from '../lib/types';
const sale=(id:string,date:string,buyer:string,gross:number):Txn=>({id,date,buyer_key:buyer,kind:'sale',gross,fee:0,net:gross,currency:'GBP'});
test('links later one-time-buyer records without claiming causation',()=>{
 const rows=[sale('1','2026-01-01','a',10),sale('2','2026-01-02','b',10),sale('3','2026-02-02','a',12),sale('4','2026-02-03','c',10)];
 assert.deepEqual(linkTest(rows,{findingId:'one_time_buyers',startedAt:'2026-02-01'},30),{days:3,baseline:0,result:12,baselineCount:0,resultCount:1});
});
test('links named quiet regulars by pseudonymous buyer code',()=>{
 const rows=[sale('1','2026-01-01','a',10),sale('2','2026-02-03','a',15),sale('3','2026-02-03','b',9)];
 assert.deepEqual(linkTest(rows,{findingId:'lapsed_buyers',startedAt:'2026-02-01',subject:['a']},14),{days:3,baseline:0,result:15,baselineCount:0,resultCount:1});
});
