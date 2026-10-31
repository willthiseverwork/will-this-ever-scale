import { randomBytes } from 'node:crypto';
export type Credentials={clientId:string;clientSecret:string};
const root=globalThis as typeof globalThis & {__paypalSessions?:Map<string,{credentials:Credentials;expires:number}>};
const sessions=root.__paypalSessions ??= new Map();
const TTL=30*60*1000;
export function newSession(credentials:Credentials){for(const [k,v] of sessions)if(v.expires<Date.now())sessions.delete(k);const id=randomBytes(32).toString('hex');sessions.set(id,{credentials,expires:Date.now()+TTL});return id;}
export function getSession(id:string|undefined){if(!id)return undefined;const s=sessions.get(id);if(!s||s.expires<Date.now()){sessions.delete(id);return undefined;}return s.credentials;}
export function removeSession(id:string|undefined){if(id)sessions.delete(id);}
export function sessionId(r:Request){return r.headers.get('cookie')?.match(/(?:^|;\s*)paypal_session=([a-f0-9]{64})(?:;|$)/)?.[1];}
export function sameOrigin(r:Request){const origin=r.headers.get('origin');return !!origin&&origin===new URL(r.url).origin;}
