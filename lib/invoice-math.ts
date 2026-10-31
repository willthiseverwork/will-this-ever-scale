/** Deterministic deposit amount, rounded once to the currency's cent. */
export function depositAmount(total:string,percent:string):string {
 if(!/^\d{1,8}(\.\d{1,2})?$/.test(total)||!/^\d{1,3}$/.test(percent))throw new Error('Enter a positive order amount and a whole deposit percentage from 1 to 100.');
 const cents=Math.round(Number(total)*100),share=Number(percent);
 if(cents<=0||share<1||share>100)throw new Error('Enter a positive order amount and a whole deposit percentage from 1 to 100.');
 const deposit=Math.round(cents*share/100);
 if(deposit<1)throw new Error('The deposit must be at least one cent.');
 return (deposit/100).toFixed(2);
}
