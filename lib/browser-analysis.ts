import type {Analysis,Inputs} from './types';
import {clearCostDrafts} from './cost-draft';
import {workspaceProductLabel,type WorkspaceInput} from './workspace-types';
import {analyze} from './engine';
import {demoTransactions,DEMO_AS_OF} from './demo';
import type {Txn} from './types';
import {fallbackProductGrouping,productGroupRequestSchema,validateProductGrouping,type ProductGrouping} from './product-groups';
export type BrowserRead={analysis:Analysis;source:'demo'|'csv'|'sandbox';sandboxMode?:'demo'|'connected'|'login';inputs:Inputs;answers:Record<string,string>};
export const BROWSER_READ_KEY='wtes-approved-ui-v2';
// Raw rows (and any buyer keys) remain in this browser tab's session storage and never enter a request.
let chatRows:Txn[]=[];
const BROWSER_ROWS_KEY='wtes-browser-rows-v1';
/** Raw rows remain in this browser tab only, so client-route boundaries cannot erase chat context. */
export function setBrowserChatRows(rows:Txn[]){chatRows=rows;try{sessionStorage.setItem(BROWSER_ROWS_KEY,JSON.stringify(rows));}catch{}}
export function clearBrowserAnalysis(){chatRows=[];try{sessionStorage.removeItem(BROWSER_READ_KEY);sessionStorage.removeItem(BROWSER_ROWS_KEY);sessionStorage.removeItem('wtes-report-preview-real-v1');clearCostDrafts(sessionStorage);}catch{}}
export function getBrowserChatRows(){if(chatRows.length)return chatRows;try{const parsed=JSON.parse(sessionStorage.getItem(BROWSER_ROWS_KEY)||'[]');if(Array.isArray(parsed)){chatRows=parsed as Txn[];return chatRows;}}catch{}return [];}
export function readBrowserAnalysis():BrowserRead|null {try{const value=JSON.parse(sessionStorage.getItem(BROWSER_READ_KEY)||'null') as BrowserRead|null;return value && ['demo','csv','sandbox'].includes(value.source) && value.analysis && Array.isArray(value.analysis.months)?value:null;}catch{return null;}}
function uniqueItems(rows:Txn[]){const orders=new Map<string,number>();for(const row of rows){const title=row.item_title?.trim();if(title)orders.set(title,(orders.get(title)||0)+(['sale','invoice_payment','subscription_payment'].includes(row.kind)&&row.gross>0?1:0));}return [...orders].map(([title,orders])=>({title,orders})).sort((a,b)=>a.title.localeCompare(b.title));}
function applyGrouping(rows:Txn[],grouping:ProductGrouping){const names=new Map<string,string>();for(const group of grouping.groups)for(const title of group.titles)names.set(title,group.name);return rows.map(row=>row.item_title&&names.has(row.item_title)?{...row,item_group:names.get(row.item_title)}:{...row});}
/** One protected grouping request per newly read data set; raw rows remain browser-only. */
/** Deterministic grouping for the bundled fictional sample; makes no network request. */
export function groupLocalRows(rows:Txn[]){const grouping=fallbackProductGrouping(uniqueItems(rows));return {rows:applyGrouping(rows,grouping),grouping};}
export async function groupBrowserRows(rows:Txn[]):Promise<{rows:Txn[];grouping:ProductGrouping}>{const items=uniqueItems(rows),fallback=fallbackProductGrouping(items);if(!items.length)return {rows,grouping:fallback};try{if(!productGroupRequestSchema.safeParse({items}).success||new TextEncoder().encode(JSON.stringify({items})).byteLength>12000)throw new Error('too large');const response=await fetch('/api/product-groups',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items})});if(!response.ok)throw new Error('unavailable');const payload=await response.json();if(!payload||payload.source!=='ai')throw new Error('invalid');const {source: _source,...candidate}=payload;const grouping=validateProductGrouping(candidate,items);if(!grouping)throw new Error('invalid');return {rows:applyGrouping(rows,grouping),grouping};}catch{return {rows:applyGrouping(rows,fallback),grouping:fallback};}}
const REAL_BACKUP_KEY='wtes-report-preview-real-v1';
export function clearReportPreviewBackup(){try{sessionStorage.removeItem(REAL_BACKUP_KEY)}catch{}}
export function hasRealTabBackup(){return !!sessionStorage.getItem(REAL_BACKUP_KEY)}
export async function leaveBrowserDemo(fetcher:typeof fetch=fetch):Promise<boolean>{try{const raw=sessionStorage.getItem(REAL_BACKUP_KEY);if(!raw)return false;const saved=JSON.parse(raw),read=JSON.parse(saved.read) as BrowserRead&{uploads?:Array<{id:string;uploadedAt:string;rows:number}>;shopKey?:string};if(!read||!['csv','sandbox'].includes(read.source)||!read.analysis||!Array.isArray(read.analysis.months)||!Array.isArray(saved.rows)||!saved.rows.every((row:Txn)=>row&&typeof row.date==='string'&&typeof row.gross==='number'))return false;if(read.uploads!==undefined&&(!Array.isArray(read.uploads)||read.uploads.some(u=>!u||typeof u.id!=='string'||typeof u.uploadedAt!=='string'||!Number.isFinite(Date.parse(u.uploadedAt))||!Number.isSafeInteger(u.rows)||u.rows<0)))return false;const ids=Array.isArray(read.uploads)?read.uploads.map(u=>u.id):[],owned=read.source==='sandbox'||read.shopKey==='csv-account'||ids.length>0;if(owned){if(!ids.length||ids.some(id=>typeof id!=='string'))return false;const [account,uploads]=await Promise.all(['/api/account','/api/uploads'].map(url=>fetcher(url,{cache:'no-store'})));if(!account.ok||!uploads.ok)return false;const [a,u]=await Promise.all([account.json(),uploads.json()]),source=read.source==='csv'?'seller_file':'sandbox';if(!a.authenticated||a.deletionPending||!Array.isArray(u.uploads)||ids.some(id=>!u.uploads.some((upload:{id:string;source?:string})=>upload.id===id&&(!upload.source||upload.source===source))))return false;}sessionStorage.setItem(BROWSER_READ_KEY,saved.read);setBrowserChatRows(saved.rows);sessionStorage.removeItem(REAL_BACKUP_KEY);return true}catch{return false}}
export function startBrowserDemo():BrowserRead {const previous=sessionStorage.getItem(BROWSER_READ_KEY);if(previous){const old=JSON.parse(previous) as BrowserRead;if(old.source!=='demo')sessionStorage.setItem(REAL_BACKUP_KEY,JSON.stringify({read:previous,rows:getBrowserChatRows()}))}const inputs={asOf:DEMO_AS_OF,fixedFee:.49,homeCountry:'US'},grouped=groupLocalRows(demoTransactions());setBrowserChatRows(grouped.rows);const read:BrowserRead={analysis:{...analyze(grouped.rows,inputs),product_grouping:grouped.grouping},source:'demo',inputs,answers:{}};sessionStorage.setItem(BROWSER_READ_KEY,JSON.stringify(read));return read;}
export type ReviewedLabels={confirmed:true;labels:Record<string,string>};
export function snapshotForSave(read:BrowserRead, review?:ReviewedLabels):WorkspaceInput['snapshots'][number] {
 if(read.source!=='csv') throw new Error('Only a CSV analysis can be saved here.');
 const a=read.analysis;if(a.months.length>120||a.item_groups.length>200)throw new Error('This summary exceeds workspace limits: at most 120 months and 200 item groups.');
 const monthEnd=new Date(Date.UTC(Number(a.period.end.slice(0,4)),Number(a.period.end.slice(5,7)),0)).toISOString().slice(0,10);const end=a.as_of?.slice(0,7)===a.period.end?a.as_of.slice(0,10):monthEnd;
 if(review && review.confirmed!==true)throw new Error('Review product labels before saving.');
 const validIds=new Set(a.item_groups.map((_,i)=>`item_${i+1}`));
 if(review&&Object.keys(review.labels).some(id=>!validIds.has(id)))throw new Error('A product label does not match this analysis.');
 const items=a.item_groups.map((item,index)=>{const id=`item_${index+1}`,label=review?.labels[id]?.trim();if(!label)return {id,gross:item.gross,orders:item.orders,refunds:item.refunds};const valid=workspaceProductLabel.safeParse(label);if(!valid.success)throw new Error(`Review ${id}: use a product name under 120 characters without an email, URL or phone number.`);return {id,label:valid.data,labelReviewed:true as const,gross:item.gross,orders:item.orders,refunds:item.refunds};});
 // Whole-period totals must match the period and item groups. Some display adapters replace money_map with a single month.
 const sum=(key:'cameIn'|'fees'|'refunds'|'costs'|'ads'|'kept')=>Math.round(a.months.reduce((n,m)=>n+m[key],0)*100)/100;
 const whole=a.period_summaries?.whole?.money_map;
 const coverageGaps:WorkspaceInput['snapshots'][number]['coverageGaps']=['date_coverage_unknown'];
 if((read.inputs.costPerItem===undefined&&!read.inputs.costsByItem)||a.gaps?.some(x=>/item costs? (?:were )?not supplied|item costs are missing|some item costs/i.test(x)))coverageGaps.push('item_costs_missing');
 if(read.inputs.monthlyAdSpend===undefined||a.gaps?.some(x=>/ad spend (?:was )?not supplied/i.test(x)))coverageGaps.push('ad_spend_missing');
 if(a.gaps?.some(x=>/separate fee rows/i.test(x)))coverageGaps.push('separate_fees_excluded');
 if(Object.keys(a.excludedCurrencies).length)coverageGaps.push('other_currencies_excluded');
 return {id:crypto.randomUUID(),capturedAt:new Date().toISOString(),currency:a.currency,periodStart:`${a.period.start}-01`,periodEnd:end,source:'csv',periodPrecision:'month',coverageGaps,months:a.months.map(m=>({month:m.month,cameIn:m.cameIn,fees:m.fees,refunds:m.refunds,costs:m.costs,ads:m.ads,kept:m.kept,...(m.orders===undefined?{}:{orders:m.orders})})),items,cameIn:whole?.came_in??sum('cameIn'),fees:whole?.paypal_fees??sum('fees'),refunds:whole?.refunds??sum('refunds'),costs:whole?.costs??sum('costs'),adSpend:whole?.ad_spend??sum('ads'),kept:whole?.kept??sum('kept')};
}
