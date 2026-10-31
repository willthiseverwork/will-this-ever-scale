import test from 'node:test';
import assert from 'node:assert/strict';
import { analyze } from '../lib/engine';
import { demoTransactions, DEMO_AS_OF } from '../lib/demo';
import { calculationLines, displayMonth, displayedMoneyMap, headlineMonth, money, reconciledMoney, titleLowercase, verifiedInvoicesMatch } from '../lib/display';

test('displayed headline parts reconcile after rounding',()=>{
 const a=analyze(demoTransactions(),{asOf:DEMO_AS_OF,fixedFee:.49});
 const m=displayedMoneyMap(a)!;
 assert.equal(Math.round((m.cameIn-m.fees-m.refunds-m.costs-m.ads)*100),Math.round(m.kept*100));
 assert.equal(headlineMonth(a)?.month,'2026-10');
});
test('currency and mid-sentence item formatting',()=>{
 assert.equal(money(2.94,'USD'),'$2.94');
 assert.equal(money(-41,'USD',true),'−$41');
 assert.equal(titleLowercase('Stacking rings'),'stacking rings');
});
test('demo month-end is complete while seller current month remains in progress',()=>{
 const fixture=analyze(demoTransactions(),{asOf:DEMO_AS_OF});
 assert.equal(headlineMonth(fixture,new Date(2026,9,31,23))?.month,'2026-10');
 const seller={...fixture,clock_basis:'seller' as const};
 assert.equal(headlineMonth(seller,new Date(2026,9,31,23))?.month,'2026-09');
 assert.equal(headlineMonth(seller,new Date(2026,10,1,0))?.month,'2026-10');
});
test('monthly kept and column totals retain cents from displayed parts',()=>{
 const rows=[displayMonth({cameIn:102.4,fees:2.94,refunds:0,costs:0,ads:0}),displayMonth({cameIn:25.6,fees:1.25,refunds:0,costs:0,ads:0})];
 assert.equal(reconciledMoney(rows[0].kept,'USD'),'$99.06');
 const total=rows.reduce((s,r)=>s+r.kept,0);
 assert.equal(reconciledMoney(total,'USD'),'$123.81');
 assert.equal(Math.round(total*100),Math.round(rows.reduce((s,r)=>s+r.cameIn-r.fees-r.refunds-r.costs-r.ads,0)*100));
});
test('headline kept preserves cents and negative signs from displayed parts',()=>{
 const month=displayMonth({cameIn:100,fees:9.49,refunds:0,costs:0,ads:0});
 assert.equal(reconciledMoney(month.kept,'USD',true),'$90.51');
 const loss=displayMonth({cameIn:10,fees:2.94,refunds:10,costs:0,ads:0});
 assert.equal(reconciledMoney(loss.kept,'USD',true),'−$2.94');
});
test('refund formula uses observed total and chosen reduction',()=>{
 const a=analyze(demoTransactions(),{asOf:DEMO_AS_OF,fixedFee:.49});
 const l={id:'refunds_one_item',kind:'monthly' as const,money_per_month:10,method:'',assumption:{label:'Refunds reduced',value:50},evidence:{item:'Rings',refunds:60}};
 assert.match(calculationLines(l,a).at(-1)!,/\$60\.00 ÷ 3 × 50% ≈ \$10 a month/);
});
test('micropayments copy does not recommend sets or minimum orders',()=>{
 const a=analyze(demoTransactions(),{asOf:DEMO_AS_OF,fixedFee:.49});
 const l={id:'small_order_fees',kind:'monthly' as const,money_per_month:5,method:'',evidence:{small_orders:240,annual_savings:60}};
 assert.doesNotMatch(calculationLines(l,a).join(' '),/sets|minimum order/i);
 assert.match(calculationLines(l,a).at(-1)!,/÷ 12/);
});
test('approval review requires the same invoices, currencies, amounts and total',()=>{
 const requested=[{id:'sample',date:'2026-01-01',status:'unpaid',currency:'USD',amount:25}];
 const verified=[{id:'real-id',requestedId:'sample',title:'A real item',currency:'USD',amount:25,age_days:20}];
 assert.equal(verifiedInvoicesMatch(verified,requested,25),true);
 assert.equal(verifiedInvoicesMatch([{...verified[0],amount:26}],requested,25),false);
 assert.equal(verifiedInvoicesMatch([{...verified[0],currency:'EUR'}],requested,25),false);
 assert.equal(verifiedInvoicesMatch([{...verified[0],age_days:13}],requested,25),false);
 assert.equal(verifiedInvoicesMatch([{...verified[0],age_days:0}],requested,25,0),true);
 assert.equal(verifiedInvoicesMatch(verified,requested,26),false);
});
