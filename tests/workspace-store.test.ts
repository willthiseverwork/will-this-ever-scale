import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deleteWorkspace,getWorkspace,getUploadRecord,listUploadRecords,putUploadRecord,saveWorkspace,setWorkspaceStoreForTests,WorkspaceConflict,WORKSPACE_DOCUMENT_MAX_BYTES,type WorkspaceStore} from '../lib/workspace-store';
import {emptyWorkspace,workspaceInput} from '../lib/workspace-types';
import {sealAction} from '../lib/action-store';
import {callMcpTool} from '../lib/mcp-tools';
const snapshot={id:'55e9dbb7-843f-47e3-91f6-a24d17785db0',capturedAt:'2026-10-31T00:00:00.000Z',currency:'USD',periodStart:'2026-01-01',periodEnd:'2026-10-31',source:'csv' as const,periodPrecision:'month' as const,coverageGaps:[],months:[],items:[],cameIn:100,fees:4,refunds:0,costs:10,adSpend:3,kept:83};
function input(w:ReturnType<typeof emptyWorkspace>){return {settings:w.settings,revision:w.revision,snapshots:w.snapshots,reminders:w.reminders,tests:w.tests};}
function memoryStore():WorkspaceStore {const records=new Map<string,{body:string;etag:string}>();let version=0;return {async read(path,maxBytes=WORKSPACE_DOCUMENT_MAX_BYTES){const record=records.get(path);if(!record)return null;if(Buffer.byteLength(record.body)>maxBytes)throw new Error('Workspace unavailable.');return record;},async write(path,body,etag){const current=records.get(path);if((current?.etag??null)!==etag)throw new WorkspaceConflict();records.set(path,{body,etag:String(++version)});}};}
test('separates users, detects stale writes and preserves trial after deletion',async()=>{const previous=process.env.WTES_WORKSPACE_SECRET;process.env.WTES_WORKSPACE_SECRET='x'.repeat(40);setWorkspaceStoreForTests(memoryStore());try{const initial=emptyWorkspace(),saved=await saveWorkspace('user_A',{...input(initial),snapshots:[snapshot]},Date.parse('2026-10-31T00:00:00Z'));assert.equal(saved.trialStartedAt,'2026-10-31T00:00:00.000Z');assert.equal(saved.trialEndsAt,'2026-11-30T00:00:00.000Z');assert.deepEqual(await getWorkspace('user_B'),initial);await assert.rejects(()=>saveWorkspace('user_A',{...input(initial),snapshots:[snapshot]}),WorkspaceConflict);const deleted=await deleteWorkspace('user_A');assert.equal(deleted.snapshots.length,0);assert.equal(deleted.settings.shareProductNamesWithAssistant,false);assert.equal(deleted.trialStartedAt,saved.trialStartedAt);const resaved=await saveWorkspace('user_A',{...input(deleted),snapshots:[snapshot]},Date.parse('2026-12-01T00:00:00Z'));assert.equal(resaved.trialEndsAt,saved.trialEndsAt);assert.deepEqual(await getWorkspace('user_B'),initial);}finally{setWorkspaceStoreForTests(undefined);if(previous===undefined)delete process.env.WTES_WORKSPACE_SECRET;else process.env.WTES_WORKSPACE_SECRET=previous;}});
test('empty saves do not start a trial',async()=>{const previous=process.env.WTES_WORKSPACE_SECRET;process.env.WTES_WORKSPACE_SECRET='x'.repeat(40);setWorkspaceStoreForTests(memoryStore());try{const saved=await saveWorkspace('user_C',input(emptyWorkspace()));assert.equal(saved.trialStartedAt,null);assert.equal(saved.trialEndsAt,null);}finally{setWorkspaceStoreForTests(undefined);if(previous===undefined)delete process.env.WTES_WORKSPACE_SECRET;else process.env.WTES_WORKSPACE_SECRET=previous;}});

test('sealed upload records larger than the workspace cap round-trip through put, list and get',async()=>{const previous=process.env.WTES_WORKSPACE_SECRET,id='f15ccd8b-5b8b-40d8-a05e-3ff1c93cfdcc';process.env.WTES_WORKSPACE_SECRET='u'.repeat(40);setWorkspaceStoreForTests(memoryStore());try{const row={date:'2026-11-02',kind:'sale' as const,gross:12,fee:1,net:11,currency:'GBP',item_title:'A'.repeat(120),id:'b_'+'a'.repeat(64),buyer_key:'b_'+'b'.repeat(64)};const upload={id,uploadedAt:'2026-11-02T10:00:00.000Z',rows:Array.from({length:900},()=>row)};assert.ok(Buffer.byteLength(sealAction(upload,process.env.WTES_WORKSPACE_SECRET!))>WORKSPACE_DOCUMENT_MAX_BYTES);await putUploadRecord('user_large_upload',id,upload);assert.equal((await listUploadRecords('user_large_upload')).length,1);assert.deepEqual(await getUploadRecord('user_large_upload',id),upload);}finally{setWorkspaceStoreForTests(undefined);if(previous===undefined)delete process.env.WTES_WORKSPACE_SECRET;else process.env.WTES_WORKSPACE_SECRET=previous;}});

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


