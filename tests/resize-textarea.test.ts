import {test} from 'node:test';
import assert from 'node:assert/strict';
import {resizeTextarea} from '../lib/resize-textarea';

test('textarea remeasures content after growth, narrower wrapping and shortening',()=>{
 let contentHeight=101, height='';
 const field={style:{get height(){return height},set height(value:string){height=value}},get scrollHeight(){assert.equal(height,'auto');return contentHeight},offsetHeight:93,clientHeight:91} as unknown as HTMLTextAreaElement;
 resizeTextarea(field);assert.equal(height,'103px');
 contentHeight=145;resizeTextarea(field);assert.equal(height,'147px');
 contentHeight=72;resizeTextarea(field);assert.equal(height,'74px');
});
