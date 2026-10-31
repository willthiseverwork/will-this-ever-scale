import {test} from 'node:test';
import assert from 'node:assert/strict';
import {extractIntentInput,intentInputSchema,validateIntentPlan} from '../lib/chat-intent';
const months=['2026-08','2026-09'];
test('only fixed semantic tokens and available month IDs leave the browser',()=>{
 const input=extractIntentInput('show total turnover 2026-09',months);assert.deepEqual(input,{tokens:['summary','gross'],months:['2026-09']});
 assert.equal(extractIntentInput('show total turnover for Jane 2026-09',months),null);
 assert.equal(extractIntentInput('show orders jane@example.com 2026-09',months),null);
 assert.equal(extractIntentInput('show total turnover 2026-07',months),null);
 assert.equal(intentInputSchema.safeParse({tokens:['gross'],months:[],question:'private'}).success,false);
});
test('plans cannot introduce metrics, actions, extra fields or unsupplied periods',()=>{
 const input=extractIntentInput('show total turnover 2026-09',months)!;
 assert.ok(validateIntentPlan({kind:'summary',metric:'gross',period:{kind:'month',month:'2026-09'}},input));
 assert.equal(validateIntentPlan({kind:'summary',metric:'refunds',period:{kind:'month',month:'2026-09'}},input),null);
 assert.equal(validateIntentPlan({kind:'summary',metric:'gross',period:{kind:'month',month:'2026-08'}},input),null);
 assert.equal(validateIntentPlan({kind:'summary',metric:'gross',period:{kind:'whole'}},input),null);
 assert.equal(validateIntentPlan({kind:'summary',metric:'gross',period:{kind:'month',month:'2026-09'},sql:'DROP'},input),null);
 assert.equal(validateIntentPlan({kind:'send_email'},input),null);
});
