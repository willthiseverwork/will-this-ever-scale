import {createHmac} from 'node:crypto';
import {get,put,BlobPreconditionFailedError} from '@vercel/blob';
import {openAction,sealAction} from './action-store';
import {workspaceBlobCredentials} from './workspace-store';

/** A checkout reservation persists across errors: an uncertain provider outcome is not safe to erase. */
type Intent={version:1;state:'checkout'|'deleting'};
export class LifecycleBlocked extends Error {}
export class LifecycleConflict extends Error {}
export interface LifecycleStore {read(path:string):Promise<{body:string;etag:string}|null>;write(path:string,body:string,etag:string|null):Promise<void>}
let testStore:LifecycleStore|undefined;
export function setLifecycleStoreForTests(value:LifecycleStore|undefined){if(!process.env.NODE_TEST_CONTEXT)throw new Error('Test runner required');testStore=value;}
function config(userId:string){const secret=process.env.WTES_WORKSPACE_SECRET,id=process.env.WTES_WORKSPACE_STORE_ID,token=process.env.WTES_WORKSPACE_BLOB_TOKEN;if(!secret||Buffer.byteLength(secret)<32)throw new Error('Lifecycle storage is not configured.');let selection:{storeId:string}|{token:string}|null=null;if(id!==undefined){if(!/^store_[A-Za-z0-9]+$/.test(id))throw new Error('Lifecycle storage is not configured.');selection={storeId:id};}else if(token)selection={token};if(!selection&&!testStore)throw new Error('Lifecycle storage is not configured.');return {secret,selection,path:'wtes-lifecycle/'+createHmac('sha256',secret).update('lifecycle:'+userId).digest('hex')+'.json'};}
function storage(selection:{storeId:string}|{token:string}|null):LifecycleStore {if(testStore)return testStore;if(!selection)throw new Error('Lifecycle storage is not configured.');return {async read(path){const credentials=await workspaceBlobCredentials(selection),result=await get(path,{access:'private',...credentials,useCache:false,abortSignal:AbortSignal.timeout(5000)});if(!result)return null;if(result.statusCode!==200||!result.blob.etag||result.blob.size>8192)throw new Error('Lifecycle storage unavailable.');const body=await new Response(result.stream).text();if(Buffer.byteLength(body)>8192)throw new Error('Invalid lifecycle record.');return {body,etag:result.blob.etag};},async write(path,body,etag){try{const credentials=await workspaceBlobCredentials(selection);await put(path,body,{access:'private',...credentials,addRandomSuffix:false,allowOverwrite:!!etag,...(etag?{ifMatch:etag}:{}),contentType:'application/json',abortSignal:AbortSignal.timeout(5000)});}catch(e){if(e instanceof BlobPreconditionFailedError)throw new LifecycleConflict();throw e;}}};}
async function claim(userId:string,wanted:Intent['state']){const {secret,selection,path}=config(userId),store=storage(selection);for(let attempt=0;attempt<4;attempt++){const previous=await store.read(path);if(previous){const value=openAction<Intent>(previous.body,secret);if(value.version!==1||!['checkout','deleting'].includes(value.state)||Object.keys(value).some(k=>!['version','state'].includes(k)))throw new Error('Invalid lifecycle record.');if(value.state!==wanted)throw new LifecycleBlocked();return;}try{await store.write(path,sealAction({version:1,state:wanted} satisfies Intent,secret),null);return;}catch(e){if(e instanceof LifecycleConflict)continue;throw e;}}throw new LifecycleConflict();}
/** Call before any checkout record write or Paddle transaction request. */
export async function reserveCheckout(userId:string){await claim(userId,'checkout');}
/** Call before deleting workspace data or requesting provider account deletion. */
export async function claimAccountDeletion(userId:string){await claim(userId,'deleting');}
