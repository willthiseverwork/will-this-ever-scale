import {NextResponse} from 'next/server';
import {hasPaidOrJudgeAccess} from '../../../../../lib/access';
import {demoIdentityMatch,signLoginCookie,verifyLoginCookie,userinfoFieldNames} from '../../../../../lib/paypal-login';
export const runtime='nodejs';
const callback='https://app.willthiseverscale.com/api/paypal/login/callback';
function cookie(r:Request,name:string){return r.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1)}
function finish(r:Request,query:string){const res=NextResponse.redirect(new URL('/?paypal='+query,r.url));res.cookies.set('paypal_login_state','',{httpOnly:true,secure:true,sameSite:'lax',path:'/api/paypal/login',maxAge:0});return res}
export async function GET(r:Request){
 const query=new URL(r.url).searchParams,secret=process.env.PAYPAL_ACTION_SIGNING_SECRET,id=process.env.PAYPAL_LOGIN_CLIENT_ID,clientSecret=process.env.PAYPAL_LOGIN_CLIENT_SECRET;
 const state=verifyLoginCookie(cookie(r,'paypal_login_state'),'state',secret);
 const fail=(reason:string)=>{console.error('paypal_login_callback_failed',reason);return finish(r,'error')};
 if(query.has('error'))return fail('provider_denied');
 if(!state||!query.get('state')||state!==query.get('state'))return fail('invalid_state');
 if(!query.get('code'))return fail('missing_code');
 if(!id||!clientSecret||!secret)return fail('missing_configuration');
 try{if(!await hasPaidOrJudgeAccess(r))return fail('access_unavailable')}catch{return fail('access_check_failed')}
 let stage='token_exchange';
 try{
  const exchange=await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(id+':'+clientSecret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',code:query.get('code')!,redirect_uri:callback}),cache:'no-store'});
  if(!exchange.ok)throw new Error('exchange');const tokens=await exchange.json();if(typeof tokens.access_token!=='string'||!tokens.access_token)throw new Error('token');
  let identityToken=tokens,refreshUsed=false;
  const getUserinfo=(accessToken:string)=>fetch('https://api-m.sandbox.paypal.com/v1/identity/oauth2/userinfo?schema=paypalv1.1',{method:'GET',headers:{Authorization:'Bearer '+accessToken,Accept:'application/json'},cache:'no-store'});
  const logUnauthorized=async(response:Response)=>{let providerCode='other';try{const body=await response.json();const raw=typeof body?.error==='string'?body.error:typeof body?.name==='string'?body.name:'';const known:Record<string,string>={invalid_token:'invalid_token',AUTHENTICATION_FAILURE:'authentication_failure',insufficient_authentication:'insufficient_authentication',insufficient_scope:'insufficient_scope'};providerCode=Object.hasOwn(known,raw)?known[raw]:'other';}catch{}const kind=typeof identityToken.token_type==='string'&&/^bearer$/i.test(identityToken.token_type)?'bearer':identityToken.token_type?'other':'unknown';const scopes=typeof identityToken.scope==='string'?identityToken.scope.split(/\s+/):[];console.info('paypal_login_token_diagnostics',{refresh:refreshUsed?'used':typeof tokens.refresh_token==='string'&&tokens.refresh_token?'available':'absent',type:kind,openid:scopes.length?(scopes.includes('openid')?'present':'missing'):'unknown',error:providerCode});};
  stage='userinfo_transport';let response=await getUserinfo(tokens.access_token);
  if(response.status===401){
   await logUnauthorized(response);
   if(typeof tokens.refresh_token==='string'&&tokens.refresh_token){
    stage='token_refresh';const refreshed=await fetch('https://api-m.sandbox.paypal.com/v1/oauth2/token',{method:'POST',headers:{Authorization:'Basic '+Buffer.from(id+':'+clientSecret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',refresh_token:tokens.refresh_token}),cache:'no-store'});if(!refreshed.ok)throw new Error('refresh');const next=await refreshed.json();if(typeof next.access_token!=='string'||!next.access_token)throw new Error('refresh');identityToken=next;refreshUsed=true;
    stage='userinfo_transport';response=await getUserinfo(next.access_token);if(response.status===401)await logUnauthorized(response);
   }
  }
  if(!response.ok){stage=`userinfo_http_${response.status>=100&&response.status<=599?response.status:'unknown'}`;throw new Error('userinfo');}
  stage='userinfo_parse';const info=await response.json();stage='userinfo_shape';if(!info||typeof info!=='object'||Array.isArray(info))throw new Error('userinfo');
  stage='identity_handling';const fields=userinfoFieldNames(info);if(fields)console.info('paypal_login_userinfo_fields',fields);
  if(!demoIdentityMatch(info,process.env.PAYPAL_SANDBOX_DEMO_MERCHANT_ID,process.env.PAYPAL_SANDBOX_DEMO_MERCHANT_EMAIL)){console.error('paypal_login_callback_failed','identity_mismatch');const result=finish(r,'no_match');const email=typeof info.email==='string'?info.email.slice(0,254):'';result.cookies.set('paypal_nomatch',signLoginCookie('nomatch',email,Date.now()+5*60_000,secret),{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:300});return result;}
  stage='login_cookie';const result=finish(r,'connected');result.cookies.set('paypal_nomatch','',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});result.cookies.set('paypal_login',signLoginCookie('login',JSON.stringify({demo:true,name:typeof info.name==='string'?info.name.slice(0,120):''}),Date.now()+30*60_000,secret),{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:1800});return result;
 }catch{return fail(stage)}
}
