export const chatSuggestions=[
 {label:'Best seller',question:'Most popular product'},
 {label:'Refunds last month',question:'Which product has the most refunds in the latest completed month?'},
 {label:'Sales last month',question:'How much did I make in the latest completed month?'},
 {label:'This month vs last',question:'Compare sales last month vs this month'},
 {label:'What to ask buyers',question:'What should I ask customers?'},
] as const;
export function keepSuggestion(item:string){return {label:`What do I keep on ${item}?`,question:`What do I keep on ${item}?`}}
