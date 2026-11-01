import {test} from 'node:test';
import assert from 'node:assert/strict';
import {isBoundTestCheckout} from '../lib/billing-test-link';
test('payment link continues only the owner-bound transaction with a sandbox token and checkout permission',()=>{const state={canCheckout:true,paymentLink:{transactionId:'txn_ABC123',clientToken:'test_123'}};assert.equal(isBoundTestCheckout('txn_ABC123',state),true);assert.equal(isBoundTestCheckout('txn_OTHER',state),false);assert.equal(isBoundTestCheckout('https://evil.example',state),false);assert.equal(isBoundTestCheckout('txn_ABC123',{...state,canCheckout:false}),false);assert.equal(isBoundTestCheckout('txn_ABC123',{...state,paymentLink:{...state.paymentLink,clientToken:'live_123'}}),false);assert.equal(isBoundTestCheckout('txn_ABC123',null),false);});
