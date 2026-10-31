import {test} from 'node:test';
import assert from 'node:assert/strict';
import {analyze} from '../lib/engine';
import {demoTransactions,DEMO_AS_OF} from '../lib/demo';
import {snapshotForSave,type BrowserRead} from '../lib/browser-analysis';
import {workspaceInput,emptyWorkspace} from '../lib/workspace-types';
const analysis=analyze(demoTransactions(),{asOf:DEMO_AS_OF});
const read:BrowserRead={analysis,source:'csv',inputs:{},answers:{}};
test('saving defaults to anonymous items; reviewed labels need confirmation and validation',()=>{
 const unnamed=snapshotForSave(read);assert.ok(unnamed.items.every(item=>!('label' in item)));assert.ok(!('rows' in unnamed));
 const {trialStartedAt,trialEndsAt,...workspace}=emptyWorkspace();void trialStartedAt;void trialEndsAt;
 assert.ok(workspaceInput.safeParse({...workspace,snapshots:[unnamed]}).success);
 const named=snapshotForSave(read,{confirmed:true,labels:{item_1:'Silver hoops',item_2:''}});
 assert.equal(named.items[0].label,'Silver hoops');assert.equal(named.items[0].labelReviewed,true);assert.equal(named.items[1].label,undefined);
 assert.ok(workspaceInput.safeParse({...workspace,snapshots:[named]}).success);
 for(const bad of ['amy@example.com','https://example.com','+1 (212) 555-0123','x'.repeat(121)])assert.throws(()=>snapshotForSave(read,{confirmed:true,labels:{item_1:bad}}));
 assert.throws(()=>snapshotForSave(read,{confirmed:false,labels:{item_1:'Ring'}} as never));
 assert.throws(()=>snapshotForSave(read,{confirmed:true,labels:{item_999:'Ring'}}));
});
test('whole-period snapshot reconciles with monthly data even if display money map differs',()=>{
 const changed={...analysis,money_map:{...analysis.money_map,came_in:999999,kept:999999}};
 const snapshot=snapshotForSave({...read,analysis:changed});const total=analysis.months.reduce((n,m)=>n+m.cameIn,0);
 assert.equal(snapshot.cameIn,total);assert.equal(snapshot.cameIn,analysis.period_summaries!.whole.money_map.came_in);
 assert.ok(snapshot.coverageGaps.includes('item_costs_missing'));assert.ok(snapshot.coverageGaps.includes('ad_spend_missing'));
 assert.equal(snapshot.periodPrecision,'month');assert.ok(snapshot.coverageGaps.includes('date_coverage_unknown'));assert.equal(snapshot.periodEnd,'2026-10-31');
});
test('sample and sandbox sources cannot become saved CSV snapshots',()=>{
 for(const source of ['demo','sandbox'] as const)assert.throws(()=>snapshotForSave({analysis,source,inputs:{},answers:{}}));
});
