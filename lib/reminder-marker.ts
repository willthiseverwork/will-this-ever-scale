export function reminderMarker(input:{done:boolean;confirmed:number;reused:number;proposalId?:string;previousProposal?:string;date:string}){
 const sent=input.confirmed-input.reused;
 if(!input.done||sent<=0||!input.proposalId||input.previousProposal===input.proposalId||!/^\d{4}-\d{2}-\d{2}$/.test(input.date))return null;
 return {reminder_started:input.date,reminder_count:String(sent),reminder_proposal:input.proposalId};
}
