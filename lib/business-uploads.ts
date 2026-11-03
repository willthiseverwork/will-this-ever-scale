import type {BusinessState} from './business-state';
/** Never merge unassigned uploads or uploads assigned to another business. */
export function assignedUploads<T extends {id:string}>(state:BusinessState,uploads:T[]):T[]{if(!state.selectedBusinessId)return [];const ids=new Set(state.imports.filter(i=>i.businessId===state.selectedBusinessId).map(i=>i.uploadId));return uploads.filter(upload=>ids.has(upload.id));}