test('assistant access defaults off, requires explicit enablement and revokes on the next request',async()=>{
 const previous=process.env.WTES_WORKSPACE_SECRET;process.env.WTES_WORKSPACE_SECRET='x'.repeat(40);setWorkspaceStoreForTests(memoryStore());
 try{
  const legacy=workspaceInput.parse({...input(emptyWorkspace()),settings:{shareProductNamesWithAssistant:true},snapshots:[{...snapshot,items:[{id:'item_1',label:'Hat',labelReviewed:true,gross:100,orders:1,refunds:0}]}]});
  assert.equal(legacy.settings.shareWorkspaceWithAssistant,false);
  let saved=await saveWorkspace('user_consent',legacy);
  for(const name of ['current_summary','rank_products','compare_periods','issue_playbook'])await assert.rejects(()=>callMcpTool(name,{},'user_consent'),/sharing is disabled/);
  assert.equal((await callMcpTool('demo_summary',{}) as {source:string}).source,'synthetic demo');
  saved=await saveWorkspace('user_consent',{...input(saved),settings:{...saved.settings,shareWorkspaceWithAssistant:true}});
  assert.equal((await callMcpTool('current_summary',{},'user_consent') as {source:string}).source,'csv');
  await assert.rejects(()=>callMcpTool('list_reminders',{},'user_consent'),/Unknown tool/);
  assert.equal((await callMcpTool('rank_products',{metric:'gross'},'user_consent') as {items:{label?:string}[]}).items[0].label,'Hat');
  saved=await saveWorkspace('user_consent',{...input(saved),settings:{...saved.settings,shareProductNamesWithAssistant:false}});
  assert.equal((await callMcpTool('rank_products',{metric:'gross'},'user_consent') as {items:{label?:string}[]}).items[0].label,undefined);
  saved=await saveWorkspace('user_consent',{...input(saved),settings:{...saved.settings,shareProductNamesWithAssistant:true}});
  saved=await saveWorkspace('user_consent',{...input(saved),settings:{...saved.settings,shareWorkspaceWithAssistant:false}});
  assert.equal(saved.settings.shareProductNamesWithAssistant,true);
  await assert.rejects(()=>callMcpTool('current_summary',{},'user_consent'),/sharing is disabled/);
  assert.equal((await getWorkspace('user_consent')).snapshots.length,1);
 }finally{setWorkspaceStoreForTests(undefined);if(previous===undefined)delete process.env.WTES_WORKSPACE_SECRET;else process.env.WTES_WORKSPACE_SECRET=previous;}
});

test('deletion marker wins or conflicts with a simultaneous save and blocks later writes',async()=>{
 const {beginAccountDeletion,WorkspaceDeleting}=await import('../lib/workspace-store');
 const previous=process.env.WTES_WORKSPACE_SECRET;process.env.WTES_WORKSPACE_SECRET='z'.repeat(40);setWorkspaceStoreForTests(memoryStore());
 try{
  const initial=emptyWorkspace();const result=await Promise.allSettled([beginAccountDeletion('user_RACE'),saveWorkspace('user_RACE',input(initial))]);
  assert.equal(result.filter(x=>x.status==='fulfilled').length,1);
  assert.equal(result.filter(x=>x.status==='rejected'&&x.reason instanceof WorkspaceConflict).length,1);
  await beginAccountDeletion('user_RACE');
  await assert.rejects(()=>getWorkspace('user_RACE'),WorkspaceDeleting);
  await assert.rejects(()=>saveWorkspace('user_RACE',input(initial)),WorkspaceDeleting);
 }finally{setWorkspaceStoreForTests(undefined);if(previous===undefined)delete process.env.WTES_WORKSPACE_SECRET;else process.env.WTES_WORKSPACE_SECRET=previous;}
});


test('legacy encrypted workspace read and assistant summary retain unknown date coverage without writing',async()=>{const previous=process.env.WTES_WORKSPACE_SECRET;const secret='x'.repeat(40);process.env.WTES_WORKSPACE_SECRET=secret;const {coverageGaps,...legacySnapshot}=snapshot;void coverageGaps;const workspace={...emptyWorkspace(),settings:{shareWorkspaceWithAssistant:true,shareProductNamesWithAssistant:false},snapshots:[legacySnapshot]};const stored=sealAction(workspace,secret);let writes=0;setWorkspaceStoreForTests({async read(){return {body:stored,etag:'legacy'}},async write(){writes++}});try{const loaded=await getWorkspace('user_legacy');assert.deepEqual(loaded.snapshots[0].coverageGaps,['date_coverage_unknown']);const summary=await callMcpTool('current_summary',{},'user_legacy') as {coverageGaps:string[];caveats:string[]};assert.deepEqual(summary.coverageGaps,['date_coverage_unknown']);assert.ok(summary.caveats.some(c=>c.includes('Exact export coverage')));assert.equal(writes,0);}finally{setWorkspaceStoreForTests(undefined);if(previous===undefined)delete process.env.WTES_WORKSPACE_SECRET;else process.env.WTES_WORKSPACE_SECRET=previous;}});
