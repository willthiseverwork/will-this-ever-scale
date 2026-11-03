/** One isolated disposable production-build check for atomic private Blob replacement. */
import {randomUUID} from 'node:crypto';import {get,put,del,BlobPreconditionFailedError} from '@vercel/blob';
if(process.env.VERCEL_ENV==='production'){
 const token=process.env.BLOB_READ_WRITE_TOKEN;if(!token)throw new Error('Voice counter probe: private Blob token unavailable');
 const path=`wtes-voice-cas-probe/${randomUUID()}.json`;
 try{await put(path,JSON.stringify({count:1}),{access:'private',token,addRandomSuffix:false,allowOverwrite:false,contentType:'application/json'});const first=await get(path,{access:'private',token,useCache:false});if(!first||first.statusCode!==200||!first.blob.etag)throw new Error('Voice counter probe: readback unavailable');const stale=first.blob.etag;await put(path,JSON.stringify({count:2}),{access:'private',token,addRandomSuffix:false,allowOverwrite:true,ifMatch:stale,contentType:'application/json'});const after=await get(path,{access:'private',token,useCache:false});if(!after||after.statusCode!==200||JSON.parse(await new Response(after.stream).text()).count!==2)throw new Error('Voice counter probe: overwrite readback failed');let rejected=false;try{await put(path,JSON.stringify({count:3}),{access:'private',token,addRandomSuffix:false,allowOverwrite:true,ifMatch:stale,contentType:'application/json'})}catch(error){if(error instanceof BlobPreconditionFailedError)rejected=true;else throw error}if(!rejected)throw new Error('Voice counter probe: stale write was not rejected');console.log('Voice counter probe: conditional writes passed');}
 catch{throw new Error('Voice counter probe: conditional writes unavailable')}
 finally{await del(path,{token}).catch(()=>console.error('Voice counter probe: disposable record cleanup failed'))}
}
