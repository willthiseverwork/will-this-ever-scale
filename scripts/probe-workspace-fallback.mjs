/** Opt-in production build check, restricted to one parent-supplied synthetic namespace. */
import {createHmac} from 'node:crypto';import {del,get} from '@vercel/blob';import {fallbackProbeConfig} from '../lib/fallback-probe-config.ts';
const probe=fallbackProbeConfig(process.env);
if(probe){
 const secret=process.env.WTES_WORKSPACE_SECRET,id=process.env.WTES_WORKSPACE_STORE_ID,token=process.env.WTES_WORKSPACE_BLOB_TOKEN;
 if(!secret||Buffer.byteLength(secret)<32||id!==undefined&&!/^store_[A-Za-z0-9]+$/.test(id)||!id&&!token)throw new Error('Fallback storage probe configuration unavailable.');
 const ownerHash=createHmac('sha256',secret).update(probe.owner).digest('hex'),paths=[`wtes-workspace/${ownerHash}.json`,`wtes-business/${ownerHash}.json`,`wtes-uploads/${ownerHash}/index.json`,`wtes-uploads/${ownerHash}/${probe.probeId}.json`];
 let credentials;try{const {workspaceBlobCredentials}=await import('../lib/workspace-store.ts');credentials=await workspaceBlobCredentials(id?{storeId:id}:{token})}catch{throw new Error('Fallback storage probe access unavailable.');}
 async function present(){let count=0;for(const path of paths){const result=await get(path,{access:'private',...credentials,useCache:false,abortSignal:AbortSignal.timeout(5000)});if(result)count++}return count;}
 async function cleanup(){console.log('Fallback storage probe phase: cleanup.');await del(paths,credentials);if(await present())throw new Error('Cleanup incomplete.');console.log('Fallback storage probe: cleanup confirmed.');}
 if(probe.mode==='cleanup'){try{console.log(`Fallback storage probe: ${await present()} synthetic paths present.`);await cleanup()}catch{throw new Error('Fallback storage cleanup could not be confirmed.');}}
 else{
  try{if(await present())throw new Error('existing')}catch{throw new Error('Fallback probe namespace is not empty or could not be checked; reconcile before running.');}
  let failedPhase=null,phase='setup',cleanupConfirmed=false;
  try{const {runFallbackStorageProbe}=await import('../lib/fallback-storage-probe.ts');await runFallbackStorageProbe(probe.owner,probe.probeId,value=>{phase=value;console.log(`Fallback storage probe phase: ${value}.`)})}catch{failedPhase=phase}
  try{await cleanup();cleanupConfirmed=true}catch{}
  if(failedPhase||!cleanupConfirmed)throw new Error(`Fallback storage probe failed in ${failedPhase||'cleanup'}; cleanup ${cleanupConfirmed?'confirmed':'unconfirmed'}.`);
  console.log('Fallback storage probe: synthetic storage passed.');
 }
}
