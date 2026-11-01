import test from 'node:test';
import assert from 'node:assert/strict';
import {fallbackProductGrouping,groupingPrompt,validateProductGrouping} from '../lib/product-groups';

const items=[{title:'LUNCH BAG RED RETROSPOT',orders:4},{title:'LUNCH BAG BLACK SKULL',orders:2},{title:'TEA TOWEL',orders:1}];
test('accepts only exact, non-overlapping title assignments and keeps the shop summary',()=>{
 const grouping=validateProductGrouping({shop:'This shop sells lunch bags and home goods.',groups:[{name:'Lunch bags',titles:['LUNCH BAG RED RETROSPOT','LUNCH BAG BLACK SKULL']}],unplaced:['TEA TOWEL']},items);
 assert.deepEqual(grouping,{shop:'This shop sells lunch bags and home goods.',groups:[{name:'Lunch bags',titles:['LUNCH BAG RED RETROSPOT','LUNCH BAG BLACK SKULL']}],unplaced:['TEA TOWEL'],source:'ai'});
 assert.equal(validateProductGrouping({shop:'x',groups:[{name:'Lunch bags',titles:['LUNCH BAG RED RETROSPOT','LUNCH BAG RED RETROSPOT']}],unplaced:[]},items),null);
});
test('fallback groups known variants locally and the prompt contains only title/count inventory',()=>{
 const fallback=fallbackProductGrouping(items);assert.deepEqual(fallback.groups,[{name:'Lunch bags',titles:['LUNCH BAG RED RETROSPOT','LUNCH BAG BLACK SKULL']}]);assert.deepEqual(fallback.unplaced,['TEA TOWEL']);
 const prompt=groupingPrompt(items);assert.match(prompt,/LUNCH BAG RED RETROSPOT/);assert.match(prompt,/"orders":4/);assert.doesNotMatch(prompt,/buyer@example\.com|txn_[a-z0-9]+/i);
});
