import test from 'node:test';import assert from 'node:assert/strict';import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';import VisitCostResult from '../components/visit-cost-result';import {visitCost} from '../lib/visit-cost';import type {Txn} from '../lib/types';
test('cost check renders the five lines and terms without business controls',()=>{const rows=Array.from({length:6},(_,i)=>({id:String(i),date:'2026-10-01',kind:'sale',gross:55,fee:-2.56,fee_known:true,net:52.44,currency:'USD',status:'completed',item_title:'silver hoops',cart_complete:true,cart_items:[{name:'silver hoops',quantity:1,unit_price:55}]} as Txn));const v=visitCost({rows,title:'silver hoops',currency:'USD',kind:'reseller',answers:{units:1,buy:18,post:4,notApplicable:['pay','helpers']},ordersPerMonth:6});assert.equal(v.status,'available');if(v.status!=='available')return;const html=renderToStaticMarkup(React.createElement(VisitCostResult,{value:v,currency:'USD',item:'silver hoops'}));for(const text of ['You keep about $30.44','Buyer pays','$55.00','PayPal fee','−$2.56','Your costs','−$22.00','You keep','$30.44','Based on 6 orders','/terms'])assert.ok(html.includes(text),text);assert.doesNotMatch(html,/type="date"|type="checkbox"|Workspace/);const full=renderToStaticMarkup(React.createElement(VisitCostResult,{value:v,currency:'USD',item:'silver hoops',full:true}));for(const text of ['Real cost','silver hoops','what PayPal recorded on these orders','buying $18.00','postage and packing $4.00'])assert.ok(full.includes(text),text)});

test('results numbers show both halves before and after visit costs',async()=>{
 const {default:ResultsNumbers}=await import('../components/results-numbers');
 const {analyze}=await import('../lib/engine');
 const rows=Array.from({length:6},(_,i)=>({id:String(i),date:'2026-10-01',kind:'sale',gross:55,fee:-2.56,fee_known:true,net:52.44,currency:'USD',status:'completed',item_title:'silver hoops',cart_complete:true,cart_items:[{name:'silver hoops',quantity:1,unit_price:55}]} as Txn));
 const analysis=analyze(rows,{asOf:'2026-11-01T00:00:00Z'});
 const base={analysis,source:'PayPal sandbox',shop:'',demo:true};
 const before=renderToStaticMarkup(React.createElement(ResultsNumbers,{...base,entry:null}));
 for(const text of ['Your shop’s numbers','From PayPal','From you','not yet','Add your costs','Use example answers'])assert.ok(before.includes(text),text);
 const answers={units:1,buy:18,post:4,notApplicable:['pay','helpers'] as ('pay'|'helpers')[]};const value=visitCost({rows,title:'silver hoops',currency:'USD',kind:'reseller',answers,ordersPerMonth:6});assert.equal(value.status,'available');if(value.status!=='available')return;
 const entry={item:'silver hoops',raw:'silver hoops',currency:'USD',kind:'reseller' as const,answers,value};
 const after=renderToStaticMarkup(React.createElement(ResultsNumbers,{...base,entry}));
 for(const text of ['From PayPal','From you','You keep on a silver hoop order','$30.44','this visit','not counted'])assert.ok(after.includes(text),text);
});

test('cost answer summary renders values and unknown time without relying on interview state',async()=>{
 const {default:CostAnswerSummary}=await import('../components/cost-answer-summary');
 const {costResult}=await import('../lib/cost-interview');
 const answers={units:1,buy:18,post:4};const result=costResult({kind:'reseller',answers,cameIn:55,fee:2.56,units:1,ordersPerMonth:6,currency:'USD'});
 const html=renderToStaticMarkup(React.createElement(CostAnswerSummary,{result,answers,item:'necklace',currency:'USD'}));
 for(const text of ['$18.00','$4.00','Your time','skipped'])assert.ok(html.includes(text),text);
});

test('range signs distinguish the cost card from the Results equation',async()=>{
 const {default:ResultsNumbers}=await import('../components/results-numbers');const {analyze}=await import('../lib/engine');
 const rows=Array.from({length:6},(_,i)=>({id:String(i),date:'2026-10-01',kind:'sale',gross:55,fee:-2.56,fee_known:true,net:52.44,currency:'USD',status:'completed',item_title:'silver hoops',cart_complete:true,cart_items:[{name:'silver hoops',quantity:1,unit_price:55}]} as Txn));
 const answers={units:1,post:1,ranges:{buy:{min:2.42,max:3.42}},notApplicable:['pay','helpers'] as ('pay'|'helpers')[]};const value=visitCost({rows,title:'silver hoops',currency:'USD',kind:'reseller',answers,ordersPerMonth:6});assert.equal(value.status,'available');if(value.status!=='available')return;
 const card=renderToStaticMarkup(React.createElement(VisitCostResult,{value,currency:'USD',item:'silver hoops'}));assert.match(card,/−\$3\.42 to −\$4\.42/);
 const analysis=analyze(rows,{asOf:'2026-11-01T00:00:00Z'});const entry={item:'silver hoops',raw:'silver hoops',currency:'USD',kind:'reseller' as const,answers,value};const results=renderToStaticMarkup(React.createElement(ResultsNumbers,{analysis,source:'test',shop:'',demo:true,entry}));assert.match(results,/− your costs \$3\.42 to \$4\.42/);assert.doesNotMatch(results,/your costs.*−\$4\.42/);
});
