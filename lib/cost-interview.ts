import {dedupeRows,isSettledSale} from './engine';
import type {Txn} from './types';
export type SellerKind='maker'|'reseller';
export type CostAnswers={kind?:SellerKind;units?:number;buy?:number;batch?:number;pieces?:number;waste?:number;post?:number;pay?:number;helpers?:number};
export type CostResult={cost:number;keep:number;fee:number;cameIn:number;parts:Array<{label:string;value:number|undefined}>;negativeRaise?:number;wasteGain?:number};

/** Parse the deliberately small vocabulary used in the interview before considering AI. */
export function parseRoughAmount(input:string,percent=false):number|undefined {
 const text=input.trim().toLowerCase().replace(/,/g,'');
 if(!text||/don'?t know|not sure|skip/.test(text))return undefined;
 if(/\ba fiver\b/.test(text))return 5;
 if(/\ba tenner\b/.test(text))return 10;
 const words:Record<string,number>={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,twenty:20};const spoken=text.match(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty)\s+(?:pounds?|dollars?|euros?|quid|pence|cents?)\b/);if(spoken){const amount=words[spoken[1]];return /pence|cents/.test(spoken[0])?amount/100:amount;}
 if(/\b(?:a|one) quarter\b/.test(text))return percent?.25:undefined;
 if(/\b(?:a|one) third\b/.test(text))return percent?.33:undefined;
 const range=text.match(/(-?\d+(?:\.\d+)?)\s*(?:to|-)\s*(-?\d+(?:\.\d+)?)/);
 const number=range?(Number(range[1])+Number(range[2]))/2:Number((text.match(/-?\d+(?:\.\d+)?/)||[])[0]);
 if(!Number.isFinite(number)||number<0)return undefined;
 return percent||/%/.test(text)?number/100:number;
}

/** Estimate this order's fee using the selected shop's aggregate fee rate. */
export function estimatedPayPalFee(shopFees:number,shopSales:number,itemGross:number,itemOrders:number){return shopFees/Math.max(1,shopSales)*itemGross/Math.max(1,itemOrders)}

export function costResult(input:{kind:SellerKind;answers:CostAnswers;cameIn:number;fee:number;units:number;ordersPerMonth:number}) : CostResult {
 const {kind,answers,units,ordersPerMonth}=input;
 const cents=(value:number)=>Math.round((value+Number.EPSILON)*100);
 const cameInCents=cents(input.cameIn),feeCents=cents(input.fee);
 const helpers=answers.helpers!==undefined&&ordersPerMonth>0?answers.helpers/ordersPerMonth:undefined;
 const material=kind==='maker'&&answers.batch!==undefined&&answers.pieces!==undefined&&answers.pieces>0&&answers.waste!==undefined&&answers.waste>=0&&answers.waste<1?answers.batch/(answers.pieces*(1-answers.waste)):undefined;
 const goods=kind==='maker'?material:answers.buy;
 const amounts=[goods===undefined?undefined:goods*units,answers.post,answers.pay,helpers];
 const rounded=amounts.map(value=>value===undefined?undefined:cents(value));
 const costCents=rounded.reduce<number>((sum,value)=>sum+(value??0),0),keepCents=cameInCents-feeCents-costCents;
 const cost=costCents/100,keep=keepCents/100,fee=feeCents/100,cameIn=cameInCents/100;
 const negativeRaise=keep<0?Math.ceil((-keep/Math.max(.01,1-fee/Math.max(cameIn,.01)))*2)/2:undefined;
 const wasteGain=kind==='maker'&&answers.batch!==undefined&&answers.pieces&&answers.waste!==undefined&&answers.waste>0&&answers.waste<1?(answers.batch/(answers.pieces*(1-answers.waste))-answers.batch/(answers.pieces*(1-answers.waste/2)))*units:undefined;
 return {cost,keep,fee,cameIn,parts:rounded.map((value,index)=>({label:[kind==='maker'?'Materials':'Buying','Posting','Your time','Help'][index],value:value===undefined?undefined:value/100})),...(negativeRaise===undefined?{}:{negativeRaise}),...(wasteGain===undefined?{}:{wasteGain})};
}

/** Turn common product-category plurals into a usable one-item label. */
export function singularItem(label:string){return label.replace(/\b(earrings|necklaces|bracelets|rings|pouches|boxes|pieces)\b/gi, word=>{const lower=word.toLowerCase();return lower.endsWith('ches')||lower.endsWith('xes')?word.slice(0,-2):word.slice(0,-1)});}

/** Match the sales counted in the analysis; refunds are not extra units sold. */
export function averageItemUnits(rows:Txn[],item:string,currency:string,orders:number){return dedupeRows(rows).filter(row=>(row.item_group||row.item_title)===item&&row.currency===currency&&isSettledSale(row)).reduce((sum,row)=>sum+(row.quantity||1),0)/Math.max(1,orders)}
