import {test} from 'node:test';import assert from 'node:assert/strict';import {speechChunks} from '../lib/voice/speech-chunks';
test('long chat answers are split without changing the answer text',()=>{const text=('A shop answer with numbers 123. ').repeat(200);const chunks=speechChunks(text);assert.ok(chunks.length>1);assert.ok(chunks.every(x=>x.length<=1400));assert.equal(chunks.join(''),text)});

test('splitting does not break Unicode characters',()=>{const text='a'.repeat(1399)+'😀'+'b'.repeat(1400);const chunks=speechChunks(text);assert.equal(chunks.join(''),text);assert.ok(chunks.every(x=>!/[\uD800-\uDBFF]$/.test(x)))});
