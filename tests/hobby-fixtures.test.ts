import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {analyze} from '../lib/engine';
import {parsePayPalCsv} from '../lib/csv';
import {generate} from '../scripts/generate-hobby-shop';

const dir=resolve(process.cwd(),'fixtures/hobby-shops');
const expectedFiles=readdirSync(dir).filter(name=>name.endsWith('.expected.json')).sort();

test('synthetic hobby fixtures are present, deterministic, and match current engine findings',async()=>{
 assert.equal(expectedFiles.length,6);
 for(const file of expectedFiles){
  const expected=JSON.parse(readFileSync(resolve(dir,file),'utf8')) as {preset:string;cards:Record<string,{shown:boolean;money:number|null}>};
  assert.ok(Object.keys(expected.cards).length>=16,`${file} has every card id`);
  const csv=readFileSync(resolve(dir,file.replace('.expected.json','.app.csv')),'utf8');
  const parsed=await parsePayPalCsv(csv,'fixture-salt');
  assert.ok(parsed.some(row=>row.kind==='sale'),`${expected.preset} app CSV parses`);
  const rows=generate(expected.preset as Parameters<typeof generate>[0],7);
  const analysis=analyze(rows,{homeCountry:analysisCountry(expected.preset),asOf:'2026-10-31T12:00:00Z'});
  const found=new Map(analysis.ranked_leaks.map(leak=>[leak.id,leak]));
  for(const [id,card] of Object.entries(expected.cards)){
   const leak=found.get(id);
   assert.equal(!!leak,card.shown,`${expected.preset}:${id}`);
   if(card.money!==null)assert.ok(Math.abs((leak?.money_per_month||0)-card.money)<=1,`${expected.preset}:${id}`);
  }
 }
});
function analysisCountry(preset:string){return preset==='vintage-clothes-reseller'?'US':'GB';}
