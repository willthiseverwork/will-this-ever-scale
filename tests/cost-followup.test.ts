import {test} from 'node:test';
import assert from 'node:assert/strict';
import {answerCostFollowup,costFollowupContext} from '../lib/cost-followup';
import {costResult} from '../lib/cost-interview';
import {newInterview,proposeValue,confirmValue,skipValue} from '../lib/voice/interview-engine';

const shop={averageOrder:55,unitsPerOrder:1,pricePerUnit:55,currency:'USD',unitName:'necklace'};
function makeContext(){let state=newInterview('reseller');for(const [field,value,basis] of [['units',1,'order'],['buy',8,'unit'],['post',3,'order']] as const){state=confirmValue(proposeValue(state,field,{value,basis,said:''},shop).state,field)}state=skipValue(skipValue(state,'pay'),'helpers');return costFollowupContext('Necklaces','USD',costResult({kind:'reseller',answers:{buy:8,post:3},cameIn:55,fee:2.83,units:1,ordersPerMonth:10}),state)}
test('completed cost interpretation answers the observed profit question without inventing unknown costs',()=>{
 const context=makeContext();const answer=answerCostFollowup("I sell one necklace per order. Does the $41.17 mean profit, and what should I check before deciding what to do next? I know the necklace costs $8 and postage is $3, but I don't know the time or helper costs yet.",context,'Necklaces')!;
 assert.match(answer,/\$41\.17 left per sale/);assert.match(answer,/estimated PayPal fee \$2\.83 based on shop-wide fees/);assert.match(answer,/buying \$8\.00/);assert.match(answer,/posting \$3\.00/);assert.match(answer,/not necessarily your full profit/i);assert.match(answer,/Not counted yet: your time per order, help per month/i);assert.match(answer,/packaging/i);assert.doesNotMatch(answer,/time.*\$0\.00|help.*\$0\.00/i);
});
test('profit follow-up cannot borrow an absent, different or mismatched result',()=>{
 const q='Does the $41.17 mean profit?';assert.match(answerCostFollowup(q,null,'Necklaces')!,/Complete a cost check/);assert.match(answerCostFollowup(q,makeContext(),'Earrings')!,/different item/);assert.match(answerCostFollowup('Does $90 mean profit?',makeContext(),'Necklaces')!,/does not match/);
});
test('unrelated questions continue to the existing chat path',()=>{assert.equal(answerCostFollowup('How many necklace orders did I have?',makeContext(),'Necklaces'),null);assert.equal(answerCostFollowup('Which month had the most sales?',null),null);assert.equal(answerCostFollowup('What is my profit last month?',makeContext()),null)});
