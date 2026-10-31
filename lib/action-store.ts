import { createCipheriv,createDecipheriv,createHash,randomBytes } from 'node:crypto';
import { get,put,BlobPreconditionFailedError } from '@vercel/blob';

export class ActionConflict extends Error {}
export interface ActionStore {read(path:string):Promise<{body:string;etag:string}|null>;create(path:string,body:string):Promise<void>;replace(path:string,body:string,etag:string):Promise<void>}
let testStore:ActionStore|undefined;
/** Only reachable inside Node's test runner; never selected from a request. */
export function setActionStoreForTests(store:ActionStore|undefined){if(!process.env.NODE_TEST_CONTEXT)throw new Error('Test runner required');testStore=store;}
export function actionStore():ActionStore {
 if(testStore)return testStore;
 const token=process.env.BLOB_READ_WRITE_TOKEN;if(!token)throw new Error('Private action storage is not configured.');
 return {
  async read(path){const signal=AbortSignal.timeout(5000);const result=await get(path,{access:'private',token,useCache:false,abortSignal:signal});if(!result)return null;if(result.statusCode!==200||!result.blob.etag||result.blob.size>32768)throw new Error('Action storage unavailable.');const body=await new Response(result.stream).text();if(Buffer.byteLength(body)>32768)throw new Error('Invalid action record.');return {body,etag:result.blob.etag};},
  async create(path,body){try{await put(path,body,{access:'private',token,addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',abortSignal:AbortSignal.timeout(5000)});}catch(error){if(error instanceof BlobPreconditionFailedError)throw new ActionConflict();throw error;}},
  async replace(path,body,etag){try{await put(path,body,{access:'private',token,addRandomSuffix:false,allowOverwrite:true,ifMatch:etag,contentType:'application/json',abortSignal:AbortSignal.timeout(5000)});}catch(error){if(error instanceof BlobPreconditionFailedError)throw new ActionConflict();throw error;}}
 };
}
function key(secret:string){if(Buffer.byteLength(secret)<32)throw new Error('Action signing is not configured.');return createHash('sha256').update(secret).digest();}
/** Stored proposals can contain addresses for the retained invoice API: encrypt at rest. No credentials are stored. */
export function sealAction(value:unknown,secret:string){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key(secret),iv);const body=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);return JSON.stringify({v:1,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),body:body.toString('base64url')});}
export function openAction<T>(body:string,secret:string):T {const x=JSON.parse(body);if(x.v!==1)throw new Error('Invalid action record.');const decipher=createDecipheriv('aes-256-gcm',key(secret),Buffer.from(x.iv,'base64url'));decipher.setAuthTag(Buffer.from(x.tag,'base64url'));return JSON.parse(Buffer.concat([decipher.update(Buffer.from(x.body,'base64url')),decipher.final()]).toString('utf8')) as T;}
/** Distributed per-minute sandbox limits. Only a keyed hash of the network bucket is retained. */
export async function reserveSandboxRequest(request:Request,lane:'read'|'connect'|'proposal',secret:string,store=actionStore(),now=Date.now()){
 const address=request.headers.get('x-vercel-forwarded-for')?.split(',')[0]?.trim()||'shared';const bucket=createHash('sha256').update(secret+':'+address).digest('hex');const path=`paypal-rate/${lane}/${Math.floor(now/60000)}-${bucket}.json`,limit=lane==='read'?6:20;
 for(let attempt=0;attempt<4;attempt++){try{const previous=await store.read(path);if(!previous){await store.create(path,JSON.stringify({count:1}));return true;}const count=JSON.parse(previous.body).count;if(!Number.isSafeInteger(count)||count<1)throw new Error('Invalid rate record');if(count>=limit)return false;await store.replace(path,JSON.stringify({count:count+1}),previous.etag);return true;}catch(error){if(error instanceof ActionConflict)continue;throw error;}}return false;
}
