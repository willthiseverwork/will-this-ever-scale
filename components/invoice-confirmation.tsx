export default function InvoiceConfirmation({done,confirmed,reused,chartDate}:{done:boolean;confirmed:number;reused:number;chartDate?:string}){
 if(!done||confirmed<=0)return null;
 return <section className="card invoice-confirmed"><h2>After you approve</h2><p>PayPal confirmed · {confirmed-reused} reminders sent{reused>0?` · ${reused} already confirmed`:''}</p>{chartDate&&<p>On your chart · marked {chartDate}</p>}</section>;
}
