import assert from 'node:assert/strict';
import test from 'node:test';
import {costResult,parseRoughAmount} from '../lib/cost-interview';

test('parses the interview’s plain-language amounts without AI',()=>{
 assert.equal(parseRoughAmount('a fiver'),5);assert.equal(parseRoughAmount('5-ish'),5);assert.equal(parseRoughAmount('3 to 5'),4);assert.equal(parseRoughAmount('a third',true),.33);assert.equal(parseRoughAmount("don't know"),undefined);
});
test('calculates reseller and maker costs including waste and a negative result',()=>{
 const reseller=costResult({kind:'reseller',answers:{buy:8,post:3,pay:2,helpers:20},cameIn:20,fee:1,units:1,ordersPerMonth:20});
 assert.equal(reseller.cost,14);assert.equal(reseller.keep,5);
 const maker=costResult({kind:'maker',answers:{batch:30,pieces:10,waste:.3,post:3,pay:2},cameIn:8,fee:1,units:1,ordersPerMonth:10});
 assert.equal(Math.round(maker.cost*100)/100,9.29);assert.equal(Math.round(maker.keep*100)/100,-2.29);assert.ok((maker.negativeRaise||0)>0);assert.ok((maker.wasteGain||0)>0);
});
test('a quarter waste is exactly 25 percent',()=>{
 const maker=costResult({kind:'maker',answers:{batch:40,pieces:20,waste:.25},cameIn:10,fee:0,units:1,ordersPerMonth:1});
 assert.equal(Math.round((maker.parts[0].value||0)*100)/100,2.67);
 assert.equal(Math.round((maker.wasteGain||0)*100)/100,0.38);
});
test('uses the seller-confirmed units, not an implausible upload quantity',()=>{
 const result=costResult({kind:'reseller',answers:{units:1,buy:8,post:3},cameIn:22.03,fee:.98,units:1,ordersPerMonth:20});
 assert.equal(result.cost,11);
 assert.equal(Math.round(result.keep*100)/100,10.05);
 assert.equal(result.cost>result.cameIn*3,false);
});
