import test from 'node:test';
import assert from 'node:assert/strict';
import {bestMonthAction,evidenceLine} from '../lib/display';
import {itemAnswer} from '../lib/item-answer';
import type {Txn,Leak} from '../lib/types';

test('best month reminders use the first of the preceding month and wrap years',()=>{
 const now=new Date(2026,10,3);
 assert.match(bestMonthAction('2025-11',now),/start now/);
 assert.match(bestMonthAction('2025-01',now),/start now/);
 assert.equal(bestMonthAction('2025-09',now),'Add a reminder for 1 August.');
 assert.equal(bestMonthAction('2025-03',now),'Add a reminder for 1 February.');
});
test('group labels describe each sale without a false singular',()=>{
 const leak={id:'below_cost_items',evidence:{item:'Necklaces'}} as unknown as Leak;
 assert.match(evidenceLine(leak,'GBP'),/Each sale of necklaces/i);
});
test('named item answer counts sale orders and actual fees, excluding refunds',()=>{
 const rows=[{kind:'sale',item_group:'Gift pouches',gross:3,fee:-.60},{kind:'refund',item_group:'Gift pouches',gross:-3,fee:0},{kind:'sale',item_group:'Earrings',gross:20,fee:-1}] as Txn[];
 const answer=itemAnswer(rows,'Gift pouches','GBP')!;
 assert.match(answer,/1 order, £3.00 in sales, £3.00 per order, and about 20%/);
 assert.doesNotMatch(answer,/highest/);
});
