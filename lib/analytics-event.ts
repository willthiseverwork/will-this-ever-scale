/** Only fixed interaction IDs and the pathname enter analytics, never field values. */
export function interactionPayload(type:string,id:string,origin:string,pathname:string){return {name:type==='submit'?'form_submit':type==='change'?'interaction_change':'interaction_click',params:{element_label:id,page_location:origin+pathname,page_referrer:''}};}
