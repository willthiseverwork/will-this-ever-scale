import type {BusinessState} from './business-state';
/** Never merge unassigned uploads or uploads assigned to another business. */
export function assignedUploads<T extends {id:string}>(state:BusinessState,uploads:T[]):T[]{if(!state.selectedBusinessId)return [];const ids=new Set(state.imports.filter(i=>i.businessId===state.selectedBusinessId).map(i=>i.uploadId));return uploads.filter(upload=>ids.has(upload.id));}
/** The entry screen must not imply an empty account while a restore is pending. */
export function shouldWaitForRestore(input:{hydrated:boolean;hasAnalysis:boolean;account:string;finished:boolean}){return !input.hasAnalysis&&!input.finished&&(!input.hydrated||input.account==='loading'||input.account==='signedin');}
