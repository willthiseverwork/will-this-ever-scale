import {clearCookie,sameOrigin,session} from '../../../../lib/workspace-auth';
import {beginAccountDeletion,WorkspaceConflict} from '../../../../lib/workspace-store';
export const runtime='nodejs';
const headers={'Cache-Control':'no-store'};
export async function POST(request:Request){
 if(!sameOrigin(request))return Response.json({error:'Invalid origin.'},{status:403,headers});
 const user=session(request);if(!user)return Response.json({error:'Sign in required.'},{status:401,headers});
 // A checkout can race a status check. Until billing has a coordinated deletion lock, fail closed.
 if(process.env.WTES_BILLING_ENABLED==='true')return Response.json({error:'Account deletion is unavailable while billing is enabled. Account deletion needs the service owner to finish.'},{status:409,headers});
 const deletionKey=process.env.WTES_WORKOS_DELETION_API_KEY;if(process.env.WTES_ACCOUNT_DELETION_ENABLED!=='true'||!deletionKey)return Response.json({error:'Account deletion is not available yet. Account deletion needs the service owner to finish.'},{status:503,headers});
 try{await beginAccountDeletion(user.userId);}catch(e){return Response.json({error:e instanceof WorkspaceConflict?'Your workspace changed. Please try again.':'Deletion could not start. Your account has not been deleted.'},{status:e instanceof WorkspaceConflict?409:503,headers});}
 let response:Response;
 try{response=await fetch('https://api.workos.com/user_management/users/'+encodeURIComponent(user.userId),{method:'DELETE',headers:{Authorization:`Bearer ${deletionKey}`},cache:'no-store',redirect:'error',signal:AbortSignal.timeout(10000)});}catch{return Response.json({error:'Workspace content was removed, but account deletion could not be confirmed. Try again while signed in. If your session expires, the service owner needs to finish account deletion.'},{status:503,headers});}
 if(!response.ok&&response.status!==404)return Response.json({error:'Workspace content was removed, but account deletion could not be confirmed. Try again while signed in. If your session expires, the service owner needs to finish account deletion.'},{status:503,headers});
 const resultHeaders=new Headers(headers);for(const cookie of ['session','refresh','flow'] as const)resultHeaders.append('Set-Cookie',clearCookie(cookie));
 return Response.json({ok:true},{headers:resultHeaders});
}
