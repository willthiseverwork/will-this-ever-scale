import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import fixture from './fixtures/demo-rows-chat.json';
import {filterDemoTransactions} from '../lib/demo-catalog';
import {analyze} from '../lib/engine';
import {bundleOffer} from '../lib/bundle-offer';
import {quietRegulars} from '../lib/quiet-offer';
import {judgeChat} from '../lib/judge-chat';
import type {ProductGroupingSummary,Txn} from '../lib/types';

// The committed rows are already normalized. Adapt their item evidence to the
// provider filter, retaining invoice observations separately as production does.
const all=fixture as Txn[];
const provider=all.filter(r=>r.kind==='sale'||r.kind==='refund').map(row=>({
 row,transaction_info:{transaction_id:row.id,transaction_amount:{value:row.gross},transaction_event_code:row.kind==='refund'?'T1107':'T0000'},
 cart_info:{item_details:row.cart_items?.map(i=>({item_name:i.name}))||[{item_name:row.item_title}]}
}));
const allowed=new Set(filterDemoTransactions(provider).map(x=>x.row.id));
const rows=all.filter(r=>!['sale','refund'].includes(r.kind)||allowed.has(r.id));
// Reconstruct the snapshot's product groups from the item_group fields already
// present in these rows; no live snapshot or contacts are read by this test.
const groups=new Map<string,Set<string>>();
for(const row of rows)if(row.item_title&&row.item_group){const titles=groups.get(row.item_group)||new Set<string>();titles.add(row.item_title);groups.set(row.item_group,titles);}
const grouping={groups:[...groups].map(([name,titles])=>({name,titles:[...titles]}))} as ProductGroupingSummary;
const questions=['Most popular product','Which product has the most refunds in the latest completed month?','How much did I make in the latest completed month?','Compare sales last month vs this month','What should I ask customers?'];
const customerAnswer='Learn what would make another order useful: How has the item worked for you since it arrived? When, if ever, would you consider buying something like this again? What would make a future purchase useful to you?';
const dates=[
 ['2026-11-11T09:00:00Z',41,163,34.88],
 ['2026-12-01T09:00:00Z',61,183,32.87],
 ['2026-12-08T09:00:00Z',68,190,31.53],
 ['2026-12-15T09:00:00Z',75,197,30.18],
 ['2026-12-16T20:00:00Z',76,198,30.18]
] as const;
test('catalog filter removes foreign sale and refund while preserving six invoice observations',()=>{
 assert.equal(all.length,161);assert.equal(rows.length,159);
 assert.equal(rows.filter(r=>r.invoice_id).length,6);
 assert.equal(rows.some(r=>JSON.stringify(r).includes('Will This Ever Work ASO AI listing')),false);
 const before=analyze(all,{asOf:dates[0][0]}),after=analyze(rows,{asOf:dates[0][0]});
 assert.equal(before.period_summaries!.whole.orders,154);assert.equal(before.money_map.came_in,4776);
 assert.equal(after.period_summaries!.whole.orders,153);assert.equal(after.money_map.came_in,4771);
 assert.equal(before.money_map.refunds-after.money_map.refunds,5);
});
for(const [date,oldest,quietAge,setAmount] of dates)test(`judge path ${date}`,()=>{
 const now=new Date(date),a=analyze(rows,{asOf:date}),invoice=a.action_findings?.find(x=>x.id==='unpaid_invoices');
 assert.equal(a.period_summaries!.whole.orders,153);assert.equal(a.money_map.came_in,4771);
 assert.equal(invoice?.evidence.invoices,6);assert.equal(invoice?.one_off_amount,1080);assert.equal(a.invoice_observations?.oldest_unpaid_days,oldest);assert.equal(invoice?.card?.help.label,'Remind them in PayPal');
 const set=a.ranked_leaks.find(x=>x.id==='sets');assert.equal(set?.money_per_month,setAmount);
 const offer=bundleOffer(rows,grouping,a.currency);assert.deepEqual(offer&&[offer.a,offer.b,offer.coOrders,offer.price,offer.gain],['earrings','rings',8,32,216]);
 const quiet=quietRegulars(rows,a.currency);assert.equal(quiet.length,4);assert.ok(quiet.every(x=>x.orders>=3));assert.ok(a.ranked_leaks.some(x=>x.id==='lapsed_buyers'));
 assert.equal(Math.floor((now.getTime()-Date.parse(quiet.map(x=>x.last).sort().at(-1)!))/86400000),quietAge);
 assert.equal(a.months.length,13);assert.equal(a.months[0].month,'2025-11');assert.equal(a.months.at(-1)?.month,'2026-11');
 const prior=date.startsWith('2026-11')?'2026-10':'2026-11',last=a.months.find(x=>x.month===prior);assert.equal(last?.orders,prior==='2026-10'?11:40);assert.equal(last?.cameIn,prior==='2026-10'?271:1440);
 const answers=questions.map(q=>judgeChat(q,a,rows,now)?.text);assert.equal(answers[0],'Earrings has the highest orders (81) from 7 November 2025 to 3 November 2026.');assert.equal(answers[4],customerAnswer);
 if(prior==='2026-10'){
  assert.equal(answers[1],'No refunds in October 2026.');assert.equal(answers[2],'In October 2026, sales were $271.00. After PayPal fees ($14.19) and refunds ($0.00), $256.81 reached your account; costs are not counted yet.');assert.equal(answers[3],'Sales were $271.00 in October 2026 and $1,440.00 in November 2026 so far.');
 }else{
  assert.equal(answers[1],'No refunds in November 2026.');assert.equal(answers[2],'In November 2026, sales were $1,440.00. After PayPal fees ($66.80) and refunds ($0.00), $1,373.20 reached your account; costs are not counted yet.');assert.equal(answers[3],'Sales data is not available for both November 2026 and December 2026.');
 }
 assert.ok(answers.every(x=>x&&!/NaN|\$-/.test(x)));
});
// Product decision needed: choose wording that marks the current month as partial.
// node:test uses TODO for an expected failing test; this repository does not use Vitest.
test('current-month chart identifies its partial month',{todo:'Dasha: approve partial-month wording'},()=>{
 const source=readFileSync(new URL('../components/scale-tool.tsx',import.meta.url),'utf8');
 const chart=source.slice(source.indexOf('function MonthlyChart('),source.indexOf('function BestSellers('));
 assert.ok(/so far|partial month|month to date/i.test(chart),'Current month needs a visible partial-period label');
});
