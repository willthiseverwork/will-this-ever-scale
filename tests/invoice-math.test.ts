import test from 'node:test';
import assert from 'node:assert/strict';
import {depositAmount} from '../lib/invoice-math';
test('deposit uses the supplied order amount and percentage, with one cent rounding',()=>{
 assert.equal(depositAmount('180','50'),'90.00');
 assert.equal(depositAmount('19.99','25'),'5.00');
 assert.equal(depositAmount('180','100'),'180.00');
 assert.throws(()=>depositAmount('180','101'));
 assert.throws(()=>depositAmount('-180','50'));
});
