import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../lib/engine';
import { demoTransactions, DEMO_AS_OF } from '../lib/demo';
import { micropaymentSaving, setsFinding, smallFeeFinding } from '../lib/fix-cards';
import type { Txn } from '../lib/types';

const order=(id:string,gross:number,fee:number):Txn=>({id,date:'2026-10-01',kind:'sale',gross,fee,net:gross-fee,currency:'USD',country:'US'});
test('micropayment savings use the crossover and require eligible rates and US account',()=>{
  for(const [g,expected] of [[5,.325],[10,.25],[20,.1],[26.67,0],[30,0]]) assert.ok(Math.abs(micropaymentSaving(g)-expected)<1e-9);
  const rows=Array.from({length:240},(_,i)=>order(String(i),5,.66));
  assert.equal(smallFeeFinding(rows,'USD',undefined,new Date(DEMO_AS_OF)),undefined);
  assert.ok(smallFeeFinding(rows,'USD','US',new Date(DEMO_AS_OF)));
  assert.equal(smallFeeFinding(rows.map(x=>({...x,fee:.34})),'USD','US',new Date(DEMO_AS_OF)),undefined);
});
test('sets need actual cart evidence and pairs, not single item titles',()=>{
  const rows=Array.from({length:90},(_,i)=>({...order(String(i),30,1.54),item_title:'Ring'}));
  assert.equal(setsFinding(rows,new Date(DEMO_AS_OF)),undefined);
  const withCart=rows.map(x=>({...x,cart_items:[{name:'Ring',quantity:1,unit_price:30}]}));
  withCart[0].cart_items.push({name:'Necklace',quantity:1,unit_price:30});
  assert.ok(setsFinding(withCart,new Date(DEMO_AS_OF)));
});
test('demo lesson cards carry every required part and do not suggest prohibited payment methods',()=>{
  const a=analyze(demoTransactions(),{asOf:DEMO_AS_OF,homeCountry:'US'});
  for(const id of ['one_time_buyers','refunds_one_item','small_order_fees','sets','held_money','unpaid_invoices']) assert.ok(a.cards?.find(c=>c.id===id),id);
  for(const c of a.cards||[]){assert.ok(c.title&&c.so_what&&c.steps.length&&c.help.label&&c.check.metric);assert.ok(Number.isFinite(c.money.amount));assert.equal(c.check.days,30);assert.doesNotMatch(JSON.stringify(c),/Friends and Family/i);}
});
test('demo keeps its ordered story and exposes both action findings',()=>{
  const a=analyze(demoTransactions(),{asOf:DEMO_AS_OF,homeCountry:'US'});
  assert.equal(a.ranked_leaks[0].id,'one_time_buyers');
  const next=a.ranked_leaks.slice(1).find(l=>!l.label);
  assert.equal(next?.id,'refunds_one_item');
  assert.equal(next?.money_per_month,75);
  assert.match(next?.card?.money_math||'',/\$450\.00 refunded over 3 months ÷ 3 × 50% prevented ≈ \$75\.00/);
  assert.ok(a.risks?.some(r=>r.id==='one_item_dependence'&&Number(r.evidence.share)>50));
  assert.ok(a.small_leaks.length>0);
  assert.equal(a.quick_win?.id,'unpaid_invoices');assert.equal(a.quick_win?.one_off_amount,540);
  assert.equal(a.action_findings?.find(l=>l.id==='held_money')?.one_off_amount,210);
});
test('held money requires both confirmed current hold and confirmed missing tracking',()=>{
  const base=order('sale',50,2.24),hold={...order('held',40,1.89),hold_confirmed:true,tracking_present:false};
  assert.ok(analyze([base,hold],{asOf:DEMO_AS_OF}).cards?.find(c=>c.id==='held_money'));
  assert.equal(analyze([base,{...hold,tracking_present:undefined}],{asOf:DEMO_AS_OF}).cards?.find(c=>c.id==='held_money'),undefined);
  assert.equal(analyze([base,{...hold,hold_confirmed:undefined,status:'Pending'}],{asOf:DEMO_AS_OF}).cards?.find(c=>c.id==='held_money'),undefined);
});
