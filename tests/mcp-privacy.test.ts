import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {projectProduct} from '../lib/mcp-tools';
test('product labels are omitted until explicit consent and unrelated fields never leave',()=>{
 const item={id:'item_1',label:'Blue ring',labelReviewed:true as const,gross:9,orders:1,refunds:0,buyerEmail:'private@example.com'};
 const off=projectProduct(item,false),on=projectProduct(item,true);
 assert.equal('label' in off,false);assert.equal('label' in projectProduct({...item,labelReviewed:undefined},true),false);assert.equal(on.label,'Blue ring');assert.equal('buyerEmail' in on,false);
});
