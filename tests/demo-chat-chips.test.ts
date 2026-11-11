import test from 'node:test';
import assert from 'node:assert/strict';
import rowsFixture from './fixtures/demo-rows-chat.json';
import {analyze} from '../lib/engine';
import {judgeChat} from '../lib/judge-chat';
import {filterDemoTransactions,transactionsForShop} from '../lib/demo-catalog';
import {sandboxAnalysis,sandboxReanalysisRows} from '../lib/paypal-analysis';
import {groupLocalRows} from '../lib/browser-analysis';
import type {Txn} from '../lib/types';
const rows=(rowsFixture as Txn[]).filter(x=>!JSON.stringify(x).includes('Will This Ever Work ASO AI listing'));
const now=new Date('2026-11-11T00:00:00Z');
const analysis=analyze(rows,{asOf:now.toISOString()});
const questions=['Most popular product','How much did I make in the latest completed month?','Which product has the most refunds in the latest completed month?','Compare sales last month vs this month','What should I ask customers?'];
const expected=['From November 2025 to November 2026, earrings appeared in the most orders: 81 orders. Necklaces had the most gross sales in orders containing it: $2,200.00.','In October 2026, sales were $271.00. After PayPal fees ($14.19) and refunds ($0.00), $256.81 reached your account; costs are not counted yet.','No refunds in October 2026.','Sales were $271.00 in October 2026 and $1,440.00 in November 2026 so far.','Learn what would make another order useful: How has the item worked for you since it arrived? When, if ever, would you consider buying something like this again? What would make a future purchase useful to you?'];
for(const [i,q] of questions.entries())test(`demo chip ${i+1}: ${q}`,()=>{const answer=judgeChat(q,analysis,rows,now);assert.ok(answer);assert.equal(answer.text,expected[i]);if(i===0)assert.match(answer.text,/most orders.*most gross sales/);if(i===1)assert.match(answer.text,/In October 2026, sales were .*PayPal fees .*refunds .*reached your account/);if(i===2)assert.match(answer.text,/October 2026/);if(i===3)assert.match(answer.text,/October 2026.*November 2026 so far/);if(i===4)assert.notEqual(answer.text,'I can answer questions about your sales, buyers, items, refunds and fees.');});
test('demo catalog excludes foreign sale, mixed carts and linked refunds before grouping and analysis',()=>{
 const tx=(id:string,amount:number,item:string,ref?:string)=>({transaction_info:{transaction_id:id,transaction_initiation_date:'2026-10-10T00:00:00Z',transaction_amount:{value:String(amount),currency_code:'USD'},transaction_event_code:amount<0?'T1107':'T0000',transaction_status:'S',...(ref?{paypal_reference_id:ref}:{})},cart_info:{item_details:[{item_name:item,item_quantity:'1',item_unit_price:{currency_code:'USD',value:'5'}}]}});
 const foreign=tx('foreign',5,'Will This Ever Work ASO AI listing'),refund=tx('refund',-5,'Will This Ever Work ASO AI listing','foreign'),allowed=tx('allowed',5,'  STUD EARRINGS  '),mixed=tx('mixed',5,'Stud earrings');mixed.cart_info.item_details.push({...mixed.cart_info.item_details[0],item_name:'Foreign item'});
 const input=[foreign,refund,allowed,mixed];assert.equal(transactionsForShop(input,false),input);const raw=filterDemoTransactions(input);assert.deepEqual(raw,[allowed]);const projected=sandboxReanalysisRows(raw,[],[],Buffer.alloc(32));const grouped=groupLocalRows(projected);const a=sandboxAnalysis(raw,[],{},now,[],Buffer.alloc(32));assert.ok(a);assert.doesNotMatch(JSON.stringify([grouped,a,judgeChat('Which product has the most refunds in the latest completed month?',a!,grouped.rows,now)]),/ASO AI listing|Foreign item/);assert.equal(a!.money_map.refunds,0);
});
test('month variants, year boundary and no refunds use UTC',()=>{for(const phrase of ['last month','previous month','latest completed month']){assert.match(judgeChat(`How much did I make in the ${phrase}?`,analysis,rows,now)!.text,/October 2026/);assert.match(judgeChat(`Which product has the most refunds in the ${phrase}?`,analysis,rows,now)!.text,/October 2026/);}const empty={...analysis,item_groups_by_period:{...analysis.item_groups_by_period,months:[]}} as typeof analysis;assert.equal(judgeChat('Which product has the most refunds in the latest completed month?',empty,rows,new Date('2027-01-01T00:00:00Z'))!.text,'No refunds in December 2026.');});

test('cached demo grouping drives both Results item names and the chat leaders',async()=>{
 const {groupDemoRows}=await import('../lib/demo-snapshot');
 const grouping={shop:'This shop sells jewelry.',groups:[{name:'Hoops',titles:['Silver hoops']},{name:'Earrings',titles:['Stud earrings']},{name:'Rings',titles:['Stacking rings']},{name:'Necklaces',titles:['Necklaces']},{name:'Jewelry',titles:['Jewelry order']}],unplaced:[],source:'ai' as const};
 let calls=0;const mock=async()=>{calls++;return Response.json(grouping)};
 const first=await groupDemoRows(rows,'https://example.test',null,mock);
 const cached=await groupDemoRows(rows,'https://example.test',first.cache,mock);
 assert.equal(calls,1);const results=analyze(cached.rows,{asOf:now.toISOString()});
 const popular=[...results.item_groups].filter(item=>item.orders>0).sort((a,b)=>b.orders-a.orders||b.gross-a.gross)[0];const best=results.item_groups[0];
 assert.notEqual(popular.name,best.name);const chat=judgeChat('Most popular product',results,cached.rows,now)!.text;
 assert.ok(chat.includes(popular.name));assert.ok(chat.includes(best.name));assert.match(chat,new RegExp(`${popular.orders} orders`));assert.match(chat,/most gross sales/);
 const noItems={...results,item_groups:[]};assert.equal(judgeChat('Most popular product',noItems,cached.rows,now)!.text,'There is no item data for this period.');
 const only={...results,item_groups:[popular]};assert.doesNotMatch(judgeChat('Most popular product',only,cached.rows,now)!.text,/most gross sales/);
});
