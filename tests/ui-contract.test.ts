import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {analyze} from '../lib/engine';
import {demoTransactions,DEMO_AS_OF} from '../lib/demo';
import {calculationLines,displayedMoneyMap,money} from '../lib/display';

test('approved board placeholder amounts never become screen literals',()=>{
 const source=readFileSync(new URL('../components/scale-tool.tsx',import.meta.url),'utf8');
 for(const placeholder of ['$3,040','$2,770','$288','$152','$118','$84','$26','$16','$1,368','$46','$240','$120','76 buyers','INV2-8KQ3','Nov–Jan'])assert.ok(!source.includes(placeholder),placeholder);
 assert.doesNotMatch(source,/9 in 100|18 in 100/);
});
test('screen interaction labels are fixed and included in the consent analytics allowlist',()=>{
 const source=readFileSync(new URL('../components/scale-tool.tsx',import.meta.url),'utf8');
 const analytics=readFileSync(new URL('../components/analytics.tsx',import.meta.url),'utf8');
 for(const [,id] of source.matchAll(/data-analytics-id="([a-z_]+)"/g))assert.ok(analytics.includes(`'${id}'`),id);
 assert.doesNotMatch(source,/data-analytics-id=\{/);
});
test('reminder review visibly states when PayPal invoices are being read',()=>{
 const source=readFileSync(new URL('../components/scale-tool.tsx',import.meta.url),'utf8');
 assert.match(source,/Reading your invoices from PayPal…/);
});
test('uploads go directly to results, where the whole-file PayPal totals are shown before cards',()=>{
 const source=readFileSync(new URL('../components/scale-tool.tsx',import.meta.url),'utf8');
 assert.doesNotMatch(source,/router\.push\('\/questions'\)/);
 assert.match(source,/router\.push\('\/read'\)/);
 assert.match(source,/What PayPal shows/);
 assert.match(source,/PayPal kept/);
 assert.match(source,/Reached your account/);
 assert.match(source,/periodLabel\(a\.period\.start,a\.period\.end\)/);
});
test('storage failures keep browser results available and use the signed-in and duplicate-file copy',()=>{
 const source=readFileSync(new URL('../components/scale-tool.tsx',import.meta.url),'utf8');
 assert.match(source,/We couldn&apos;t save this file to your account\. Your results are below; upload again later to save it\./);
 assert.match(source,/Signed in: your file is saved privately to your account \(no names or emails\)\./);
 assert.match(source,/uploaded \$\{count\} times/);
 assert.doesNotMatch(source,/Upload unavailable\./);
});
test('two source fixtures change displayed numbers and repeat formula rounds within one dollar',()=>{
 const rows=demoTransactions(),a=analyze(rows,{asOf:DEMO_AS_OF,homeCountry:'US'});
 const b=analyze(rows.map(row=>({...row,gross:row.gross*2,fee:row.fee*2,net:row.net*2})),{asOf:DEMO_AS_OF});
 assert.notEqual(displayedMoneyMap(a)?.cameIn,displayedMoneyMap(b)?.cameIn);
 for(const analysis of [a,b]){
  const leak=analysis.ranked_leaks.find(x=>x.id==='one_time_buyers')!;
  const e=leak.evidence;
  const shownAverage=Number(Number(e.average_order).toFixed(2));
  assert.ok(Math.abs(Number(e.people_back)*shownAverage-(leak.money_per_month||0))<=1);
 }
});
test('cost-control analytics emit fixed labels and no field values or query strings',async()=>{const {interactionPayload}=await import('../lib/analytics-event'),source=readFileSync(new URL('../components/data-chat.tsx',import.meta.url),'utf8'),analytics=readFileSync(new URL('../components/analytics.tsx',import.meta.url),'utf8');for(const id of ['cost_effective_date','cost_month_select','cost_single_item_confirm','cost_correction_confirm','cost_coverage_confirm']){assert.ok(source.includes(`data-analytics-id="${id}"`));assert.ok(analytics.includes(`'${id}'`));const payload=interactionPayload('change',id,'https://app.willthiseverscale.com','/chat');assert.deepEqual(payload.params,{element_label:id,page_location:'https://app.willthiseverscale.com/chat',page_referrer:''});assert.doesNotMatch(JSON.stringify(payload),/PRIVATE_CANARY|2026-11-03|987654/)}assert.match(analytics,/if\(!available\|\|!consent\)return/)});
test('shortcut controls use only fixed existing privacy-safe analytics IDs',()=>{const source=readFileSync(new URL('../components/cost-shortcut.tsx',import.meta.url),'utf8'),analytics=readFileSync(new URL('../components/analytics.tsx',import.meta.url),'utf8');const labels=[...source.matchAll(/data-analytics-id="([a-z_]+)"/g)].map(match=>match[1]);assert.ok(labels.length>=7);for(const label of labels)assert.ok(analytics.includes(`'${label}'`),label);assert.doesNotMatch(source,/data-analytics-id=\{/);assert.match(analytics,/location\.hostname!==['"]app\.willthiseverscale\.com['"]/);assert.match(analytics,/location\.protocol!==['"]https:['"]/)});

test('the new seller cost invitation asks about the amount left rather than claiming earnings',()=>{const source=readFileSync(new URL('../components/data-chat.tsx',import.meta.url),'utf8');assert.match(source,/What does one .* order leave after costs\?/);assert.doesNotMatch(source,/costs you more than you make on it/)});
test('preview controls use allowlisted fixed click labels without private content',async()=>{const {interactionPayload}=await import('../lib/analytics-event'),lead=readFileSync(new URL('../components/lead-card.tsx',import.meta.url),'utf8'),page=readFileSync(new URL('../components/scale-tool.tsx',import.meta.url),'utf8'),analytics=readFileSync(new URL('../components/analytics.tsx',import.meta.url),'utf8');for(const [source,pattern,id] of [[lead,/data-analytics-id="read_math" className="link-button" onClick=\{\(\)=>setMath/,'read_math'],[lead,/data-analytics-id="cost_choice" aria-pressed/,'cost_choice'],[page,/data-analytics-id="quiet_offer_message">View message/,'quiet_offer_message'],[page,/data-analytics-id="read_math">\{items.length/,'read_math'],[page,/data-analytics-id="leak_reminder">\{invoice.id/,'leak_reminder']] as const){assert.match(source,pattern);assert.ok(analytics.includes(`'${id}'`));const payload=interactionPayload('click',id,'https://app.willthiseverscale.com','/read');assert.deepEqual(payload.params,{element_label:id,page_location:'https://app.willthiseverscale.com/read',page_referrer:''});assert.doesNotMatch(JSON.stringify(payload),/PRIVATE_BUYER_CANARY|PRIVATE_MESSAGE_CANARY|INV-123|\?/)}assert.match(analytics,/target\.closest\('\[data-analytics-id\]'\)/);assert.match(analytics,/if\(!available\|\|!consent\)return/)});
