import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorkspace,workspaceInput,isSharingOptOutOnly} from '../lib/workspace-types';
const id='55e9dbb7-843f-47e3-91f6-a24d17785db0';
const snapshot={id,capturedAt:'2026-10-31T00:00:00.000Z',currency:'USD',periodStart:'2026-01-01',periodEnd:'2026-10-31',source:'csv',months:[{month:'2026-01',cameIn:100,fees:4,refunds:0,costs:10,ads:3,kept:83,orders:1}],items:[{id:'item_1',gross:100,orders:1,refunds:0}],cameIn:100,fees:4,refunds:0,costs:10,adSpend:3,kept:83};
test('accepts bounded numeric own-data shape and rejects raw or identifying fields',()=>{const w={settings:{shareProductNamesWithAssistant:false},revision:0,snapshots:[snapshot],reminders:[],tests:[]};assert.equal(workspaceInput.safeParse(w).success,true);assert.equal(workspaceInput.safeParse({...w,snapshots:[{...snapshot,customer:'Alice'}]}).success,false);assert.equal(workspaceInput.safeParse({...w,snapshots:[{...snapshot,items:[{...snapshot.items[0],title:'Product'}]}]}).success,false);const parsed=workspaceInput.parse({...w,snapshots:[{...snapshot,items:[{...snapshot.items[0],label:'  Name\u0000  ',labelReviewed:true}]}]});assert.equal(parsed.snapshots[0].items[0].label,'Name');assert.equal(parsed.settings.shareProductNamesWithAssistant,false);});
test('validates dates, finite numbers, known findings and duplicate ids',()=>{const base={settings:{shareProductNamesWithAssistant:false},revision:0,snapshots:[],reminders:[],tests:[]};assert.equal(workspaceInput.safeParse({...base,reminders:[{id,findingId:'unknown',dueDate:'2026-11-01',kind:'review',status:'open'}]}).success,false);assert.equal(workspaceInput.safeParse({...base,snapshots:[{...snapshot,cameIn:Infinity}]}).success,false);assert.equal(workspaceInput.safeParse({...base,snapshots:[{...snapshot,periodStart:'2026-02-30'}]}).success,false);assert.equal(workspaceInput.safeParse({...base,snapshots:[snapshot,snapshot]}).success,false);assert.equal(emptyWorkspace().trialStartedAt,null);});

test('labels require explicit review and reject obvious contact information',()=>{const base={settings:{shareProductNamesWithAssistant:false},revision:0,snapshots:[],reminders:[],tests:[]};const withLabel=(label:string,labelReviewed?:true)=>({...base,snapshots:[{...snapshot,items:[{...snapshot.items[0],label,...(labelReviewed?{labelReviewed}:{})}]}]});assert.equal(workspaceInput.safeParse(withLabel('Hat')).success,false);assert.equal(workspaceInput.safeParse(withLabel('Hat',true)).success,true);assert.equal(workspaceInput.safeParse(withLabel('alice@example.com',true)).success,false);assert.equal(workspaceInput.safeParse(withLabel('www.example.com',true)).success,false);assert.equal(workspaceInput.safeParse(withLabel('+1 415 555 0100',true)).success,false);});


test('billing opt-out exception permits only withdrawal without workspace changes',()=>{
 const current=emptyWorkspace();current.settings={shareWorkspaceWithAssistant:true,shareProductNamesWithAssistant:true};
 const {trialStartedAt,trialEndsAt,...input}=current;
 assert.equal(isSharingOptOutOnly(current,{...input,settings:{...input.settings,shareWorkspaceWithAssistant:false}}),true);
 assert.equal(isSharingOptOutOnly(current,{...input,settings:{...input.settings,shareWorkspaceWithAssistant:false},reminders:[{id,findingId:'refunds_one_item',dueDate:'2026-11-01',kind:'review',status:'open'}]}),false);
 assert.equal(isSharingOptOutOnly(current,{...input,revision:1,settings:{...input.settings,shareWorkspaceWithAssistant:false}}),false);
 assert.equal(isSharingOptOutOnly(current,input),false);
 const disabled={...current,settings:{shareWorkspaceWithAssistant:false,shareProductNamesWithAssistant:true}};
 assert.equal(isSharingOptOutOnly(disabled,input),false);
});
