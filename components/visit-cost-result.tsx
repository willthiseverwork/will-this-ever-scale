import Link from 'next/link';
import {visitCostLines,type visitCost} from '../lib/visit-cost';

type Available = Extract<ReturnType<typeof visitCost>,{status:'available'}>;
export default function VisitCostResult({value,currency,item,full=false}:{value:Available;currency:string;item:string;full?:boolean}){
 const lines=visitCostLines(value,currency,item),r=value.result;
 const fmt=(n:number)=>new Intl.NumberFormat(currency==='GBP'?'en-GB':'en-US',{style:'currency',currency}).format(n);
 const headline=r.fee===null?'What you keep is not yet known because the PayPal fee is missing.':r.keepRange?`After the costs you told us, this order leaves ${lines.keep}.`:r.keep<0?`This order is about ${fmt(Math.abs(r.keep))} below the costs you told us.`:`You keep about ${lines.keep} an order, after the costs you told us${lines.unknown.length?' so far':''}.`;
 return <>{full&&<span className="ws-eyebrow">Real cost · {item}</span>}{full?<h2>{headline}</h2>:<p>{headline}</p>}<div className="voice-breakdown"><div><span>Buyer pays</span><b>{lines.buyerPays}</b></div><div><span>{lines.feeLabel}{full&&<small>{r.fee===null?'not yet known':value.feeEstimated?'estimated from your sales':'what PayPal recorded on these orders'}</small>}</span><b>{lines.fee}</b></div><div><span>Your costs{lines.detail&&<small>{lines.detail}</small>}</span><b>{lines.cost}</b></div><div><span>You keep{lines.unknown.length?' so far':''}</span><b>{lines.keep}</b></div></div><p>{lines.coverage}{lines.unknown.length?` Not yet: ${lines.unknown.join(', ')}.`:''}</p>{!full&&<p className="small">An estimate from your own sales, not a promise. <Link data-analytics-id="terms_link" href="/terms">Terms</Link></p>}</>
}
