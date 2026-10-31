/** Shared model-call allowance. Each provider HTTP invocation must reserve first. */
import { get, put, BlobPreconditionFailedError } from '@vercel/blob';

const MAX_MONTHLY_CALLS=500;
const MAX_BYTES=256;
const TIMEOUT_MS=3000;
type BudgetRecord={version:1;month:string;count:number};
export type BudgetResult={allowed:true;reason:'reserved'}|{allowed:false;reason:'exhausted'|'unavailable'};
export class BudgetConflict extends Error {}
export interface BudgetStore {
  read(path:string):Promise<{body:string;etag:string}|null>;
  create(path:string,body:string):Promise<void>;
  replace(path:string,body:string,etag:string):Promise<void>;
}

/** A private Blob record contains only version, UTC month, and reserved model-call count. */
function blobStore(token:string):BudgetStore {
  return {
    async read(path){
      const signal=AbortSignal.timeout(TIMEOUT_MS);
      const result=await get(path,{access:'private',token,useCache:false,abortSignal:signal});
      if(!result)return null;
      if(result.statusCode!==200||!result.blob.etag||result.blob.size>MAX_BYTES)throw new Error('Invalid budget record');
      if(signal.aborted)throw new Error('Budget read timed out');
      const text=await Promise.race([new Response(result.stream).text(),new Promise<never>((_,reject)=>signal.addEventListener('abort',()=>reject(new Error('Budget read timed out')),{once:true}))]);
      if(new TextEncoder().encode(text).byteLength>MAX_BYTES)throw new Error('Invalid budget record');
      return {body:text,etag:result.blob.etag};
    },
    async create(path,body){
      try{await put(path,body,{access:'private',token,addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',abortSignal:AbortSignal.timeout(TIMEOUT_MS)});}
      catch(error){if(error instanceof BlobPreconditionFailedError)throw new BudgetConflict();throw error;}
    },
    async replace(path,body,etag){
      try{await put(path,body,{access:'private',token,addRandomSuffix:false,ifMatch:etag,contentType:'application/json',abortSignal:AbortSignal.timeout(TIMEOUT_MS)});}
      catch(error){if(error instanceof BlobPreconditionFailedError)throw new BudgetConflict();throw error;}
    }
  };
}
function parseRecord(body:string,month:string):BudgetRecord {
  if(new TextEncoder().encode(body).byteLength>MAX_BYTES)throw new Error('Invalid budget record');
  const r:unknown=JSON.parse(body);
  if(!r||typeof r!=='object'||Array.isArray(r))throw new Error('Invalid budget record');
  const x=r as Record<string,unknown>,keys=Object.keys(x).sort();
  if(keys.join(',')!=='count,month,version'||x.version!==1||x.month!==month||!Number.isSafeInteger(x.count)||typeof x.count!=='number'||x.count<0||x.count>MAX_MONTHLY_CALLS)throw new Error('Invalid budget record');
  return {version:1,month,count:x.count};
}
/**
 * Reserves one slot before one provider HTTP invocation. No reservation is refunded on
 * errors or timeouts: the provider may have received the call. The optional store,
 * clock and lower limit are injectable for tests; no caller can raise the 500 cap.
 */
export async function reserveAiBudget(options:{store?:BudgetStore;now?:Date;limit?:number;token?:string}={}):Promise<BudgetResult>{
  const limit=options.limit??MAX_MONTHLY_CALLS,now=options.now??new Date(),token=options.token??process.env.BLOB_READ_WRITE_TOKEN;
  if(!Number.isSafeInteger(limit)||limit<0||limit>MAX_MONTHLY_CALLS||!Number.isFinite(now.getTime()))return {allowed:false,reason:'unavailable'};
  if(limit===0)return {allowed:false,reason:'exhausted'};
  if(!options.store&&!token)return {allowed:false,reason:'unavailable'};
  const store=options.store??blobStore(token!),month=now.toISOString().slice(0,7),path=`ai-budget/${month}.json`;
  for(let attempt=0;attempt<3;attempt++){
    try{
      const existing=await store.read(path);
      if(!existing){await store.create(path,JSON.stringify({version:1,month,count:1}));return {allowed:true,reason:'reserved'};}
      const record=parseRecord(existing.body,month);
      if(!existing.etag)return {allowed:false,reason:'unavailable'};
      if(record.count>=limit)return {allowed:false,reason:'exhausted'};
      await store.replace(path,JSON.stringify({...record,count:record.count+1}),existing.etag);
      return {allowed:true,reason:'reserved'};
    }catch(error){if(error instanceof BudgetConflict)continue;return {allowed:false,reason:'unavailable'};}
  }
  return {allowed:false,reason:'unavailable'};
}
