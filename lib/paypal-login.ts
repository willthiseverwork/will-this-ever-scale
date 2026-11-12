import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** Stateless, purpose-bound, short-lived cookie values; never include userinfo. */
export function signLoginCookie(purpose:'state'|'login'|'nomatch',value:string,expires:number,secret:string){
 if(Buffer.byteLength(secret)<32)throw new Error('Login signing unavailable');
 const payload=Buffer.from(JSON.stringify({purpose,value,expires})).toString('base64url');
 return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');
}
export function verifyLoginCookie(raw:string|undefined,purpose:'state'|'login'|'nomatch',secret:string|undefined,now=Date.now()){
 if(!raw||!secret||Buffer.byteLength(secret)<32)return undefined;
 try{const [payload,sig,...extra]=raw.split('.');if(!payload||!sig||extra.length)return undefined;const expected=createHmac('sha256',secret).update(payload).digest(),given=Buffer.from(sig,'base64url');if(expected.length!==given.length||!timingSafeEqual(expected,given))return undefined;const data=JSON.parse(Buffer.from(payload,'base64url').toString());if(data.purpose!==purpose||typeof data.value!=='string'||!Number.isSafeInteger(data.expires)||data.expires<=now)return undefined;return data.value as string;}catch{return undefined;}
}
export const newLoginState=()=>randomBytes(32).toString('base64url');
export function demoIdentityMatch(info:Record<string,unknown>,merchantId:string|undefined,merchantEmail:string|undefined){
 if(merchantId&&typeof info.payer_id==='string'&&info.payer_id===merchantId)return true;
 if(!merchantEmail)return false;
 const matches=(value:unknown)=>typeof value==='string'&&value.toLowerCase()===merchantEmail.toLowerCase();
 if(info.email_verified===true&&matches(info.email))return true;
 return Array.isArray(info.emails)&&info.emails.some((entry:unknown)=>!!entry&&typeof entry==='object'&&!Array.isArray(entry)&&(entry as Record<string,unknown>).confirmed===true&&matches((entry as Record<string,unknown>).value));
}
export function paypalLoginCookie(request:Request){
 const raw=request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith('paypal_login='))?.slice('paypal_login='.length);
 const value=verifyLoginCookie(raw,'login',process.env.PAYPAL_ACTION_SIGNING_SECRET);
 try{return value&&JSON.parse(value).demo===true?raw:undefined}catch{return undefined}
}

/** Field names only, for the first week after the 3 November rollout. */
export function userinfoFieldNames(info:Record<string,unknown>,now=Date.now()){return now<Date.parse("2026-11-10T00:00:00Z")?Object.keys(info).sort():undefined;}
