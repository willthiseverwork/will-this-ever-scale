/** Check the current server session at the moment sandbox data is ready. */
export async function sandboxAccountCanSave(fetcher:typeof fetch=fetch, refresh?:()=>Promise<void>){
 if(refresh)await refresh();
 const response=await fetcher('/api/account',{cache:'no-store'});
 if(!response.ok)throw new Error('Account status unavailable');
 const account=await response.json();
 return account.authenticated===true&&account.deletionPending!==true;
}
