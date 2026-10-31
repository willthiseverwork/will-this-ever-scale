import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {POST} from '../app/mcp/route';
const post=(method:string,params:unknown={},headers:Record<string,string>={})=>POST(new Request('https://app.willthiseverscale.com/mcp',{method:'POST',headers:{'content-type':'application/json',...headers},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));
test('anonymous demo is labelled synthetic and protected workspace cannot use cookies',async()=>{
 const demo=await (await post('tools/call',{name:'demo_summary',arguments:{}})).json();assert.match(JSON.stringify(demo),/synthetic demo/);
 delete process.env.WTES_MCP_WORKOS_ISSUER;const protectedResponse=await post('tools/call',{name:'current_summary',arguments:{}},{cookie:'wtes_session=fake'});assert.equal(protectedResponse.status,503);
});
test('disallows batches and hostile browser origins',async()=>{
 const batch=await POST(new Request('https://app.willthiseverscale.com/mcp',{method:'POST',headers:{'content-type':'application/json'},body:'[]'}));assert.equal(batch.status,400);
 assert.equal((await post('tools/list',{}, {origin:'https://attacker.example'})).status,403);
});

test('unsupported protocol is rejected and allowed browser preflight is explicit',async()=>{
 const {OPTIONS}=await import('../app/mcp/route');
 assert.equal((await post('tools/list',{}, {'mcp-protocol-version':'invalid'})).status,400);
 const r=await OPTIONS(new Request('https://app.willthiseverscale.com/mcp',{method:'OPTIONS',headers:{origin:'https://claude.ai'}}));assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),'https://claude.ai');
});
