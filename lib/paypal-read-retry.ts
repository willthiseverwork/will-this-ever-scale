/** Retry one transient PayPal read only while the invocation has time remaining. */
export function paypalReadFetch(started:number,fetcher:typeof fetch=fetch,wait:(ms:number)=>Promise<void>=ms=>new Promise(resolve=>setTimeout(resolve,ms)),now:()=>number=Date.now):typeof fetch {
 return async(input,init)=>{const response=await fetcher(input,init);if((response.status===429||response.status>=500)&&now()-started<40000){await wait(10000);return fetcher(input,init);}return response;};
}
