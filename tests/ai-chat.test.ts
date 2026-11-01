import test from 'node:test';
import assert from 'node:assert/strict';
import {executeChatPlan} from '../lib/ai-chat';
import {validateProductGrouping} from '../lib/product-groups';
import type {Txn} from '../lib/types';

const rows:Txn[]=[
 {id:'a',date:'2026-03-01',kind:'sale',gross:20,fee:1,net:19,currency:'USD',buyer_key:'one',item_title:'Red small hoop',country:'US',quantity:2},
 {id:'b',date:'2026-03-02',kind:'sale',gross:30,fee:1,net:29,currency:'USD',buyer_key:'one',item_title:'Blue large hoop',country:'US'},
 {id:'c',date:'2026-03-03',kind:'refund',gross:-20,fee:0,net:-20,currency:'USD',item_title:'Red small hoop',country:'US'},
];
test('local execution keeps rows local and reports a table',()=>{const answer=executeChatPlan(rows,{},'USD',{measure:'sales',groupBy:'item',filters:{start:'2026-03-01',end:'2026-03-31'},sort:'desc',limit:4,sentence:'Sales by item.'});assert.equal(answer.status,'answer');assert.deepEqual(answer.columns,['item','sales']);assert.equal(answer.rows[0][0],'Blue large hoop');});
test('profit says costs are missing and Christmas resolves from data',()=>{const profit=executeChatPlan(rows,{},'USD',{measure:'kept',filters:{},sort:'desc',limit:1,sentence:'Profit.'});assert.match(profit.text,/material costs/);const christmas=executeChatPlan([{...rows[0],date:'2025-12-03'}],{},'USD',{measure:'sales',filters:{start:'2025-12-01',end:'2025-12-24'},sort:'desc',limit:1,sentence:'Christmas.'});assert.match(christmas.text,/2025-12-01 to 2025-12-24/);});
test('comparison plans calculate both browser-local periods',()=>{const answer=executeChatPlan(rows,{},'USD',{measure:'sales',filters:{start:'2026-03-01',end:'2026-03-31'},compare:{start:'2026-02-01',end:'2026-02-28'},sort:'desc',limit:1,sentence:'{{result}}'});assert.equal(answer.status,'answer');assert.equal(answer.rows.length,2);assert.equal(answer.rows[0][0],'2026-03-01 to 2026-03-31');assert.equal(answer.rows[1][0],'2026-02-01 to 2026-02-28');});
test('product grouping only accepts supplied titles once',()=>{const items=[{title:'Red small hoop',orders:2},{title:'Blue large hoop',orders:1}];assert.ok(validateProductGrouping({groups:[{name:'Hoop earrings',titles:['Red small hoop','Blue large hoop']}],shop:'The shop sells hoop earrings.',unplaced:[]},items));assert.equal(validateProductGrouping({groups:[{name:'Hoop earrings',titles:['Red small hoop']},{name:'Other',titles:['Red small hoop']}],shop:'x',unplaced:[]},items),null);});
