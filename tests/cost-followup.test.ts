import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderCostFollowup,costFollowupContext} from '../lib/cost-followup';
import {costResult} from '../lib/cost-interview';
import {newInterview,proposeValue,confirmValue,skipValue} from '../lib/voice/interview-engine';

const shop={averageOrder:55,unitsPerOrder:1,pricePerUnit:55,currency:'USD',unitName:'necklace'};
function makeContext(){let state=newInterview('reseller');for(const [field,value,basis] of [['units',1,'order'],['buy',8,'unit'],['post',3,'order']] as const){state=confirmValue(proposeValue(state,field,{value,basis,said:''},shop).state,field)}state=skipValue(skipValue(state,'pay'),'helpers');return costFollowupContext('Necklaces','USD',costResult({kind:'reseller',answers:{buy:8,post:3},cameIn:55,fee:2.83,units:1,ordersPerMonth:10}),state)}
test('explicit cost explanation preserves the calculated amount and unknown costs',()=>{
 const context=makeContext();const answer=renderCostFollowup(context);
 assert.match(answer,/\$41\.17 left per sale/);assert.match(answer,/estimated PayPal fee \$2\.83 based on shop-wide fees/);assert.match(answer,/buying \$8\.00/);assert.match(answer,/posting \$3\.00/);assert.match(answer,/not necessarily your full profit/i);assert.match(answer,/Not counted yet: your time, help per month/i);assert.match(answer,/packaging/i);assert.doesNotMatch(answer,/time.*\$0\.00|help.*\$0\.00/i);
});
