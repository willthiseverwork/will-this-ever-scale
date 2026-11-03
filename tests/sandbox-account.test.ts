import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sandboxAccountCanSave} from '../lib/sandbox-account';

test('sandbox completion checks the current session, including a late sign-in',async()=>{
 let authenticated=false;
 const fetcher:typeof fetch=async()=>Response.json({authenticated});
 assert.equal(await sandboxAccountCanSave(fetcher),false);
 assert.equal(await sandboxAccountCanSave(fetcher,async()=>{await Promise.resolve();authenticated=true}),true);
 assert.equal(await sandboxAccountCanSave(async()=>Response.json({authenticated:true,deletionPending:true})),false);
 await assert.rejects(()=>sandboxAccountCanSave(async()=>new Response(null,{status:503})));
});
