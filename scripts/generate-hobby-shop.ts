/**
 * Deterministic, fully synthetic hobby-shop fixtures. Fees are estimates only:
 * UK: https://www.paypal.com/uk/webapps/mpp/merchant-fees
 * US: https://www.paypal.com/us/business/paypal-business-fees
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {analyze} from '../lib/engine';
import type {Txn} from '../lib/types';

type Preset='jewellery-maker'|'candle-maker'|'stationery-reseller'|'vintage-clothes-reseller'|'ceramics-tiny'|'toys-3-months';
type Config={orders:number;currency:string;start:string;items:Array<[string,number,number]>;repeat:number;peak?:number};
const configs:Record<Preset,Config>={
 'jewellery-maker':{orders:180,currency:'GBP',start:'2025-11-01',items:[['Silver earrings',8,22],['Initial necklace',18,45],['Stacking ring',14,32],['Gift pouch',3,5]],repeat:.16,peak:11},
 'candle-maker':{orders:90,currency:'GBP',start:'2025-11-01',items:[['Soy candle',10,28],['Candle refill',6,14],['Gift box',4,7]],repeat:.22,peak:12},
 'stationery-reseller':{orders:260,currency:'GBP',start:'2025-11-01',items:[['Vintage bead notebook',8,25],['Set of 3 notebooks in parcel',14,24],['Pencil',2,5],['Sticker sheet',3,6]],repeat:.12,peak:11},
 'vintage-clothes-reseller':{orders:60,currency:'USD',start:'2025-11-01',items:[['Vintage dress',28,70],['Denim jacket',25,60],['Scarf',12,22]],repeat:.08,peak:12},
 'ceramics-tiny':{orders:15,currency:'GBP',start:'2025-11-01',items:[['Mug',18,32],['Ceramic bowl',28,60]],repeat:.15,peak:12},
 'toys-3-months':{orders:25,currency:'GBP',start:'2026-08-01',items:[['Wooden toy',12,35],['Sticker pack',5,8],['Gift wrap',2,4]],repeat:.18,peak:10},
};
const allCards=['one_time_buyers','small_order_fees','lapsed_buyers','items_stopped','item_jumped','best_month','refunds_one_item','sets','best_sellers','cross_border_fees','one_item_dependence','below_cost_items','fewer_new_buyers','subscription_failed_payments','held_money','unpaid_invoices'];
const quote=(v:unknown)=>{const s=String(v??'');return /[",\r\n]/.test(s)?`"${s.replaceAll('"','""')}"`:s;};
const iso=(date:Date)=>date.toISOString().slice(0,10);
const hash=(seed:number)=>{let state=seed>>>0;return ()=>{state=(state*1664525+1013904223)>>>0;return state/0x100000000;};};
const plusDays=(start:string,days:number)=>{const d=new Date(`${start}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+days);return iso(d);};
const money=(n:number)=>Math.round(n*100)/100;

export function generate(preset:Preset,seed=7):Txn[]{
 const c=configs[preset],r=hash(seed),months=preset==='toys-3-months'?3:12, buyers=Math.max(1,Math.round(c.orders/(1+c.repeat))), rows:Txn[]=[];
 for(let order=0;order<c.orders;order++){
   const buyer=order<buyers?order:Math.floor(r()*buyers); const peakBoost=c.peak&&r()<.22?c.peak-1:Math.floor(r()*months); const day=Math.min(months*30-1,peakBoost*30+Math.floor(r()*29));
   const [item,low,high]=c.items[Math.floor(r()*c.items.length)]; const gross=money(low+r()*(high-low)); const abroad=r()<.08; const fee=money(gross*(abroad?.0449:.0349)+.49);
   const id=`${preset.slice(0,3)}-${seed}-${order+1}`; const date=plusDays(c.start,day);
   rows.push({id,date,kind:'sale',gross,fee,net:money(gross-fee),currency:c.currency,buyer_key:`buyer-${buyer+1}`,item_title:item,country:abroad?'IE':preset==='vintage-clothes-reseller'?'US':'GB',quantity:1,status:'Completed',cart_items:[{name:item,quantity:1,unit_price:gross}]});
   if(preset==='stationery-reseller'&&item==='Vintage bead notebook'&&r()<.15)rows.push({id:`refund-${id}`,date:plusDays(date,3+Math.floor(r()*10)),kind:'refund',gross:-gross,fee:0,net:-gross,currency:c.currency,reference_id:id,item_title:item,status:'Completed'});
   else if(r()<.02)rows.push({id:`refund-${id}`,date:plusDays(date,4),kind:'refund',gross:-gross,fee:0,net:-gross,currency:c.currency,reference_id:id,item_title:item,status:'Completed'});
 }
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
}
function appCsv(rows:Txn[]){const header=['Date','Type','Status','Currency','Gross','Fee','Net','From Email Address','Transaction ID','Item Title','Country','Quantity','Reference Txn ID'];return [header,...rows.map(x=>[x.date,x.kind==='sale'?'Payment Received':'Refund',x.status||'Completed',x.currency,x.gross.toFixed(2),(-x.fee).toFixed(2),x.net.toFixed(2),x.buyer_key?`${x.buyer_key}@example.test`:'',x.id,x.item_title||'',x.country||'',x.quantity||1,x.reference_id||''])].map(r=>r.map(quote).join(',')).join('\n')+'\n';}
function paypalCsv(rows:Txn[],us:boolean){const header=['Date','Time','TimeZone','Name','Type','Status','Currency','Gross','Fee','Net','From Email Address','To Email Address','Transaction ID','Address Status','Sales Tax','Reference Txn ID','Invoice Number','Receipt ID','Balance','Contact Phone Number','Subject','Note','Country Code'];const fmt=(value:string)=>{const [y,m,d]=value.split('-');return us?`${m}/${d}/${y}`:`${d}/${m}/${y}`;};return [header,...rows.map(x=>[fmt(x.date),'12:00:00',us?'PST':'GMT','Synthetic buyer',x.kind==='sale'?'Payment Received':'Refund',x.status||'Completed',x.currency,x.gross.toFixed(2),(-x.fee).toFixed(2),x.net.toFixed(2),x.buyer_key?`${x.buyer_key}@example.test`:'','seller@example.test',x.id,'Confirmed','',x.reference_id||'','','','','',x.item_title||'', '',x.country||''])].map(r=>r.map(quote).join(',')).join('\n')+'\n';}
function expected(preset:Preset,rows:Txn[]){
 const a=analyze(rows,{homeCountry:configs[preset].currency==='USD'?'US':'GB',asOf:'2026-10-31T12:00:00Z'}),found=new Map(a.ranked_leaks.map(x=>[x.id,x]));
 return {preset,cards:Object.fromEntries(allCards.map(id=>{const leak=found.get(id);return [id,{shown:!!leak,money:leak?.money_per_month??null,facts:leak?{method:leak.method}:{}}];}))};
}
function writePreset(preset:Preset,seed:number,dir:string){const rows=generate(preset,seed),base=resolve(dir,preset),us=configs[preset].currency==='USD';writeFileSync(`${base}.app.csv`,appCsv(rows));writeFileSync(`${base}.paypal.csv`,paypalCsv(rows,us));writeFileSync(`${base}.expected.json`,JSON.stringify(expected(preset,rows),null,2)+'\n');if(configs[preset].orders>=60){const after=rows.filter(x=>x.kind==='sale').slice(0,6).map((x,i)=>({...x,id:`after-${x.id}`,date:plusDays('2026-11-01',i*7),buyer_key:x.buyer_key}));writeFileSync(`${base}.after.app.csv`,appCsv(after));}}
const arg=(name:string)=>{const i=process.argv.indexOf(name);return i<0?undefined:process.argv[i+1];};
if(process.argv[1]?.endsWith('generate-hobby-shop.ts')){
 const requested=arg('--shop') as Preset|undefined, seed=Number(arg('--seed')||7), out=resolve(process.cwd(),'fixtures/hobby-shops');
 if(!Number.isSafeInteger(seed))throw new Error('Use an integer --seed.');mkdirSync(out,{recursive:true});
 for(const preset of requested?[requested]:Object.keys(configs) as Preset[]){if(!configs[preset])throw new Error(`Unknown shop preset: ${preset}`);writePreset(preset,seed,out);}
}
