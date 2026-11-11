import Link from 'next/link';
import {visitCostLines,type visitCost} from '../lib/visit-cost';

type Available = Extract<ReturnType<typeof visitCost>,{status:'available'}>;
export default function VisitCostResult({value,currency,item}:{value:Available;currency:string;item:string}){
 const lines=visitCostLines(value,currency,item),r=value.result;
 const fmt=(n:number)=>new Intl.NumberFormat(currency==='GBP'?'en-GB':'en-US',{style:'currency',currency}).format(n);
 return <><p>{r.fee===null?'What you keep is not yet known because the PayPal fee is missing.':r.keep<0?`This order is about ${fmt(Math.abs(r.keep))} below the costs you told us.`:`You keep about ${lines.keep} an order, after the costs you told us${lines.unknown.length?' so far':''}.`}</p><div className="voice-breakdown"><div><span>Buyer pays</span><b>{lines.buyerPays}</b></div><div><span>{lines.feeLabel}</span><b>{lines.fee}</b></div><div><span>Your costs {lines.detail&&`(${lines.detail})`}</span><b>{lines.cost}</b></div><div><span>You keep{lines.unknown.length?' so far':''}</span><b>{lines.keep}</b></div></div><p>{lines.coverage}{lines.unknown.length?` Not yet: ${lines.unknown.join(', ')}.`:''}</p><p className="small">An estimate from your own sales, not a promise. <Link data-analytics-id="terms_link" href="/terms">Terms</Link></p></>
}
