import {test} from 'node:test';
import assert from 'node:assert/strict';
import {testCheckoutEvent} from '../lib/billing-test-events';
test('only Paddle checkout lifecycle events update status',()=>{assert.equal(testCheckoutEvent('opening',{name:'checkout.loaded',data:{email:'private'}}),'loaded');assert.equal(testCheckoutEvent('loaded',{name:'checkout.closed'}),'closed');assert.equal(testCheckoutEvent('loaded',{name:'checkout.completed'}),'completed');assert.equal(testCheckoutEvent('completed',{name:'checkout.closed'}),'completed');assert.equal(testCheckoutEvent('opening',{name:'checkout.error',detail:'private'}),'error');assert.equal(testCheckoutEvent('opening',{name:'unknown'}),'opening');assert.equal(testCheckoutEvent('opening',null),'opening');});
