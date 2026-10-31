import {test} from 'node:test';
import assert from 'node:assert/strict';
import {POST} from '../app/api/account/delete/route';
import {GET as accountStatus} from '../app/api/account/route';
import {GET as workspaceStatus} from '../app/api/workspace/route';
import {sealAction} from '../lib/action-store';
import {emptyWorkspace} from '../lib/workspace-types';
import {beginAccountDeletion,getWorkspace,saveWorkspace,setWorkspaceStoreForTests,WorkspaceConflict,WorkspaceDeleting,type WorkspaceStore} from '../lib/workspace-store';

test('account deletion is origin and session bound, gated, and safe to retry after provider failure',async()=>{
 const names=['WTES_WORKOS_CLIENT_ID','WTES_WORKOS_API_KEY','WTES_SESSION_SECRET','WTES_APP_ORIGIN','WTES_WORKSPACE_SECRET','WTES_ACCOUNT_DELETION_ENABLED','WTES_WORKOS_DELETION_API_KEY','WTES_BILLING_ENABLED'] as const;
 const old=names.map(n=>process.env[n]),oldFetch=globalThis.fetch;let record:{body:string;etag:string}|null=null,version=0,calls:string[]=[];
 const store:WorkspaceStore={async read(){return record},async write(_path,body,etag){if((record?.etag??null)!==etag)throw new WorkspaceConflict();record={body,etag:String(++version)}}};
 Object.assign(process.env,{WTES_WORKOS_CLIENT_ID:'client_test',WTES_WORKOS_API_KEY:'signin-only',WTES_SESSION_SECRET:'s'.repeat(40),WTES_APP_ORIGIN:'https://example.com',WTES_WORKSPACE_SECRET:'w'.repeat(40),WTES_ACCOUNT_DELETION_ENABLED:'false',WTES_WORKOS_DELETION_API_KEY:'dedicated-delete-key',WTES_BILLING_ENABLED:'false'});
 setWorkspaceStoreForTests(store);
 const cookie='wtes_session='+encodeURIComponent(sealAction({userId:'user_A',emailVerified:true,expires:Date.now()+60000},process.env.WTES_SESSION_SECRET!));
 const req=(origin='https://example.com',c=cookie)=>new Request('https://example.com/api/account/delete',{method:'POST',headers:{origin,cookie:c}});
 try{
  const initial=emptyWorkspace();await saveWorkspace('user_A',{revision:0,settings:initial.settings,snapshots:[],reminders:[],tests:[]});
  globalThis.fetch=async(input,init)=>{calls.push(String(input));assert.equal(new Headers(init?.headers).get('Authorization'),'Bearer dedicated-delete-key');return new Response(null,{status:503})};
  assert.equal((await POST(req('https://evil.example'))).status,403);
  assert.equal((await POST(req('https://example.com',''))).status,401);
  assert.equal((await POST(req())).status,503);assert.equal((await getWorkspace('user_A')).revision,1);assert.equal(calls.length,0);
  process.env.WTES_ACCOUNT_DELETION_ENABLED='true';process.env.WTES_BILLING_ENABLED='true';assert.equal((await POST(req())).status,409);assert.equal(calls.length,0);
  process.env.WTES_BILLING_ENABLED='false';assert.equal((await POST(req())).status,503);assert.deepEqual(calls,['https://api.workos.com/user_management/users/user_A']);
  const accountResponse=await accountStatus(new Request('https://example.com/api/account',{headers:{cookie}}));assert.equal(accountResponse.status,200);assert.deepEqual(await accountResponse.json(),{configured:true,authenticated:true,deletionPending:true});
  const workspaceResponse=await workspaceStatus(new Request('https://example.com/api/workspace',{headers:{cookie}}));assert.equal(workspaceResponse.status,409);
  await assert.rejects(()=>getWorkspace('user_A'),WorkspaceDeleting);
  await assert.rejects(()=>saveWorkspace('user_A',{revision:2,settings:initial.settings,snapshots:[],reminders:[],tests:[]}),WorkspaceDeleting);
  await beginAccountDeletion('user_A');
  globalThis.fetch=async()=>new Response(null,{status:404});
  const retry=await POST(req());assert.equal(retry.status,200);assert.match(retry.headers.get('set-cookie')||'',/wtes_session=;/);assert.match(retry.headers.get('set-cookie')||'',/wtes_refresh=;/);
 }finally{globalThis.fetch=oldFetch;setWorkspaceStoreForTests(undefined);names.forEach((n,i)=>{if(old[i]===undefined)delete process.env[n];else process.env[n]=old[i]});}
});
