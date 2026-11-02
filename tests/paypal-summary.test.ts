import test from 'node:test';
import assert from 'node:assert/strict';
import {analyze} from '../lib/engine';
import {paypalSummary} from '../lib/paypal-summary';
import type {Txn} from '../lib/types';

test('PayPal summary uses whole-upload totals and never deducts seller costs',()=>{
  const rows:Txn[]=[
    {id:'a',date:'2026-01-03',kind:'sale',gross:100,fee:4,net:96,currency:'USD',buyer_key:'a'},
    {id:'b',date:'2026-03-21',kind:'sale',gross:60,fee:2,net:58,currency:'USD',buyer_key:'b'},
    {id:'r',date:'2026-03-24',kind:'refund',gross:-20,fee:0,net:-20,currency:'USD'},
  ];
  const summary=paypalSummary(analyze(rows,{costPerItem:30,monthlyAdSpend:50}));
  assert.deepEqual(summary,{period:'Jan 2026–Mar 2026',cameIn:160,fees:6,refunds:20,reachedAccount:134});
});
