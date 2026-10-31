import type { Analysis, ItemGroupSummary } from './types';
import { merchantKnowledge } from './merchant-knowledge';
import type { DataChatAnswer, DataChatMetric, DataChatPeriod, DataChatPlan } from './data-chat-types';

const metrics:DataChatMetric[]=['gross','orders','refunds','fees','kept'];
const validMonth=(s:unknown):s is string=>typeof s==='string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(s);
const exactKeys=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).sort().join('|')===keys.sort().join('|');
function shiftMonth(month:string, delta:number):string { const [year,m]=month.split('-').map(Number); const d=new Date(Date.UTC(year,m-1+delta,1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}`; }
/** Treat plans from any parser as untrusted: reject unknown fields, actions and malformed periods. */
export function isDataChatPlan(value:unknown):value is DataChatPlan {
  if(!value || typeof value!=='object' || Array.isArray(value)) return false;
  const p=value as Record<string,unknown>;
  if(p.kind==='compare_months') return exactKeys(p,['kind','metric','months']) && metrics.includes(p.metric as DataChatMetric) && Array.isArray(p.months) && p.months.length===2 && p.months.every(validMonth) && p.months[0]!==p.months[1];
  if(p.kind==='issues') return exactKeys(p,['kind','mode']) && (p.mode==='issues'||p.mode==='questions');
  if((p.kind!=='rank_items' && p.kind!=='summary') || !exactKeys(p,['kind','metric','period']) || !metrics.includes(p.metric as DataChatMetric) || (p.kind==='rank_items'&&!['gross','orders','refunds'].includes(String(p.metric))) || !p.period || typeof p.period!=='object' || Array.isArray(p.period)) return false;
  const period=p.period as Record<string,unknown>;
  return (period.kind==='whole' && exactKeys(period,['kind'])) || (period.kind==='month' && exactKeys(period,['kind','month']) && validMonth(period.month)) || (period.kind==='three_months' && exactKeys(period,['kind','months']) && Array.isArray(period.months) && period.months.length===3 && period.months.every(validMonth) && shiftMonth(period.months[0],1)===period.months[1] && shiftMonth(period.months[1],1)===period.months[2]);
}
export function parseDataChatPlan(value:unknown):DataChatPlan|null { return isDataChatPlan(value)?value:null; }
const answer=(status:DataChatAnswer['status'],text:string,choices?:string[]):DataChatAnswer=>({status,text,sources:[],caveats:[],...(choices?{choices}:{})});
const money=(v:number,c:string)=>`${c} ${v.toFixed(2)}`;
const monthNames=['january','february','march','april','may','june','july','august','september','october','november','december'];
function mentionedMonths(q:string):string[] {
  const found:{at:number;month:string}[]=[];
  for(const m of q.matchAll(/\b(\d{4}-(?:0[1-9]|1[0-2]))\b/g)) found.push({at:m.index!,month:m[1]});
  const re=/\b(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})\b/g;
  for(const m of q.matchAll(re)) found.push({at:m.index!,month:`${m[2]}-${String(monthNames.indexOf(m[1])+1).padStart(2,'0')}`});
  return [...new Set(found.sort((a,b)=>a.at-b.at).map(x=>x.month))];
}
function fixedMonthComplete(a:Analysis):boolean {if(a.clock_basis!=='fixed'||!a.as_of)return false;const d=new Date(a.as_of);return Number.isFinite(d.getTime())&&d.getUTCDate()===new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();}
/** Natural-language matching is local; a date context is needed for relative periods. */
export function parseDataChatQuestion(question:string, analysis?:Analysis):DataChatPlan|DataChatAnswer {
  const q=question.toLowerCase().trim(), months=mentionedMonths(q);
  if(analysis?.item_groups.some(item=>item.name!=='Unlabelled items' && item.name.length>=3 && (' '+q.replace(/[^a-z0-9]+/g,' ')+' ').includes(' '+item.name.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()+' '))) return answer('unavailable','Questions about a specific named product are not supported yet. Try an item ranking by sales, orders or refunds.');
  const asOf=analysis?.as_of?.slice(0,7); const current=validMonth(asOf)?asOf:undefined;
  const compare=/\b(compare|versus|vs\.?|difference|changed|change)\b/.test(q);
  const metric:DataChatMetric|undefined=/\b(refund|refunds|refunded|reversal|reversals)\b/.test(q)?'refunds':/\b(order|orders)\b/.test(q)?'orders':/\b(fee|fees)\b/.test(q)?'fees':/\b(kept|profit|earned|make|made)\b/.test(q)?'kept':/\b(revenue|sales|gross|came in)\b/.test(q)?'gross':undefined;
  if(/\b(daily|day|days|yesterday|today)\b/.test(q)||/\b\d{4}-\d{2}-\d{2}\b/.test(q)) return answer('unavailable','Daily data is not available in this analysis. I can compare calendar months instead.');
  if(/\b(units?|quantity|quantities|pieces? sold)\b/.test(q)) return answer('unavailable','Units sold are not available in this analysis. Order counts are not units.');
  if(/\b(issues|opportunities|problems|ask (?:my |the )?customers|customer questions)\b/.test(q)) return {kind:'issues',mode:/\b(ask|questions)\b/.test(q)?'questions':'issues'};
  const relative:{at:number;month:string}[]=[];
  for(const m of q.matchAll(/\b(this month|last month)\b/g)) {if(!current)return answer('clarify','The analysis date is missing. Which calendar month and year should I use?');relative.push({at:m.index!,month:m[1]==='this month'?current:shiftMonth(current,-1)});}
  const explicit=months.map(month=>({month,at:q.indexOf(month)}));
  for(const entry of explicit) if(entry.at<0){const idx=Number(entry.month.slice(5))-1;entry.at=q.indexOf(monthNames[idx]);}
  const allMonths=[...explicit,...relative].sort((x,y)=>x.at-y.at).map(x=>x.month);
  if(compare){
    if(allMonths.length!==2 || allMonths[0]===allMonths[1]) return answer('clarify','Which two calendar months would you like to compare?',['Last month vs this month','2026-08 vs 2026-09']);
    if(!metric) return answer('clarify','Which metric should I compare?',['Gross sales','Orders','Refunds and reversals','Fees','Kept']);
    return {kind:'compare_months',metric,months:[allMonths[0],allMonths[1]]};
  }
  const ranking=/\b(popular|best.selling|top|most|highest|biggest)\b/.test(q) && /\b(product|products|item|items|refund|refunds)\b/.test(q);
  if(ranking&&!metric) return answer('clarify','How should I define most popular, and for which period?',['Gross sales for latest completed month','Orders for latest completed month','Gross sales for all data']);
  if(ranking&&metric&&!['gross','orders','refunds'].includes(metric)) return answer('unavailable','Item-level figures for that metric are not available.');
  if(!ranking&&!metric) return answer('clarify','I can answer questions about your sales, fees, refunds, orders and item groups, or suggest questions based on observed findings.');
  if(allMonths.length>1) return answer('clarify','Choose one period for this question.');
  let period:DataChatPeriod;
  if(/\b(last|past) (3|three) months\b/.test(q)){if(!current)return answer('clarify','The analysis date is missing. Which months should I use?');period={kind:'three_months',months:[shiftMonth(current,-2),shiftMonth(current,-1),current]};}
  else if(allMonths.length) period={kind:'month',month:allMonths[0]};
  else if(/\b(all time|whole (?:supplied )?period|entire period|all records|all data)\b/.test(q)) period={kind:'whole'};
  else if(/\blatest (?:available )?complet(?:e|ed) month\b/.test(q)){if(!analysis||!current)return answer('clarify','The analysis date is missing. Which month should I use?');const latest=analysis.months.filter(x=>x.month<current||(x.month===current&&fixedMonthComplete(analysis))).at(-1);if(!latest)return answer('clarify','No completed month is available. Which period should I use?',['This month','All data']);period={kind:'month',month:latest.month};}
  else if(/\b(month|months|recent|latest)\b/.test(q)) return answer('clarify','Which period should I use?',['Last month','This month','Last 3 months','All data']);
  else {if(!analysis||!current)return answer('clarify','Which period should I use?',['Last month','This month','Last 3 months','All data']);const latest=analysis.months.filter(x=>x.month<current||(x.month===current&&fixedMonthComplete(analysis))).at(-1);if(!latest)return answer('clarify','No completed month is available. Which period should I use?',['This month','All data']);period={kind:'month',month:latest.month};}
  return ranking?{kind:'rank_items',metric:metric as 'gross'|'orders'|'refunds',period}:{kind:'summary',metric:metric!,period};
}
function coverage(a:Analysis,period:DataChatPeriod):string[] {
  const c=[`Only ${a.currency} is included; other currencies are excluded.`, 'Results describe the supplied records, which may not cover the whole business.'];
  if(Object.keys(a.excludedCurrencies).length) c[0]+=` Excluded: ${Object.keys(a.excludedCurrencies).join(', ')}.`;
  const selected=period.kind==='month'?[period.month]:period.kind==='three_months'?period.months:a.months.map(m=>m.month);
  if(a.as_of && !fixedMonthComplete(a) && selected.includes(a.as_of.slice(0,7))) c.push(`The current month is partial as of ${a.as_of.slice(0,10)}; it is not comparable to a complete month without that qualification.`);
  return c;
}
export function answerDataChat(a:Analysis, input:string|DataChatPlan|unknown):DataChatAnswer {
  const parsed=typeof input==='string'?parseDataChatQuestion(input,a):input;
  if(typeof input==='string' && parsed && typeof parsed==='object' && 'status' in parsed) return parsed as DataChatAnswer;
  if(!isDataChatPlan(parsed)) return answer('unavailable','That request is not a supported read-only query.');
  const defaulted=typeof input==='string' && !/\b(month|months|all time|all data|all records|whole|entire|20\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(input);
  if(parsed.kind==='issues') {
    const ids=new Set([...a.ranked_leaks,...(a.risks||[])].map(x=>x.id));
    const relevant=merchantKnowledge.filter(x=>(x.id==='item_expectations'&&ids.has('refunds_one_item'))||(x.id==='repeat_purchase'&&ids.has('one_time_buyers')));
    if(!relevant.length)return {status:'unavailable',text:'No matching research prompts are supported by the observed findings. Delivery needs separate shipping or support records.',sources:['ranked_leaks','risks'],caveats:['Findings are signals to investigate, not proof of causes.']};
    return {status:'answer',text:relevant.map(x=>parsed.mode==='questions'?`${x.title}: ${x.customerQuestions.join(' ')}`:x.title).join('\n'),sources:['ranked_leaks',...relevant.flatMap(x=>x.sources.map(y=>y.url))],caveats:['These are hypotheses and optional questions, not established causes. Customer contact requires your own decision.']};
  }
  if(parsed.kind==='summary') {
    const chosenPeriod=parsed.period;
    const selected=chosenPeriod.kind==='whole'?a.months:chosenPeriod.kind==='month'?a.months.filter(m=>m.month===chosenPeriod.month):a.months.filter(m=>chosenPeriod.months.includes(m.month));
    const expected=parsed.period.kind==='whole'?a.months.length:parsed.period.kind==='month'?1:3;
    if(selected.length!==expected || !selected.length)return answer('unavailable','The requested period is not fully present in the supplied monthly analysis.');
    const key={gross:'cameIn',orders:'orders',refunds:'refunds',fees:'fees',kept:'kept'} as const;const values=selected.map(m=>m[key[parsed.metric]]);
    if(values.some(v=>typeof v!=='number'||!Number.isFinite(v)))return answer('unavailable','That metric is not available for the entire period.');
    const total=(values as number[]).reduce((x,y)=>x+y,0);const label=(defaulted?'latest available completed month, ':'')+selected.map(m=>m.month).join(', ');const caveats=coverage(a,parsed.period);
    if(parsed.metric==='kept')caveats.push('Kept excludes costs and fees that were not supplied or established; it is not necessarily profit.');
    if(parsed.metric==='refunds')caveats.push('Refunds, reversals and disputes are counted in their event month.');
    return {status:'answer',text:`${parsed.metric==='gross'?'Gross sales':parsed.metric} for ${label}: ${parsed.metric==='orders'?total:money(total,a.currency)}.`,sources:selected.map(m=>`months[${m.month}].${key[parsed.metric]}`),caveats};
  }
  if(parsed.kind==='rank_items') {
    let items:ItemGroupSummary[]; let source:string; let label:string;
    if(parsed.period.kind==='whole'){items=a.item_groups;source='item_groups';label=`${a.period.start} through ${a.period.end}`;}
    else if(parsed.period.kind==='month'){const selectedMonth=parsed.period.month;const m=a.item_groups_by_period?.months.find(x=>x.month===selectedMonth);if(!m)return answer('unavailable','That month is not available in the supplied item breakdown.');items=m.items;source=`item_groups_by_period.months[${selectedMonth}].items`;label=(defaulted?'latest available completed month, ':'')+selectedMonth;}
    else {const selected=parsed.period.months;const groups=selected.map(month=>a.item_groups_by_period?.months.find(x=>x.month===month));if(groups.some(x=>!x))return answer('unavailable','The requested three months are not fully present in the item breakdown.');const combined=new Map<string,ItemGroupSummary>();for(const group of groups)for(const item of group!.items){const old=combined.get(item.name)||{name:item.name,gross:0,orders:0,refunds:0};combined.set(item.name,{name:item.name,gross:Math.round((old.gross+item.gross)*100)/100,orders:old.orders+item.orders,refunds:Math.round((old.refunds+item.refunds)*100)/100});}items=[...combined.values()];source='item_groups_by_period.months';label=selected.join(', ');}
    const sorted=items.filter(x=>Number.isFinite(x[parsed.metric])&&x[parsed.metric]>0).sort((x,y)=>y[parsed.metric]-x[parsed.metric]||x.name.localeCompare(y.name));
    if(!sorted.length)return {status:'unavailable',text:`No ${parsed.metric==='refunds'?'refunded amount':'positive item activity'} is recorded for ${label}.`,sources:[source],caveats:coverage(a,parsed.period)};
    const highest=sorted[0][parsed.metric], tied=sorted.filter(x=>x[parsed.metric]===highest), names=tied.map(x=>x.name).join(', ');
    const measure=parsed.metric==='orders'?`${highest} order rows`:money(highest,a.currency);
    const desc=parsed.metric==='gross'?'gross sales':parsed.metric==='orders'?'orders':'refunds and reversals';
    const caveats=coverage(a,parsed.period);
    if(items.some(x=>x.name==='Unlabelled items' && x[parsed.metric]>0))caveats.push('Unlabelled items are a combined group, so individual product rankings may be incomplete.');
    if(parsed.metric==='refunds')caveats.push('Refunds, reversals and disputes are recorded in their event month and can relate to earlier sales; this is an amount, not a refund rate.');
    if(parsed.metric==='orders')caveats.push('One eligible sale row counts as one order; this is not units sold.');
    return {status:'answer',text:`${tied.length>1?'Joint highest':'Highest'} ${desc} for ${label}: ${names} — ${measure}.`,sources:[source,'currency','period','excludedCurrencies'],caveats};
  }
  const [first,second]=parsed.months;const x=a.months.find(m=>m.month===first),y=a.months.find(m=>m.month===second);
  if(!x||!y)return answer('unavailable','Both calendar months must be present in the supplied analysis.');
  const key={gross:'cameIn',orders:'orders',refunds:'refunds',fees:'fees',kept:'kept'} as const; const v=x[key[parsed.metric]],w=y[key[parsed.metric]];
  if(typeof v!=='number'||typeof w!=='number'||!Number.isFinite(v)||!Number.isFinite(w))return answer('unavailable','That metric is not available for both months.');
  const fmt=(n:number)=>parsed.metric==='orders'?String(n):money(n,a.currency);const delta=Math.round((w-v)*100)/100;
  const caveats=coverage(a,{kind:'month',month:first}).concat(coverage(a,{kind:'month',month:second}).filter(s=>s.startsWith('The current month')));
  if(parsed.metric==='refunds')caveats.push('Refunds, reversals and disputes are counted in their event month, not necessarily their original sale month.');
  if(parsed.metric==='kept'||parsed.metric==='fees')caveats.push('Fees or costs may be missing; kept is not necessarily profit.');
  return {status:'answer',text:`${parsed.metric==='gross'?'Gross sales':parsed.metric}: ${first} ${fmt(v)}; ${second} ${fmt(w)}. Change: ${delta>0?'+':''}${fmt(delta)}.`,sources:[`months[${first}].${key[parsed.metric]}`,`months[${second}].${key[parsed.metric]}`,'currency','excludedCurrencies'],caveats:[...new Set(caveats)]};
}
