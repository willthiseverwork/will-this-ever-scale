import type {Leak} from './types';
/** One amount, horizon and condition for every view of a finding. */
export function findingPresentation(leak:Leak){
 const e=leak.evidence,n=(key:string)=>Number(e[key]||0);
 if(leak.id==='one_time_buyers'){
  const once=n('once_buyers'),back=n('people_back'),avg=n('average_order'),months=n('months'),small=back<3;
  const period=small||months>=12?'a year in sales':'more in sales';
  const condition=small?(once===1?'If that identified buyer comes back every month, before costs.':`If 1 of the ${once} identified buyers who bought once comes back every month, before costs.`):`If ${back} of the ${once} identified buyers who bought once ${back===1?'places':'place'} one more average order${months>=12?' in a year':''}, before costs.`;
  return {amount:small?12*avg:back*avg,period,condition};
 }
 if(leak.id==='item_jumped')return {amount:n('last_90'),period:'in the latest 90 days',condition:leak.method};
 if(leak.id==='best_month')return {amount:n('best_sales'),period:'in the best month',condition:leak.method};
 const period=leak.card?.money.period||e.card_period;
 return {amount:leak.kind==='quick_win'?leak.one_off_amount||0:leak.money_per_month||0,period:period==='year'?'a year':period==='now'?(leak.id==='lapsed_buyers'?'from one more order each':'now'):'a month',condition:leak.method};
}
