import {ActionConflict,actionStore,openAction,sealAction,type ActionStore} from './action-store';

const jobPath=(id:string,job:string)=>{
 if(!/^[a-f0-9]{64}$/.test(id)||!/^(?:set|[0-9]|1[0-9])$/.test(job))throw new Error('Invalid action job');
 return `paypal-action-jobs/${id}/${job}`;
};
/** Immutable reservations prevent a repeated approval from starting another worker. */
export async function runActionJob(id:string,job:string,secret:string,work:()=>Promise<unknown>,store:ActionStore=actionStore()){
 const path=jobPath(id,job);
 try{await store.create(`${path}.lock`,sealAction({started:true},secret));}catch(error){if(error instanceof ActionConflict)return;throw error;}
 let outcome:{result?:unknown;error?:string};
 try{outcome={result:await work()};}catch(error){outcome={error:error instanceof Error?error.message:'The result is unknown. Check PayPal before trying again.'};}
 await store.create(`${path}.result`,sealAction(outcome,secret));
}
export async function readActionJob(id:string,job:string,secret:string,store:ActionStore=actionStore()){
 const found=await store.read(`${jobPath(id,job)}.result`);
 return found?openAction<{result?:unknown;error?:string}>(found.body,secret):null;
}
