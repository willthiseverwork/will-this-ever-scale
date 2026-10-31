import {ActionConflict,type ActionStore} from '../lib/action-store';
export function memoryActionStore():ActionStore{
 const records=new Map<string,{body:string;etag:string}>();let version=0;
 return {async read(path){return records.get(path)||null;},async create(path,body){if(records.has(path))throw new ActionConflict();records.set(path,{body,etag:String(++version)});},async replace(path,body,etag){if(records.get(path)?.etag!==etag)throw new ActionConflict();records.set(path,{body,etag:String(++version)});}};
}
