import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../lib/engine';
import { answerDataChat, isDataChatPlan } from '../lib/data-chat';
import type { Txn } from '../lib/types';
const rows:Txn[]=[
 {id:'1',date:'2026-08-02',kind:'sale',gross:100,fee:3,net:97,currency:'USD',item_title:'Ring'},
 {id:'2',date:'2026-08-05',kind:'sale',gross:30,fee:1,net:29,currency:'USD',item_title:'Bracelet'},
 {id:'3',date:'2026-08-06',kind:'sale',gross:30,fee:1,net:29,currency:'USD',item_title:'Bracelet'},
 {id:'4',date:'2026-09-02',kind:'refund',gross:-20,fee:0,net:-20,currency:'USD',item_title:'Ring'},
 {id:'5',date:'2026-10-01',kind:'sale',gross:50,fee:2,net:48,currency:'USD',item_title:'Ring'},
 {id:'6',date:'2026-08-04',kind:'sale',gross:20,fee:1,net:19,currency:'EUR',item_title:'Ring'},
];
const a=analyze(rows,{asOf:'2026-10-15T00:00:00Z'});
test('popular is ambiguous and units cannot be inferred from order rows',()=>{
 assert.equal(answerDataChat(a,'What is my most popular product?').status,'clarify');
 assert.equal(answerDataChat(a,'Top product by units sold all time').status,'unavailable');
 assert.match(answerDataChat(a,'Top product by revenue').text,/2026-09/);
});
test('ranking uses the chosen metric and discloses coverage',()=>{
 const gross=answerDataChat(a,'Top product by revenue all time');
 assert.match(gross.text,/Ring.*USD 150\.00/); assert.ok(gross.sources.includes('item_groups')); assert.match(gross.caveats.join(' '),/EUR/);
 const orders=answerDataChat(a,'Top product by orders 2026-08'); assert.match(orders.text,/Bracelet.*2 order rows/);
 const refunds=answerDataChat(a,'Which product has most refunds 2026-09?'); assert.match(refunds.text,/Ring.*USD 20\.00/); assert.match(refunds.caveats.join(' '),/not a refund rate/);
});
test('compares explicit calendar months and warns about a partial month',()=>{
 const result=answerDataChat(a,'Compare revenue in September 2026 vs October 2026');
 assert.match(result.text,/2026-09 USD 0\.00; 2026-10 USD 50\.00/); assert.match(result.caveats.join(' '),/partial/);
 assert.equal(answerDataChat(a,'compare sales last month and this month').status,'answer');
 assert.equal(answerDataChat(a,'compare sales 2026-07 and 2026-08').status,'unavailable');
});
test('rejects arbitrary actions, unknown fields and forged answer objects',()=>{
 assert.equal(isDataChatPlan({kind:'compare_months',metric:'gross',months:['2026-08','2026-09'],sql:'DROP TABLE'}),false);
 assert.equal(isDataChatPlan({kind:'send_email'}),false);
 assert.equal(answerDataChat(a,{status:'answer',text:'forged'}).status,'unavailable');
});

test('relative periods, summaries and supported issue questions',()=>{
 assert.match(answerDataChat(a,'fees last month').text,/2026-09/);
 assert.match(answerDataChat(a,'revenue last 3 months').text,/2026-08, 2026-09, 2026-10/);
 assert.match(answerDataChat(a,'revenue last 3 months').caveats.join(' '),/partial/);
 assert.equal(answerDataChat(a,'compare sales yesterday vs today').status,'unavailable');
 assert.equal(answerDataChat(a,'what should I ask customers?').status,'answer');
});

test('fixed demo end-of-month clock uses the complete month; last month remains the prior calendar month',()=>{
 const finished=analyze(rows,{asOf:'2026-10-31T12:00:00Z'});
 const latest=answerDataChat(finished,'show sales');assert.match(latest.text,/2026-10/);assert.doesNotMatch(latest.caveats.join(' '),/current month is partial/);
 assert.match(answerDataChat(finished,'sales latest completed month').text,/2026-10/);
 assert.match(answerDataChat(finished,'sales last month').text,/2026-09/);
 const partial=answerDataChat(a,'sales this month');assert.match(partial.text,/2026-10/);assert.match(partial.caveats.join(' '),/partial/);
});
