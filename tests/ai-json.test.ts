import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAiJson} from '../lib/ai-json';

test('accepts one plain or fenced JSON object and rejects other model text',()=>{
 assert.deepEqual(parseAiJson('{"plan":true}'),{plan:true});
 assert.deepEqual(parseAiJson('```json\n{"plan":true}\n```'),{plan:true});
 assert.equal(parseAiJson('Here is the JSON: {"plan":true}'),null);
});
