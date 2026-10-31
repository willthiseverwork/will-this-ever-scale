import { getWorkspace,storageConfigured } from './workspace-store';
import { questionsFor } from './playbook';
import { analyze } from './engine';
import { demoTransactions,DEMO_AS_OF } from './demo';

type SecurityScheme={type:string;scopes?:string[]};
const noauth:SecurityScheme[]=[{type:'noauth'}], oauth:SecurityScheme[]=[{type:'oauth2',scopes:[]}];
const schema=(properties:Record<string,unknown>={},required:string[]=[])=>({type:'object',properties,required,additionalProperties:false});
const tool=(name:string,description:string,inputSchema:unknown,auth:SecurityScheme[]=oauth)=>({name,description,inputSchema,annotations:{readOnlyHint:true,destructiveHint:false,openWorldHint:false},securitySchemes:auth,_meta:{securitySchemes:auth}});
export function mcpTools(scope?:string){const auth=[{type:'oauth2',scopes:scope?[scope]:[]}];return [
 tool('demo_summary','Read a clearly labelled synthetic sample shop. No account or live PayPal data.',schema(),noauth),
 tool('current_summary','Read the latest saved workspace snapshot with its source, period and limitations.',schema(),auth),
 tool('rank_products','Rank products from the latest saved snapshot; names appear only with explicit sharing consent.',schema({metric:{type:'string',enum:['gross','orders','refunds']}},['metric']),auth),
 tool('compare_periods','Compare two months from the latest saved snapshot.',schema({metric:{type:'string',enum:['gross','orders','refunds','fees','kept']},first:{type:'string',pattern:'^\\d{4}-(0[1-9]|1[0-2])$'},second:{type:'string',pattern:'^\\d{4}-(0[1-9]|1[0-2])$'}},['metric','first','second']),auth),
 tool('list_reminders','List saved workspace reminders; does not send or change them.',schema(),auth),
 tool('issue_playbook','Get general diagnostic questions for an issue; no account-specific recommendation is inferred.',schema({issue:{type:'string',enum:['one_time_buyers','unpaid_invoices','refunds_one_item','small_order_fees','one_item_dependence','below_cost_items','fewer_new_buyers','subscription_failed_payments','sets','held_money']}},['issue']),auth)
 ];}
export function projectProduct(item:{id:string;gross:number;orders:number;refunds:number;label?:string;labelReviewed?:boolean},share:boolean){return {id:item.id,gross:item.gross,orders:item.orders,refunds:item.refunds,...(share && item.labelReviewed===true && item.label?{label:item.label}:{})};}
const month=/^\d{4}-(0[1-9]|1[0-2])$/;
function checkArgs(v:unknown, keys:string[]):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==[...keys].sort().join())throw new Error('Invalid tool arguments.');return v as Record<string,unknown>;}
export async function callMcpTool(name:string,args:unknown,subject?:string):Promise<unknown>{
 if(name==='demo_summary'){checkArgs(args,[]);const a=analyze(demoTransactions(),{asOf:DEMO_AS_OF});return {source:'synthetic demo',asOf:DEMO_AS_OF,period:a.period,currency:a.currency,money:a.money_map,caveats:['Synthetic sample, not a customer or live PayPal account.','Results cover supplied records only; missing costs and ad spend may affect kept.']};}
 if(!subject)throw new Error('Authentication required.'); if(!storageConfigured())throw new Error('Workspace storage is not configured.');
 const w=await getWorkspace(subject);
 if(w.settings.shareWorkspaceWithAssistant!==true)throw new Error('Assistant workspace sharing is disabled.');
 if(name==='list_reminders'){checkArgs(args,[]);return {source:'saved workspace',reminders:w.reminders,caveats:['Reminders are records only; this tool does not send notifications.']};}
 if(name==='issue_playbook'){const a=checkArgs(args,['issue']);if(typeof a.issue!=='string'||!['one_time_buyers','unpaid_invoices','refunds_one_item','small_order_fees','one_item_dependence','below_cost_items','fewer_new_buyers','subscription_failed_payments','sets','held_money'].includes(a.issue))throw new Error('Invalid issue.');try{return {source:'general WTES playbook',issue:a.issue,questions:questionsFor(a.issue),caveats:['General diagnostic questions; not evidence that this issue exists in your data.']};}catch{return {status:'unavailable',source:'general WTES playbook',caveats:['No questions are available for that issue.']};}}
 const s=[...w.snapshots].sort((a,b)=>b.capturedAt.localeCompare(a.capturedAt))[0];if(!s)return {status:'unavailable',source:'saved workspace',caveats:['No saved snapshots are available.']};
 const gapText={item_costs_missing:'Some item costs were not supplied.',ad_spend_missing:'Ad spend was not supplied.',separate_fees_excluded:'Separate fee rows were excluded.',other_currencies_excluded:'Other currencies were excluded.',date_coverage_unknown:'Exact export coverage within the observed months is unknown.'} as const;
 const coverage={source:s.source,capturedAt:s.capturedAt,period:{start:s.periodStart.slice(0,7),end:s.periodEnd.slice(0,7),precision:'month'},currency:s.currency,coverageGaps:s.coverageGaps,caveats:['Saved snapshot, not a live refresh. Coverage is limited to supplied records; exact coverage dates within each month are unknown.',...s.coverageGaps.map(g=>gapText[g])]};
 if(name==='current_summary'){checkArgs(args,[]);return {...coverage,money:{gross:s.cameIn,fees:s.fees,refunds:s.refunds,costs:s.costs,adSpend:s.adSpend,kept:s.kept}};}
 if(name==='rank_products'){const a=checkArgs(args,['metric']);if(!['gross','orders','refunds'].includes(String(a.metric)))throw new Error('Invalid metric.');const k=a.metric as 'gross'|'orders'|'refunds';return {...coverage,metric:k,items:[...s.items].sort((x,y)=>y[k]-x[k]||x.id.localeCompare(y.id)).map(item=>projectProduct(item,w.settings.shareProductNamesWithAssistant===true)),caveats:[...coverage.caveats,'Product names are included only when sharing is enabled; order rows are not units.']};}
 if(name==='compare_periods'){const a=checkArgs(args,['metric','first','second']);if(!['gross','orders','refunds','fees','kept'].includes(String(a.metric))||typeof a.first!=='string'||typeof a.second!=='string'||!month.test(a.first)||!month.test(a.second)||a.first===a.second)throw new Error('Invalid comparison.');const x=s.months.find(m=>m.month===a.first),y=s.months.find(m=>m.month===a.second),key={gross:'cameIn',orders:'orders',refunds:'refunds',fees:'fees',kept:'kept'}[String(a.metric)] as 'cameIn'|'orders'|'refunds'|'fees'|'kept';if(!x||!y||x[key]===undefined||y[key]===undefined)return {...coverage,status:'unavailable',reason:'Both months and metric must be present.'};return {...coverage,metric:a.metric,first:{month:x.month,value:x[key]},second:{month:y.month,value:y[key]},caveats:[...coverage.caveats,'Partial months may not be comparable; refunds reflect their event month.']};}
 throw new Error('Unknown tool.');
}
