export default function InvoiceConfirmation({done,confirmed,reused}:{done:boolean;confirmed:number;reused:number}){
 if(!done||confirmed<=0)return null;
 return <section className="card invoice-confirmed"><h2>After you approve</h2><p>PayPal confirmed · {confirmed-reused} reminders sent{reused>0?` · ${reused} already confirmed`:''}</p></section>;
}
