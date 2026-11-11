import {singularItem} from './cost-interview';
export const chatSuggestions=[
 {label:'Best seller',question:'Most popular product'},
 {label:'Refunds last month',question:'Which product has the most refunds in the latest completed month?'},
 {label:'Sales last month',question:'How much did I make in the latest completed month?'},
 {label:'This month vs last',question:'Compare sales last month vs this month'},
 {label:'What to ask buyers',question:'What should I ask customers?'},
] as const;
export function keepSuggestion(item:string){const name=singularItem(item.toLowerCase()),article=/^[aeiou]/.test(name)?'an':'a';const question=`What do I keep on ${article} ${name} order?`;return {label:question,question}}
