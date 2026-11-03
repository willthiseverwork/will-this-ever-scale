import {NextResponse} from 'next/server';
import {hasPaidOrJudgeAccess} from '../../../../lib/access';
import {newLoginState,signLoginCookie} from '../../../../lib/paypal-login';
export const runtime='nodejs';
const callback='https://app.willthiseverscale.com/api/paypal/login/callback';
export async function GET(r:Request){
 if(!await hasPaidOrJudgeAccess(r))return NextResponse.redirect(new URL('/access',r.url));
 const id=process.env.PAYPAL_LOGIN_CLIENT_ID,secret=process.env.PAYPAL_LOGIN_CLIENT_SECRET,signing=process.env.PAYPAL_ACTION_SIGNING_SECRET;
 if(!id||!/^[A-Za-z0-9_-]+$/.test(id)||!secret||!signing||Buffer.byteLength(signing)<32)return NextResponse.redirect(new URL('/?paypal=keys',r.url));
 const state=newLoginState();const url=new URL('https://www.sandbox.paypal.com/signin/authorize');
 url.search=new URLSearchParams({client_id:id,response_type:'code',scope:'openid email profile https://uri.paypal.com/services/paypalattributes',redirect_uri:callback,state}).toString();
 const response=NextResponse.redirect(url);response.cookies.set('paypal_login','',{httpOnly:true,secure:true,sameSite:'lax',path:'/',maxAge:0});response.cookies.set('paypal_login_state',signLoginCookie('state',state,Date.now()+10*60_000,signing),{httpOnly:true,secure:true,sameSite:'lax',path:'/api/paypal/login',maxAge:600});return response;
}
