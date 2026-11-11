import {money,sentenceCaseItem} from './display';
export function smallOrderCopy(currency:string,e:Record<string,unknown>){const items=[1,2,3].flatMap(i=>typeof e[`small_item_${i}`]==='string'&&typeof e[`small_price_${i}`]==='number'?[{name:sentenceCaseItem(String(e[`small_item_${i}`])),price:Number(e[`small_price_${i}`])}]:[]), exact=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency,minimumFractionDigits:2,maximumFractionDigits:2}).format(n), one=money(1,currency),ten=money(10,currency),small=Number(e.small_orders||0),total=Number(e.orders||0),months=Number(e.months||0),hasRest=total>small;return {line:items.length?`Add ${money(1,currency).replace(/\.00$/,'')} to your ${items.length} cheapest ${items.length===1?'item':'items'}, if buyers still buy.`:typeof e.annual_sales==='number'?`If you charge ${one} more on orders under ${ten} and buyers still buy.`:'If eligible payments use the lower fee.',why:hasRest?`PayPal's fees took ${Number(e.small_fee_rate||0)}% of these orders and ${Number(e.rest_fee_rate||0)}% of the rest.`:`PayPal fees are ${Number(e.small_fee_rate||0)}% of these orders; there are no larger orders to compare.`,title:items.length?(items.length===1?'Raise this one for 30 days':`Raise these ${items.length===3?'three':'two'} for 30 days`):'Try a small-order change',steps:items.length?items.map(x=>`${x.name}: ${exact(x.price)} → ${exact(x.price+1)}`):['Find your three cheapest items.',`Consider ${one} more or a two-pack.`,'Record orders and after-fee money for the same selected items over 30 days.'],metric:'Look for higher after-fee money from those same items, alongside order counts, compared with the previous 30 days if available.',marker:`${one} on small orders`}}
export function bestMonthCopy(currency:string,e:Record<string,unknown>){const month=new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${String(e.month||'2000-01')}-01T00:00:00Z`));return {line:`${month} brought ${money(Number(e.best_sales||0),currency)}, compared with your usual ${money(Number(e.usual_sales||0),currency)}.`,why:'One strong month may be a one-off.'}}

export function resultFindingVisible(leak:import('./types').Leak){
 const amount=Math.abs(leak.money_per_month||0),period=leak.card?.money.period||leak.evidence.card_period;
 return period==='now'?true:period==='year'?amount>=120:amount>=10;
}
export function hasInlineTest(leak:import('./types').Leak,analysis:import('./types').Analysis){
 if(leak.id==='fewer_new_buyers')return Number.isFinite(leak.evidence.recent_new)&&Number.isFinite(leak.evidence.previous_new)&&!!(leak.evidence.best_seller||analysis.item_groups.find(x=>x.name!=='Unlabelled items'));
 return ['small_order_fees','items_stopped','item_jumped','best_month','refunds_one_item'].includes(leak.id);
}
export function fewerNewBuyersTest(leak:import('./types').Leak,analysis:import('./types').Analysis){
 const name=sentenceCaseItem(String(leak.evidence.best_seller||analysis.item_groups.find(x=>x.name!=='Unlabelled items')?.name||''));if(!name)return undefined;const item=`your ${name.toLowerCase()}`;
 const lately=Math.round(Number(leak.evidence.recent_new)/3),aim=Math.max(Math.round(Number(leak.evidence.previous_new)/3),lately+1);
 return {why:"Put your best seller in front of people who haven't bought yet.",title:`Show ${item} somewhere new`,steps:[`List or post ${item} in one place you don't sell yet: another marketplace, a local group, or a social post.`,"Add a line to every parcel this month: 'Know someone who'd like this? Send them this link.'",'Change nothing else for 30 days.'],metric:`how many new buyers came in those 30 days? Lately ${lately===0?'fewer than 1':`about ${lately}`} a month; aim for ${aim}.`};
}

/** Suppress the generic set finding only when its specific bundle card is visible. */
export function visibleResultLeaks(leaks:import('./types').Leak[],showBundle:boolean){return leaks.filter(leak=>!showBundle||leak.id!=='sets')}
