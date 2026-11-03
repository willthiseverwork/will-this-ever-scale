import type {ProductGroupingSummary,Txn} from './types';
type Pair={a:string;b:string;coOrders:number;coBuyers:number;singleA:number;priceA:number;priceB:number;min:number;max:number;price:number;saving:number;gain:number};
const median=(values:number[])=>{const a=[...values].sort((x,y)=>x-y),m=Math.floor(a.length/2);return a.length%2?a[m]:(a[m-1]+a[m])/2};
export function bundleGain(singleA:number,price:number,priceA:number){return Math.max(1,Math.round(singleA/10))*(price-priceA)}
export function bundleOffer(rows:Txn[],grouping?:ProductGroupingSummary,currency?:string):Pair|undefined{
 const group=(name:string)=>grouping?.groups.find(g=>g.titles.includes(name))?.name||name;
 const orderGroups:string[][]=[];const singles=new Map<string,{prices:number[];orders:number}>(),pairs=new Map<string,{a:string;b:string;count:number;money:number;buyers:Set<string>}>();
 for(const row of rows){if(currency&&row.currency!==currency)continue;if(!['sale','invoice_payment','subscription_payment'].includes(row.kind)||row.gross<=0||/pending|failed|denied|refused|declined|cancelled|unpaid/i.test(row.status||'')||!row.cart_items?.length)continue;
  const names=[...new Set(row.cart_items.filter(i=>i.name&&i.quantity>0&&i.unit_price>0).map(i=>group(i.name)))];
  orderGroups.push(names);
  if(names.length===1&&row.cart_items.reduce((n,i)=>n+i.quantity,0)===1){const item=row.cart_items[0],current=singles.get(names[0])||{prices:[],orders:0};current.orders++;current.prices.push(item.unit_price);singles.set(names[0],current)}
  for(let i=0;i<names.length;i++)for(let j=i+1;j<names.length;j++){const [a,b]=[names[i],names[j]].sort(),key=JSON.stringify([a,b]),p=pairs.get(key)||{a,b,count:0,money:0,buyers:new Set<string>()};p.count++;p.money+=row.gross;if(row.buyer_key)p.buyers.add(row.buyer_key);pairs.set(key,p)}
 }
 const best=[...pairs.values()].filter(p=>p.count>=5).sort((a,b)=>b.count-a.count||b.money-a.money||a.a.localeCompare(b.a)||a.b.localeCompare(b.b))[0];if(!best||!singles.has(best.a)||!singles.has(best.b))return;
 const onlyA=orderGroups.filter(names=>names.includes(best.a)&&!names.includes(best.b)).length,onlyB=orderGroups.filter(names=>names.includes(best.b)&&!names.includes(best.a)).length;const a=onlyA>=onlyB?best.a:best.b,b=a===best.a?best.b:best.a;const singleA=a===best.a?onlyA:onlyB,sa=singles.get(a)!,sb=singles.get(b)!,priceA=median(sa.prices),priceB=median(sb.prices),sum=priceA+priceB,min=Math.ceil(sum*.7),max=Math.floor(sum);if(min>max)return;
 const price=Math.max(min,Math.min(max,Math.floor(sum*.92)));return {a,b,coOrders:best.count,coBuyers:best.buyers.size,singleA,priceA,priceB,min,max,price,saving:sum-price,gain:bundleGain(singleA,price,priceA)};
}
