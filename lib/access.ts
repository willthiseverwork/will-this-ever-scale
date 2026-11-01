import {createHmac,timingSafeEqual} from 'node:crypto';
import {billingStatus} from './billing';
import {session} from './workspace-auth';

const JUDGE_COOKIE='wtes_judge';
const JUDGE_END=Date.parse('2026-12-16T07:59:59.999Z'); // 15 Dec 23:59:59.999 PT

function cookie(request:Request,name:string){return request.headers.get('cookie')?.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'='))?.slice(name.length+1);}
function secret(){const value=process.env.WTES_BILLING_SECRET;return value&&Buffer.byteLength(value)>=32?value:null;}
function sign(expires:number,key:string){return createHmac('sha256',key).update(`wtes-judge:${expires}`).digest('base64url');}

export function judgeAccess(request:Request,now=Date.now()){
 const key=secret(),raw=cookie(request,JUDGE_COOKIE);if(!key||!raw)return false;
 const [expiresText,signature]=raw.split('.');const expires=Number(expiresText);
 if(!Number.isSafeInteger(expires)||expires>JUDGE_END||expires<now||!signature)return false;
 const expected=Buffer.from(sign(expires,key)),given=Buffer.from(signature);
 return expected.length===given.length&&timingSafeEqual(expected,given);
}
export function judgeCookie(){const key=secret();if(!key)throw new Error('Judge access is unavailable.');const expires=JUDGE_END;return `${JUDGE_COOKIE}=${expires}.${sign(expires,key)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0,Math.floor((expires-Date.now())/1000))}`;}
export function judgeCodeMatches(candidate:unknown){const configured=process.env.WTES_JUDGE_CODE,key=secret();if(!configured||!key||typeof candidate!=='string')return false;const a=Buffer.from(candidate),b=Buffer.from(configured);return a.length===b.length&&timingSafeEqual(a,b);}
export async function hasPaidOrJudgeAccess(request:Request){
 if(judgeAccess(request))return true;
 const user=session(request);if(!user)return false;
 try{const billing=await billingStatus(user.userId);return billing.status==='trialing'||billing.status==='active';}catch{return false;}
}
