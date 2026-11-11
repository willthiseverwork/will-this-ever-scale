import type {CostAnswers,CostResult} from '../lib/cost-interview';
export default function CostAnswerSummary({result,answers,item,currency}:{result:CostResult;answers:CostAnswers;item:string;currency:string}){
 const formatted=(value:number)=>new Intl.NumberFormat(currency==='GBP'?'en-GB':'en-US',{style:'currency',currency}).format(value);
 return <div className="cost-answer-summary">{result.parts.filter(part=>part.label!=='Help').map(part=><div key={part.label}><span>{part.label==='Materials'||part.label==='Buying'?`Making or buying · ${item} order`:part.label==='Posting'?'Postage and packing':part.label}</span><b>{part.label==='Your time'&&answers.notApplicable?.includes('pay')?'not applicable':part.label==='Posting'&&answers.notApplicable?.includes('post')?'not applicable':part.range?`${formatted(part.range.min)} to ${formatted(part.range.max)} ✓`:part.value===undefined?'skipped':`${formatted(part.value)} ✓`}</b></div>)}</div>;
}
