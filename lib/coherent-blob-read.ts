/** Metadata ETags are the documented ifMatch versions. The private GET must bypass cache. */
export class BlobVersionChanged extends Error {}
export async function readCoherentBlob(readVersion:()=>Promise<string|null>,readBody:()=>Promise<{body:string}|null>){
 const before=await readVersion(),content=await readBody();
 if(before===null){if(content!==null)throw new BlobVersionChanged();return null;}
 if(content===null)throw new BlobVersionChanged();
 const after=await readVersion();
 if(after!==before)throw new BlobVersionChanged();
 return {body:content.body,etag:before};
}
