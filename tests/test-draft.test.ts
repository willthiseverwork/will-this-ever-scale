import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTestPrompt,draftTest,fillValidatedTest,testDraftSchema,validTestDraft} from '../lib/test-draft';
import {testFor} from '../lib/playbook';

const input={leakId:'small_order_fees',answerIds:['no'],template:'Offer {small_group} as a set of two at a small discount.',numbers:{small_share:30}};
test('test sentence validator preserves placeholders and rejects numbers, causes and jargon',async()=>{
 assert.equal(validTestDraft('Offer {small_group} together at a small discount.',input.template),true);
 for(const invalid of ['Offer {small_group} together at 2 dollars.','Offer {small_group} together because buyers need value.','Optimize {small_group} together.','Offer {item} together at a small discount.'])assert.equal(validTestDraft(invalid,input.template),false);
 const result=await draftTest(input,async prompt=>{assert.doesNotMatch(prompt,/Private|private@example/i);return 'Offer {small_group} together at a small discount.';});
 assert.deepEqual(result,{sentence:'Offer {small_group} together at a small discount.',source:'ai'});
 assert.equal(fillValidatedTest(result.sentence,input.template,{small_group:'Private earrings'}),'Offer Private earrings together at a small discount.');
});
test('test payload is strict and carries only answer IDs, static template and engine numbers',()=>{
 assert.equal(testDraftSchema.safeParse({...input,item_title:'Private earrings'}).success,false);
 assert.equal(testDraftSchema.safeParse({...input,email:'private@example.com'}).success,false);
 assert.equal(testDraftSchema.safeParse({...input,rows:[]}).success,false);
 const selected=testFor('small_order_fees',{sets:'no'},{small_share:30,threshold:20,small_group:'Private earrings'});
 const payload={leakId:selected.leakId,answerIds:selected.answerIds,template:selected.template,numbers:selected.numbers};
 assert.doesNotMatch(JSON.stringify(payload),/Private|title|email|rows/i);
 assert.doesNotMatch(buildTestPrompt(input),/Private|private@example/i);
});
