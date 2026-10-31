/** Bound request bytes before JSON parsing or schema validation, including chunked bodies. */
export async function readLimitedJson(request:Request,maxBytes:number):Promise<unknown>{
 const length=request.headers.get('content-length');if(length!==null&&(!/^\d+$/.test(length)||Number(length)>maxBytes))throw new Error('Request too large.');
 if(!request.body)throw new Error('Missing request body.');
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){await reader.cancel();throw new Error('Request too large.');}chunks.push(value);}} finally {reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
}
