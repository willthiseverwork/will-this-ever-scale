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
test('two source fixtures change displayed numbers and repeat formula rounds within one dollar',()=>{
 const rows=demoTransactions(),a=analyze(rows,{asOf:DEMO_AS_OF,homeCountry:'US'});
 const b=analyze(rows.map(row=>({...row,gross:row.gross*2,fee:row.fee*2,net:row.net*2})),{asOf:DEMO_AS_OF});
 assert.notEqual(displayedMoneyMap(a)?.cameIn,displayedMoneyMap(b)?.cameIn);
 for(const analysis of [a,b]){
  const leak=analysis.ranked_leaks.find(x=>x.id==='one_time_buyers')!;
  const e=leak.evidence;
  const shownOrders=Number((Number(e.additional_orders)/3).toFixed(1));
  const shownAverage=Number(Number(e.average_order).toFixed(2));
  const finalLine=calculationLines(leak,analysis).at(-1)!;
  const shownResult=Number(finalLine.match(/≈ \$([\d.]+) a month/)?.[1]);
  assert.ok(Math.abs(shownOrders*shownAverage*Math.round(Number(e.kept_share))/100-shownResult)<=1);
  assert.match(finalLine,/≈ .* a month/);
 }
});
