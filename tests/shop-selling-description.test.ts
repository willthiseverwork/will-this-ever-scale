import {test} from 'node:test';
import assert from 'node:assert/strict';
import {shopSellingDescription} from '../lib/product-groups';

test('successful grouping yields a clean description; failed grouping stays silent',()=>{
 assert.equal(shopSellingDescription({source:'ai',shop:'This shop sells a variety of jewelry items.'}),'a variety of jewelry items');
 assert.equal(shopSellingDescription({source:'ai',shop:'a shop selling jewelry'}),'jewelry');
 assert.equal(shopSellingDescription({source:'fallback',shop:'This shop sells the items listed in its PayPal activity.'}),'');
 assert.equal(shopSellingDescription(undefined),'');
});

test('shop description is capitalized only where used as a standalone line',async()=>{const {capitalizeDescription}=await import('../lib/product-groups');assert.equal(capitalizeDescription('a variety of jewelry items'),'A variety of jewelry items');assert.equal(capitalizeDescription(''),'');});
