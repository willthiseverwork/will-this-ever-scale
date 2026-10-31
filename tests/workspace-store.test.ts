import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deleteWorkspace,getWorkspace,saveWorkspace,setWorkspaceStoreForTests,WorkspaceConflict,type WorkspaceStore} from '../lib/workspace-store';
import {emptyWorkspace} from '../lib/workspace-types';
const snapshot={id:'55e9dbb7-843f-47e3-91f6-a24d17785db0',capturedAt:'2026-10-31T00:00:00.000Z',currency:'USD',periodStart:'2026-01-01',periodEnd:'2026-10-31',source:'csv' as const,periodPrecision:'month' as const,coverageGaps:[],months:[],items:[],cameIn:100,fees:4,refunds:0,costs:10,adSpend:3,kept:83};
function input(w:ReturnType<typeof emptyWorkspace>){return {settings:w.settings,revision:w.revision,snapshots:w.snapshots,reminders:w.reminders,tests:w.tests};}
function memoryStore():WorkspaceStore {const records=new Map<string,{body:string;etag:string}>();let version=0;return {async read(path){return records.get(path)??null;},async write(path,body,etag){const current=records.get(path);if((current?.etag??null)!==etag)throw new WorkspaceConflict();records.set(path,{body,etag:String(++version)});}};}
test('separates users, detects stale writes and preserves trial after deletion',async()=>{const previous=process.env.WTES_WORKSPACE_SECRET;process.env.WTES_WORKSPACE_SECRET='x'.repeat(40);setWorkspaceStoreForTests(memoryStore());try{const initial=emptyWorkspace(),saved=await saveWorkspace('user_A',{...input(initial),snapshots:[snapshot]},Date.parse('2026-10-31T00:00:00Z'));assert.equal(saved.trialStartedAt,'2026-10-31T00:00:00.000Z');assert.equal(saved.trialEndsAt,'2026-11-30T00:00:00.000Z');assert.deepEqual(await getWorkspace('user_B'),initial);await assert.rejects(()=>saveWorkspace('user_A',{...input(initial),snapshots:[snapshot]}),WorkspaceConflict);const deleted=await deleteWorkspace('user_A');assert.equal(deleted.snapshots.length,0);assert.equal(deleted.settings.shareProductNamesWithAssistant,false);assert.equal(deleted.trialStartedAt,saved.trialStartedAt);const resaved=await saveWorkspace('user_A',{...input(deleted),snapshots:[snapshot]},Date.parse('2026-12-01T00:00:00Z'));assert.equal(resaved.trialEndsAt,saved.trialEndsAt);assert.deepEqual(await getWorkspace('user_B'),initial);}finally{setWorkspaceStoreForTests(undefined);if(previous===undefined)delete process.env.WTES_WORKSPACE_SECRET;else process.env.WTES_WORKSPACE_SECRET=previous;}});
test('empty saves do not start a trial',async()=>{const previous=process.env.WTES_WORKSPACE_SECRET;process.env.WTES_WORKSPACE_SECRET='x'.repeat(40);setWorkspaceStoreForTests(memoryStore());try{const saved=await saveWorkspace('user_C',input(emptyWorkspace()));assert.equal(saved.trialStartedAt,null);assert.equal(saved.trialEndsAt,null);}finally{setWorkspaceStoreForTests(undefined);if(previous===undefined)delete process.env.WTES_WORKSPACE_SECRET;else process.env.WTES_WORKSPACE_SECRET=previous;}});

test('simultaneous writes using one revision allow only one winner',async()=>{const previous=process.env.WTES_WORKSPACE_SECRET;process.env.WTES_WORKSPACE_SECRET='y'.repeat(40);setWorkspaceStoreForTests(memoryStore());try{const payload=input(emptyWorkspace());const outcomes=await Promise.allSettled([saveWorkspace('user_D',payload),saveWorkspace('user_D',payload)]);assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);assert.equal(outcomes.filter(x=>x.status==='rejected'&&x.reason instanceof WorkspaceConflict).length,1);}finally{setWorkspaceStoreForTests(undefined);if(previous===undefined)delete process.env.WTES_WORKSPACE_SECRET;else process.env.WTES_WORKSPACE_SECRET=previous;}});

test('workspace storage requires an explicit valid store selection and fails closed on unavailable OIDC',async()=>{
 const {storageConfigured,workspaceBlobCredentials}=await import('../lib/workspace-store');
 const names=['WTES_WORKSPACE_SECRET','WTES_WORKSPACE_STORE_ID','WTES_WORKSPACE_BLOB_TOKEN','BLOB_READ_WRITE_TOKEN'] as const;
 const old=names.map(name=>process.env[name]);
 try{
  process.env.WTES_WORKSPACE_SECRET='s'.repeat(40);process.env.BLOB_READ_WRITE_TOKEN='unrelated';
  delete process.env.WTES_WORKSPACE_STORE_ID;delete process.env.WTES_WORKSPACE_BLOB_TOKEN;
  assert.equal(storageConfigured(),false);
  process.env.WTES_WORKSPACE_BLOB_TOKEN='explicit-workspace-token';assert.equal(storageConfigured(),true);
  process.env.WTES_WORKSPACE_STORE_ID='bad';assert.equal(storageConfigured(),false);
  process.env.WTES_WORKSPACE_STORE_ID='store_abc123';assert.equal(storageConfigured(),true);
  assert.deepEqual(await workspaceBlobCredentials({storeId:'store_abc123'},async()=>' oidc-value '),{storeId:'store_abc123',oidcToken:'oidc-value'});
  await assert.rejects(()=>workspaceBlobCredentials({storeId:'store_abc123'},async()=>''));
  await assert.rejects(()=>workspaceBlobCredentials({storeId:'store_abc123'},async()=>{throw new Error('OIDC unavailable')}));
  assert.deepEqual(await workspaceBlobCredentials({token:'explicit-workspace-token'},async()=>{throw new Error('must not request OIDC')}),{token:'explicit-workspace-token'});
 }finally{names.forEach((name,i)=>{if(old[i]===undefined)delete process.env[name];else process.env[name]=old[i];});}
});
