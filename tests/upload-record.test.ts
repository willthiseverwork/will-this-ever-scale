import assert from 'node:assert/strict';
import test from 'node:test';
import {privateItemTitle,storedUpload} from '../lib/upload-record';

const hash='b_'+ 'a'.repeat(64);
test('private upload records retain only sanitized titles and pseudonymous join fields',()=>{
 const title=privateItemTitle('Custom mug jane@example.com https://example.com +44 20 1234 5678\u0007');
 assert.equal(title,'Custom mug');
 const parsed=storedUpload.parse({id:'f15ccd8b-5b8b-40d8-a05e-3ff1c93cfdcc',uploadedAt:'2026-11-02T10:00:00.000Z',rows:[{date:'2026-11-02',kind:'sale',gross:12,fee:1,net:11,currency:'GBP',item_title:'Custom mug jane@example.com https://example.com +44 20 1234 5678',id:hash,buyer_key:hash}]});
 assert.equal(parsed.rows[0].item_title,'Custom mug');
 assert.equal(parsed.rows[0].id,hash);
});

test('private uploads reject raw transaction values and more than 20,000 rows',()=>{
 const row={date:'2026-11-02',kind:'sale' as const,gross:12,fee:1,net:11,currency:'GBP',id:'TXN-123'};
 assert.equal(storedUpload.safeParse({id:'f15ccd8b-5b8b-40d8-a05e-3ff1c93cfdcc',uploadedAt:'2026-11-02T10:00:00.000Z',rows:[row]}).success,false);
 assert.equal(storedUpload.safeParse({id:'f15ccd8b-5b8b-40d8-a05e-3ff1c93cfdcc',uploadedAt:'2026-11-02T10:00:00.000Z',rows:Array.from({length:20_001},()=>({...row,id:hash}))}).success,false);
});
