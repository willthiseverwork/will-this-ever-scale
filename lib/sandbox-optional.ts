/** Optional enrichments must not erase an otherwise valid sandbox analysis. */
export function optionalSandboxPart<T>(run:()=>T):{ok:true;value:T}|{ok:false}{try{return {ok:true,value:run()};}catch{return {ok:false};}}
export async function optionalSandboxPartAsync<T>(run:()=>Promise<T>):Promise<{ok:true;value:T}|{ok:false}>{try{return {ok:true,value:await run()};}catch{return {ok:false};}}
