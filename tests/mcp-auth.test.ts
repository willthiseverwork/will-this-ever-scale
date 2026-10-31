import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {generateKeyPairSync,sign} from 'node:crypto';
import {verifyMcpToken} from '../lib/mcp-auth';
const issuer='https://example.workos.com',resource='https://app.willthiseverscale.com/mcp';
const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk={...publicKey.export({format:'jwk'}),kid:'key1',alg:'RS256',use:'sig'};
const fetcher:typeof fetch=async()=>new Response(JSON.stringify({keys:[jwk]}),{status:200});
function token(changes:Record<string,unknown>={}){const b=(x:unknown)=>Buffer.from(JSON.stringify(x)).toString('base64url');const h=b({alg:'RS256',kid:'key1'}),p=b({iss:issuer,aud:resource,sub:'user_ABC123',exp:2000000000,scope:'wtes:read',...changes});return `${h}.${p}.${sign('RSA-SHA256',Buffer.from(`${h}.${p}`),privateKey).toString('base64url')}`;}
test('signed token requires issuer, audience, scope, expiry and subject',async()=>{
 process.env.WTES_MCP_WORKOS_ISSUER=issuer;process.env.WTES_MCP_RESOURCE_URL=resource;process.env.WTES_MCP_READ_SCOPE='wtes:read';
 assert.deepEqual(await verifyMcpToken(token(),fetcher,1900000000*1000),{ok:true,subject:'user_ABC123'});
 for(const changes of [{aud:'other'},{iss:'https://other.example'},{scope:'other'},{exp:1800000000},{sub:'user_bad!'}])assert.equal((await verifyMcpToken(token(changes),fetcher,1900000000*1000)).ok,false);
 assert.deepEqual(await verifyMcpToken(token(),async()=>{throw new Error('offline');},1900000000*1000),{ok:false,unavailable:true});
});
