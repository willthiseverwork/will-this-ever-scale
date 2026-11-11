import {get,put} from '@vercel/blob';
import {createHash} from 'node:crypto';
import {groupLocalRows} from './browser-analysis';
import {reanalyzeSandboxRows} from './sandbox-reanalysis';
import type {Txn} from './types';
import {productGroupingResponseSchema} from './product-groups';
import type {ProductGrouping} from './product-groups';
const interval=900_000;
const token=()=>{const value=process.env.BLOB_READ_WRITE_TOKEN;if(!value)throw new Error('storage_unavailable');return value};
async function read(path:string){const result=await get(path,{access:'private',token:token(),useCache:false,abortSignal:AbortSignal.timeout(5000)});if(!result)return null;if(result.statusCode!==200||result.blob.size>900_000)throw new Error('storage_read_failed');return JSON.parse(await new Response(result.stream).text());}
async function write(path:string,value:unknown){const body=JSON.stringify(value);if(Buffer.byteLength(body)>=900_000)throw new Error('snapshot_too_large');await put(path,body,{access:'private',token:token(),addRandomSuffix:false,allowOverwrite:true,contentType:'application/json',abortSignal:AbortSignal.timeout(7000)});}
export async function getSnapshot(){return read('demo/snapshot.json');}
type LockStore={read:(path:string)=>Promise<number|null>;create:(path:string)=>Promise<void>};
const lockStore=():LockStore=>({async read(path){const result=await get(path,{access:'private',token:token(),useCache:false,abortSignal:AbortSignal.timeout(5000)});if(!result)return null;if(result.statusCode!==200)throw new Error('lock_read_failed');const at=new Date(result.blob.uploadedAt).getTime();await new Response(result.stream).text();if(!Number.isFinite(at))throw new Error('lock_time_invalid');return at},async create(path){await put(path,'{}',{access:'private',token:token(),addRandomSuffix:false,allowOverwrite:false,contentType:'application/json',abortSignal:AbortSignal.timeout(7000)})}});
const generation=(snapshotAt:string|null)=>createHash('sha256').update(snapshotAt||'cold').digest('hex');
async function latestLock(snapshotAt:string|null,store:LockStore=lockStore()){let latest:number|null=null;for(let n=0;n<100;n++){const at=await store.read(`demo/refresh-lock-v2/${generation(snapshotAt)}/${n}.json`);if(at===null)return latest;latest=at}throw new Error('lock_limit');}
export function statusForLock(status:any,lock:number|null,now=Date.now()){if(status?.code==='in_progress'&&status?.at&&now-Date.parse(status.at)>65000)return {...status,code:'interrupted_or_timed_out'};if(lock!==null&&(!status?.at||lock>Date.parse(status.at)))return {at:new Date(lock).toISOString(),ok:false,stage:'refresh',code:now-lock>65000?'interrupted_or_timed_out':'in_progress'};return status;}
export async function getSnapshotStatus(){const [snapshot,status]=await Promise.all([getSnapshot(),read('demo/status.json')]);const lock=await latestLock(snapshot?.at??null);return {snapshotTime:snapshot?.at??null,snapshotOrderCount:snapshot?.orders??null,lastRefresh:statusForLock(status,lock)};}
/** A server-timestamped immutable chain survives a worker crash. The extra 60s covers the maximum execution window before the next attempt. */
export async function reserveRefresh(snapshotAt:string|null,now=Date.now(),store:LockStore=lockStore()){if(snapshotAt&&(!Number.isFinite(Date.parse(snapshotAt))||now-Date.parse(snapshotAt)<interval))return false;for(let n=0;n<100;n++){const path=`demo/refresh-lock-v2/${generation(snapshotAt)}/${n}.json`,at=await store.read(path);if(at!==null){if(now-at<interval+60_000)return false;continue}try{await store.create(path);return true}catch(error){if(await store.read(path)!==null)return false;throw error}}throw new Error('lock_limit');}
export async function withRefreshDeadline<T>(work:Promise<T>,ms=30000):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('read_timeout')),ms)})])}finally{if(timer)clearTimeout(timer)}}
type GroupingCache={titlesHash:string;grouping:ProductGrouping};
/** Cache only successful AI output; a fallback must be retried on the next refresh. */
export async function groupDemoRows(rows:Txn[],origin:string,previous:unknown,groupProducts:typeof import('./group-products-server').groupProducts){
 const titles=[...new Set(rows.map(r=>r.item_title?.trim()).filter((x):x is string=>!!x))].sort();
 const titlesHash=createHash('sha256').update(JSON.stringify(titles)).digest('hex');
 const items=titles.map(title=>({title,orders:rows.filter(r=>r.item_title?.trim()===title&&r.gross>0&&['sale','invoice_payment','subscription_payment'].includes(r.kind)).length}));
 const cached=previous as Partial<GroupingCache>|null;
 let grouping:ProductGrouping|undefined;
 if(cached?.titlesHash===titlesHash&&cached.grouping?.source==='ai'){const {source,...content}=cached.grouping;if(productGroupingResponseSchema.safeParse(content).success)grouping={...content,source};}
 if(!grouping&&items.length){const response=await groupProducts(new Request(origin+'/api/product-groups',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({items})}),true);if(response.ok)grouping=await response.json() as ProductGrouping;}
 if(!grouping)return {...groupLocalRows(rows),cache:undefined};
 const names=new Map<string,string>();for(const group of grouping.groups)for(const title of group.titles)names.set(title,group.name);
 return {grouping,rows:rows.map(row=>row.item_title&&names.has(row.item_title.trim())?{...row,item_group:names.get(row.item_title.trim())}:row),cache:{titlesHash,grouping}};
}
export async function refreshSnapshot(origin:string){let stage='read';try{const {readSandbox}=await import('./sandbox-read');const response=await withRefreshDeadline(readSandbox(new Request(origin+'/api/sandbox/analyze',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({source:'demo'})}),true));const data=await response.json();if(!response.ok||!data.analysis)throw new Error(data.code||`http_${response.status}`);stage='grouping';const rows=data.reanalysisRows as Txn[];const previous=await getSnapshot();const {groupProducts}=await import('./group-products-server');const grouped=await groupDemoRows(rows,origin,previous?.groupingCache,groupProducts);
 stage='snapshot';data.analysis={...reanalyzeSandboxRows(grouped.rows,data.analysis,{}),product_grouping:grouped.grouping};data.reanalysisRows=grouped.rows;data.quietContacts=(data.quietContacts||[]).map(({key,name}:{key:string;name:string})=>({key,name}));const at=new Date().toISOString(),orders=data.analysis.months.reduce((n:number,m:{orders?:number})=>n+(m.orders||0),0);await write('demo/snapshot.json',{at,orders,data,groupingCache:grouped.cache});await write('demo/status.json',{at,ok:true});}catch(error){await write('demo/status.json',{at:new Date().toISOString(),ok:false,stage,code:error instanceof Error&&/^[a-z0-9_]+$/.test(error.message)?error.message:'refresh_failed'}).catch(()=>{});}}

export async function recordRefreshFailure(stage:'lock'|'schedule'|'storage'|'status',code:string){await write('demo/status.json',{at:new Date().toISOString(),ok:false,stage,code}).catch(()=>{});}
export async function attemptRefresh(origin:string,snapshotAt:string|null,dependencies={current:getSnapshot,reserve:reserveRefresh,refresh:refreshSnapshot,record:recordRefreshFailure,start:async()=>write('demo/status.json',{at:new Date().toISOString(),ok:false,stage:'refresh',code:'in_progress'})}){let stage:'storage'|'lock'|'status'='storage';try{const current=await dependencies.current();if((current?.at??null)!==snapshotAt)return;stage='lock';if(await dependencies.reserve(snapshotAt)){stage='status';await dependencies.start();await dependencies.refresh(origin)}}catch{await dependencies.record(stage,'storage_unavailable')}}
