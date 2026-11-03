import {verifyLoginCookie} from '../../../../../lib/paypal-login';
export const runtime='nodejs';
export async function GET(r:Request){
 const read=(name:string)=>r.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);
 const key=process.env.PAYPAL_ACTION_SIGNING_SECRET;
 const match=verifyLoginCookie(read('paypal_login'),'login',key),email=verifyLoginCookie(read('paypal_nomatch'),'nomatch',key);
 let name='',connected=false;try{const data=match&&JSON.parse(match);if(data?.demo===true){connected=true;if(typeof data.name==='string')name=data.name}}catch{}
 return Response.json({connected,name,email:email||''},{headers:{'Cache-Control':'no-store'}});
}
