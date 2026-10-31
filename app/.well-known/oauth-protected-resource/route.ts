import {mcpConfig} from '../../../lib/mcp-auth';
export const dynamic='force-dynamic';
export async function GET(){const c=mcpConfig();if(!c)return Response.json({error:'OAuth resource is not configured.'},{status:503,headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});return Response.json({resource:c.resource,authorization_servers:[c.issuer],scopes_supported:[c.scope],bearer_methods_supported:['header']},{headers:{'Cache-Control':'no-store','Access-Control-Allow-Origin':'*'}});}
