import test from 'node:test'; import assert from 'node:assert/strict'; import { analyze } from '../lib/engine'; import { validateRead } from '../lib/read'; import { aiPayload, assertNoPersonalData } from '../lib/privacy';
const rows=[
 {id:'1',date:'2026-01-03',kind:'sale',gross:100,fee:4,net:96,currency:'USD',buyer_key:'a',item_group:'Hoops'},
 {id:'2',date:'2026-02-03',kind:'sale',gross:100,fee:4,net:96,currency:'USD',buyer_key:'a',item_group:'Hoops'},
 {id:'3',date:'2026-03-03',kind:'sale',gross:20,fee:1,net:19,currency:'USD',buyer_key:'b',item_group:'Rings'},
 {id:'4',date:'2026-03-05',kind:'refund',gross:20,fee:0,net:-20,currency:'USD',buyer_key:'b',item_group:'Rings'},
 {id:'5',date:'2026-03-01',kind:'other',gross:180,fee:0,net:180,currency:'USD',invoice_id:'INV',status:'Unpaid'}
] as any;
test('hand-checked three-month fixture has traceable money map',()=>{const a=analyze(rows);assert.equal(a.money_map.came_in,220);assert.equal(a.money_map.paypal_fees,9);assert.equal(a.money_map.refunds,20);assert.equal(a.money_map.kept,191);assert.equal(a.quick_win?.one_off_amount,180);assert.equal(a.months.length,3);});
test('AI numbers not in the engine JSON are rejected',()=>{const a=analyze(rows);assert.equal(validateRead('You kept 999 dollars.',a),false);assert.equal(validateRead('You kept 191 dollars.',a),true);});
test('AI payload has no names or emails',()=>{const a=analyze(rows);assert.doesNotThrow(()=>assertNoPersonalData(aiPayload(a)));});
