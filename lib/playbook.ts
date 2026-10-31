import raw from '../playbook.json';
export type Answers=Record<string,string>;
type Context=Record<string,string|number>;
type Question={id:string;text:string;answers:{id:string;text:string}[]};
type Test={when?:Record<string,string[]>;do:string;success:string;target_rule:string;can_hand_off:boolean};
type Entry={id:string;questions:Question[];tests:Test[];who:string};
const entries=raw.leaks as Entry[];
function entry(id:string):Entry { const found=entries.find(x=>x.id===id); if(!found) throw new Error('That leak is not in the playbook.'); return found; }
export function questionsFor(leakId:string) { return entry(leakId).questions; }
export function testTemplateFor(leakId:string,answers:Answers) {
  const leak=entry(leakId); const keys=Object.keys(answers);
  if(keys.length!==leak.questions.length || leak.questions.some(q=>!q.answers.some(a=>a.id===answers[q.id])) || keys.some(k=>!leak.questions.some(q=>q.id===k))) throw new Error('Answer every question using one of the listed options.');
  const matches=leak.tests.filter(t=>!t.when||Object.entries(t.when).every(([k,values])=>values.includes(answers[k])));
  if(matches.length!==1) throw new Error('No unique playbook test matches these answers.');
  return matches[0];
}
function numeric(c:Context,key:string):number { const v=c[key]; if(typeof v!=='number'||!Number.isFinite(v)||v<0) throw new Error(`Missing or invalid engine value: ${key}.`); return v; }
/** Call locally with engine evidence; never let a model choose a playbook branch or target. */
export function testFor(leakId:string,answers:Answers,context:Context) {
  const leak=entry(leakId); const selected=testTemplateFor(leakId,answers); const values:Context={...context};
  switch(leakId) {
    case 'one_time_buyers': if(answers.reach!=='none') { const base=Math.max(1,Math.round(numeric(context,'past_buyers')*.03)); values.target_orders=answers.reach==='some'?Math.max(1,Math.ceil(base/2)):base; } break;
    case 'unpaid_invoices': values.target_paid=Math.ceil(numeric(context,'n_unpaid')*.5); break;
    case 'refunds_one_item': if(['size','photos'].includes(answers.reason)) { if(context.refund_rate===undefined) throw new Error('A refund rate for this item is unavailable: the data does not reliably link refunds to the original orders. Choose another answer only if it is true for your business.'); values.target_rate=numeric(context,'refund_rate')/2; } break;
    case 'small_order_fees': values.target_share=numeric(context,'small_share')/2; break;
    case 'one_item_dependence': values.target_share=Math.max(0,numeric(context,'current_share')-10); break;
    case 'fewer_new_buyers': if(answers.source!=='unknown') values.target_new=Math.ceil(numeric(context,'last_new')*1.1); break;
    case 'subscription_failed_payments': values.target=Math.ceil(numeric(context,'n_failed')*.3); break;
  }
  const fill=(s:string)=>s.replace(/\{(\w+)\}/g,(_,k:string,offset:number)=>{const v=values[k]; if(v===undefined || (typeof v==='number'&&!Number.isFinite(v)) || (typeof v==='string'&&!v.trim())) throw new Error(`Missing engine value: ${k}.`); const text=String(v),prefix=s.slice(0,offset).trimEnd(); return ['item','top_group'].includes(k)&&prefix&&!/[.!?]$/.test(prefix)?text[0].toLocaleLowerCase()+text.slice(1):text;});
  return {leakId,answerIds:leak.questions.map(question=>answers[question.id]),do:fill(selected.do),success:fill(selected.success),template:selected.do,values,numbers:Object.fromEntries(Object.entries(values).filter(([,v])=>typeof v==='number')) as Record<string,number>,who:leak.who,can_hand_off:selected.can_hand_off};
}

/** Project only evidenced values; missing facts stay missing, and testFor reports them. */
export function contextFor(a:import('./types').Analysis, leakId:string):Context {
  const leak=[...a.ranked_leaks,...(a.risks||[]),...(a.action_findings||[]),...(a.quick_win?[a.quick_win]:[])].find(l=>l.id===leakId);
  if(!leak) throw new Error('This finding is not present in the analysis.');
  const e=leak.evidence,c:Context={};
  const copy=(from:string,to=from)=>{const value=e[from];if(typeof value==='string'||typeof value==='number')c[to]=value;};
  if(a.item_groups[0]?.name && a.item_groups[0].name!=='Unlabelled items') c.top_group=a.item_groups[0].name;
  switch(leakId){
    case 'one_time_buyers': copy('past_buyers');copy('month_buyers');break;
    case 'unpaid_invoices': copy('invoices','n_unpaid');copy('unpaid_total');break;
    case 'refunds_one_item': copy('item');copy('refund_rate');break;
    case 'small_order_fees': copy('threshold');copy('small_group');if(typeof e.small_orders==='number'&&typeof e.orders==='number'&&e.orders>0)c.small_share=Math.round(e.small_orders/e.orders*10000)/100;break;
    case 'one_item_dependence':copy('top_group');copy('share','current_share');break;
    case 'below_cost_items':copy('item');break;
    case 'fewer_new_buyers':copy('last_new');break;
    case 'subscription_failed_payments':copy('n_failed');break;
  }
  return c;
}
