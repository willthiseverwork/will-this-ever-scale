import {clearCookie,config,finishLogin} from '../../../../lib/workspace-auth';
export const runtime='nodejs';
const safeReasons=new Map([
 ['Invalid login response.','invalid_flow'],
 ['Login could not be completed.','provider_exchange'],
 ['Verified email required.','email_not_verified'],
 ['Invalid provider session.','provider_session'],
 ['Provider keys unavailable.','provider_keys'],
 ['Account setup is incomplete.','configuration'],
]);
export async function GET(request:Request){
 const headers=new Headers({'Cache-Control':'no-store','Referrer-Policy':'no-referrer'});
 try {
  const c=config();if(!c)throw new Error('Account setup is incomplete.');
  const login=await finishLogin(request);
  headers.set('Location',c.origin+login.next);
  for(const cookie of login.cookies)headers.append('Set-Cookie',cookie);
 } catch(error) {
  // Only fixed categories are logged; no callback URLs, codes, tokens or identities.
  console.warn('wtes_login_failed',safeReasons.get(error instanceof Error?error.message:'')??'unexpected');
  headers.set('Location','/account/sign-in-error');
 }
 headers.append('Set-Cookie',clearCookie('flow'));
 return new Response(null,{status:303,headers});
}
