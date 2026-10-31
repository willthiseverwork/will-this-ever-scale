import { createPublicKey, verify, type JsonWebKey } from 'node:crypto';

/** Configuration must describe an actual WorkOS OAuth resource, not the web-session cookie. */
export function mcpConfig() {
 const issuer=process.env.WTES_MCP_WORKOS_ISSUER, resource=process.env.WTES_MCP_RESOURCE_URL, scope=process.env.WTES_MCP_READ_SCOPE;
 if(!issuer||!resource||!scope||!/^[-a-zA-Z0-9:._/]+$/.test(scope))return null;
 try { const i=new URL(issuer), r=new URL(resource); if(i.protocol!=='https:'||i.origin!==issuer||r.protocol!=='https:'||r.origin!=='https://app.willthiseverscale.com'||r.pathname!=='/mcp'||r.search||r.hash)return null; return {issuer,resource,scope}; } catch {return null;}
}
export type TokenResult={ok:true;subject:string}|{ok:false;unavailable:boolean};
export async function verifyMcpToken(token:string, fetcher:typeof fetch=fetch, now=Date.now()):Promise<TokenResult>{
 const config=mcpConfig(); if(!config)return {ok:false,unavailable:true};
 try {
  if(token.length>8192)throw new Error(); const parts=token.split('.');if(parts.length!==3)throw new Error();
  const decode=(s:string)=>JSON.parse(Buffer.from(s,'base64url').toString('utf8'));
  const header=decode(parts[0]),p=decode(parts[1]);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>256||p.iss!==config.issuer||!(p.aud===config.resource||Array.isArray(p.aud)&&p.aud.includes(config.resource))||typeof p.exp!=='number'||p.exp<=now/1000||p.nbf!==undefined&&(typeof p.nbf!=='number'||p.nbf>now/1000)||typeof p.sub!=='string'||!/^user_[A-Za-z0-9]+$/.test(p.sub)||typeof p.scope!=='string'||!p.scope.split(/\s+/).includes(config.scope))throw new Error();
  let response:Response;try {response=await fetcher(config.issuer+'/oauth2/jwks',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(5000)});} catch {return {ok:false,unavailable:true};}
  if(!response.ok)return {ok:false,unavailable:true};let data:{keys?:(JsonWebKey & {kid?:string;alg?:string;use?:string})[]};try {data=await response.json();} catch{return {ok:false,unavailable:true};}
  if(!Array.isArray(data.keys))return {ok:false,unavailable:true};
  const keys=data.keys.filter(k=>k.kid===header.kid&&k.kty==='RSA'&&(!k.alg||k.alg==='RS256')&&(!k.use||k.use==='sig'));if(keys.length!==1)throw new Error();
  const key=createPublicKey({key:keys[0],format:'jwk'});if(!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2],'base64url')))throw new Error();
  return {ok:true,subject:p.sub};
 } catch {return {ok:false,unavailable:false};}
}
