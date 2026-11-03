import {randomUUID} from 'node:crypto';
import {getWorkspace,getBusinessState,getUploadRecord,putUploadRecord,updateBusinessState,deleteWorkspace,probeSyntheticWorkspaceCas} from './workspace-store';
import {serializeWorkspaceExport} from './workspace-export';
import {businessReadOnly} from './business-state';
/** Called only by the opt-in build probe, with a freshly generated synthetic owner. */
export async function runFallbackStorageProbe(owner:string,uploadId:string,onPhase:(phase:string)=>void=()=>{}){
 if(!/^user_wtesprobe[a-f0-9]{32}$/.test(owner)||!/^[0-9a-f-]{36}$/i.test(uploadId)||!businessReadOnly())throw new Error('Invalid synthetic fallback probe.');
 const row={id:'b_'+'a'.repeat(64),date:'2026-11-03',kind:'sale',gross:10,fee:1,fee_known:true,net:9,currency:'GBP',status:'completed'},upload={id:uploadId,uploadedAt:'2026-11-03T12:00:00.000Z',source:'seller_file',rows:[row]};
 onPhase('setup');await putUploadRecord(owner,uploadId,upload);onPhase('conditional-write');await probeSyntheticWorkspaceCas(owner);let state=await getBusinessState(owner);state=await updateBusinessState(owner,state.revision,{type:'create_business',id:randomUUID(),label:'Synthetic probe',compartment:'seller_file'});const businessId=state.selectedBusinessId;if(!businessId)throw new Error('Synthetic business unavailable.');state=await updateBusinessState(owner,state.revision,{type:'confirm_fact',fact:{id:randomUUID(),operationId:randomUUID(),businessId,productId:null,field:'helpers',state:'confirmed',value:7,currency:'GBP',basis:'month',validFrom:'2026-11-01',validTo:null,confirmedAt:'2026-11-03T12:00:00.000Z',source:'seller_confirmed',supersedes:[]}});
 onPhase('export');const read=await getWorkspace(owner),savedUpload=await getUploadRecord(owner,uploadId);const exported=JSON.parse(serializeWorkspaceExport(read,[savedUpload],state));if(exported.business.facts.length!==1||exported.uploads.length!==1)throw new Error('Synthetic export failed.');
 onPhase('delete');await deleteWorkspace(owner);onPhase('readback');const after=await getBusinessState(owner);if(after.businesses.length||after.facts.length||after.imports.length||after.views.length||await getUploadRecord(owner,uploadId)!==null)throw new Error('Synthetic deletion failed.');
}
