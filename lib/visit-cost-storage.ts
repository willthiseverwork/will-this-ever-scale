import type {CostAnswers,SellerKind} from './cost-interview';
import type {visitCost} from './visit-cost';

type Scope={source:'demo'|'csv'|'sandbox';sandboxMode?:'demo'|'connected'|'login';shopKey?:string};
export type VisitCostEntry={item:string;raw:string;currency:string;kind:SellerKind;answers:CostAnswers;value:Extract<ReturnType<typeof visitCost>,{status:'available'}>};
export function visitCostKey(scope:Scope){const shop=scope.sandboxMode==='demo'?'paypal-demo':scope.shopKey;if(!shop)return null;return `wtes_visit_cost_v1:${scope.source}:${encodeURIComponent(shop)}`}
export function readVisitCosts(storage:Pick<Storage,'getItem'>,scope:Scope):VisitCostEntry[]{try{const key=visitCostKey(scope);if(!key)return [];const parsed=JSON.parse(storage.getItem(key)||'[]');return Array.isArray(parsed)?parsed.filter(x=>x&&typeof x.item==='string'&&typeof x.raw==='string'&&typeof x.currency==='string'&&x.value?.status==='available'&&x.answers):[]}catch{return []}}
export function writeVisitCost(storage:Pick<Storage,'getItem'|'setItem'>,scope:Scope,entry:VisitCostEntry){const key=visitCostKey(scope);if(!key)return false;try{const previous=readVisitCosts(storage,scope).filter(x=>x.item!==entry.item);storage.setItem(key,JSON.stringify([...previous,entry]));return true}catch{return false}}
export function removeVisitCost(storage:Pick<Storage,'getItem'|'setItem'>,scope:Scope,item:string){const key=visitCostKey(scope);if(!key)return;try{storage.setItem(key,JSON.stringify(readVisitCosts(storage,scope).filter(x=>x.item!==item)))}catch{}}
/** Match the named product group in a plain-language keep question. */
export function keepQuestionItem(question:string,groups:Array<{name:string}>){if(!/\b(keep|kept|profit|left|remain|margin|earnings)\b/i.test(question))return undefined;const normalize=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().split(' ').map(w=>w.length>3&&w.endsWith('s')?w.slice(0,-1):w).join(' ');const q=` ${normalize(question)} `;return groups.find(g=>{const name=normalize(g.name);return name.length>=3&&q.includes(` ${name} `)})}
