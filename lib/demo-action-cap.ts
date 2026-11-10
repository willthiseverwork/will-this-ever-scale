import {ActionConflict,actionStore,type ActionStore} from './action-store';
/** Immutable slots bound the total across instances; duplicate attempts may conservatively use extra slots. */
export async function reserveDemoAction(id:string,kind:'reminder'|'set',store:ActionStore=actionStore(),now=Date.now()){
 const day=new Date(now).toISOString().slice(0,10);for(let i=0;i<20;i++){const path=`demo/action-cap/${day}/${kind}/${i}.json`;const previous=await store.read(path);if(previous){if(JSON.parse(previous.body).id===id)return true;continue}try{await store.create(path,JSON.stringify({id}));return true}catch(error){if(error instanceof ActionConflict){const winner=await store.read(path);if(winner&&JSON.parse(winner.body).id===id)return true;continue}throw error}}return false;
}
