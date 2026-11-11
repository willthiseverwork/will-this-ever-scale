import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mathEquation} from '../lib/display';
import {findingPresentation} from '../lib/finding-presentation';
import {leadSummary} from '../components/lead-card';
import {judgeChat} from '../lib/judge-chat';
import {analyze} from '../lib/engine';
import rows from './fixtures/demo-rows-chat.json';
import type {Txn} from '../lib/types';
test('lead card and chat use the same buyer scenario on demo fixture',()=>{
 const a=analyze(rows as Txn[],{asOf:'2026-11-11T09:00:00Z'}),top=a.ranked_leaks.find(x=>x.id==='one_time_buyers')!;
 const p=findingPresentation(top),s=leadSummary(a,top),chat=judgeChat('What should I do first?',a,rows as Txn[],new Date('2026-11-11T09:00:00Z'));
 assert.equal(s.amount,p.amount);assert.equal(s.condition,p.condition);assert.ok(chat?.text.includes(s.condition));assert.match(chat!.text,/About \+\$/);
});
test('math equation does not claim seller costs before they are supplied',()=>{
 assert.equal(mathEquation(false,false),'Reached you = came in − PayPal fees − refunds. Your costs aren’t in yet.');
 assert.equal(mathEquation(true,false),'You keep = came in − PayPal fees − refunds − your costs');
 assert.equal(mathEquation(true,true),'You keep = came in − PayPal fees − refunds − your costs − ads');
});
test('Plan and quiet-regular face use the approved labels',()=>{
 const source=readFileSync(new URL('../components/scale-tool.tsx',import.meta.url),'utf8');
 assert.match(source,/NEXT · ANOTHER WAY TO SELL MORE/);assert.match(source,/Up to \+\{money\(total,currency\)\}/);assert.match(source,/if all \$\{people.length\} order once more/);
});

test('PayPal demo lead and finding methods do not refer to a file',async()=>{
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const {LeadCard}=await import('../components/lead-card');
 const a=analyze(rows as Txn[],{asOf:'2026-11-11T09:00:00Z'}),lead=a.ranked_leaks.find(x=>x.id==='one_time_buyers')!;
 const html=renderToStaticMarkup(React.createElement(LeadCard,{analysis:a,leak:lead,answers:{},save:()=>{},paypalDemo:true}));
 assert.doesNotMatch(html,/\bfile\b/i);
 for(const f of [...a.ranked_leaks,...a.action_findings||[]]) assert.doesNotMatch(f.method,/\bfile\b/i);
});
