import {mcpConfig,verifyMcpToken} from '../../lib/mcp-auth';
import {callMcpTool,mcpTools} from '../../lib/mcp-tools';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const allowedOrigins=new Set(['https://claude.ai','https://claude.com','https://chatgpt.com','https://app.willthiseverscale.com']);
const json=(value:unknown,status=200,headers:Record<string,string>={})=>Response.json(value,{status,headers:{'Cache-Control':'no-store',...headers}});
const err=(id:unknown,code:number,message:string)=>({jsonrpc:'2.0',id:id??null,error:{code,message}});
async function handlePost(request:Request){
 const origin=request.headers.get('origin');if(origin&&!allowedOrigins.has(origin))return json({error:'Origin not allowed.'},403);
 const version=request.headers.get('mcp-protocol-version');if(version && !['2025-11-25','2025-06-18','2025-03-26'].includes(version))return json({error:'Unsupported MCP protocol version.'},400);
 const accept=request.headers.get('accept');if(accept && !accept.includes('application/json') && !accept.includes('*/*'))return json({error:'JSON response not accepted.'},406);
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return json({error:'JSON required.'},415);
 if(Number(request.headers.get('content-length')||0)>16384)return json({error:'Request too large.'},413);
 let body:unknown;try {const text=await request.text();if(Buffer.byteLength(text)>16384)return json({error:'Request too large.'},413);body=JSON.parse(text);}catch{return json(err(null,-32700,'Parse error'),400);}
 if(!body||typeof body!=='object'||Array.isArray(body))return json(err(null,-32600,'Invalid request'),400);
 const m=body as Record<string,unknown>,id=m.id;
 if(m.jsonrpc!=='2.0'||typeof m.method!=='string'||(id!==undefined&&id!==null&&typeof id!=='string'&&typeof id!=='number'))return json(err(null,-32600,'Invalid request'),400);
 if(m.method==='notifications/initialized'&&id===undefined)return new Response(null,{status:202});
 if(id===undefined)return new Response(null,{status:202});
 const result=(v:unknown)=>json({jsonrpc:'2.0',id,result:v});
 if(m.method==='initialize'){const params=m.params as {protocolVersion?:unknown}|undefined;if(!params || typeof params.protocolVersion!=='string')return json(err(id,-32602,'Protocol version required.'),400);const negotiated=['2025-11-25','2025-06-18','2025-03-26'].includes(params.protocolVersion)?params.protocolVersion:'2025-11-25';return result({protocolVersion:negotiated,capabilities:{tools:{listChanged:false}},serverInfo:{name:'will-this-ever-scale',version:'0.1.0'}});}
 if(m.method==='ping')return result({});
 if(m.method==='tools/list')return result({tools:mcpTools(mcpConfig()?.scope)});
 if(m.method!=='tools/call')return json(err(id,-32601,'Method not found'));
 const p=m.params;if(!p||typeof p!=='object'||Array.isArray(p))return json(err(id,-32602,'Invalid parameters'));
 const {name,arguments:args={}}=p as {name?:unknown;arguments?:unknown};if(typeof name!=='string'||!mcpTools().some(t=>t.name===name))return json(err(id,-32602,'Unknown tool'));
 let subject:string|undefined;
 if(name!=='demo_summary'){
  const config=mcpConfig();if(!config)return json(err(id,-32000,'Account access is not configured.'),503);
  const match=/^Bearer\s+(\S+)$/i.exec(request.headers.get('authorization')||'');
  const challenge=`Bearer resource_metadata="${config.resource.replace(/\/mcp$/,'')}/.well-known/oauth-protected-resource/mcp", error="invalid_token", error_description="Authentication required"`;
  const unauthorized=()=>json({jsonrpc:'2.0',id,result:{isError:true,content:[{type:'text',text:'Authentication required.'}],_meta:{'mcp/www_authenticate':[challenge]}}},401,{'WWW-Authenticate':challenge});
  if(!match)return unauthorized();
  const verified=await verifyMcpToken(match[1]);if(!verified.ok)return verified.unavailable?json(err(id,-32001,'Authentication service unavailable.'),503):unauthorized();
  subject=verified.subject;
 }
 try {const data=await callMcpTool(name,args,subject);return result({content:[{type:'text',text:JSON.stringify(data)}],structuredContent:data});}
 catch {return result({isError:true,content:[{type:'text',text:'The requested data is unavailable or the arguments are invalid.'}]});}
}
export async function GET(){return new Response(null,{status:405,headers:{Allow:'POST'}});}
export async function DELETE(){return new Response(null,{status:405,headers:{Allow:'POST'}});}

export async function POST(request:Request){const response=await handlePost(request);const origin=request.headers.get('origin');if(origin&&allowedOrigins.has(origin)){response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Access-Control-Expose-Headers','WWW-Authenticate, MCP-Session-Id');response.headers.append('Vary','Origin');}return response;}
export async function OPTIONS(request:Request){const origin=request.headers.get('origin');if(!origin||!allowedOrigins.has(origin))return new Response(null,{status:403});return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, GET, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, Accept, MCP-Protocol-Version, MCP-Session-Id','Access-Control-Expose-Headers':'WWW-Authenticate, MCP-Session-Id','Vary':'Origin','Access-Control-Max-Age':'600'}});}
