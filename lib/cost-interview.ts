import {dedupeRows,isSettledSale} from './engine';
import {currencyScale,toMinor,remainderMinor,outwardMinor} from './partial-money';
import {resolveOrderEconomics} from './business-economics';
import type {Fact,FactBasis,FactField} from './business-model';
import type {Txn} from './types';
import {isAmountRange,type Amount,type AmountRange} from './amount-range';
export type SellerKind='maker'|'reseller';
export type CostAnswers={kind?:SellerKind;units?:number;buy?:number;batch?:number;pieces?:number;waste?:number;post?:number;pay?:number;payBasis?:'unit'|'order';helpers?:number;notApplicable?:Array<'post'|'pay'|'helpers'>;ranges?:Partial<Record<'units'|'buy'|'batch'|'pieces'|'waste'|'post'|'pay'|'helpers',AmountRange>>};
export type CostResult={cost:number;keep:number;fee:number|null;cameIn:number;parts:Array<{label:string;value:number|undefined;range?:AmountRange}>;keepRange?:AmountRange;roundingAdjustment?:number;rangeRoundingAdjustment?:{lower:number;upper:number};negativeRaise?:number;wasteGain?:number};
export function missingCostComponents(result:CostResult){return result.parts.filter(part=>part.value===undefined&&!part.range).map(part=>part.label.toLowerCase());}

/** Ranges are left unresolved until they can be stored with both endpoints. */
export function hasAmountRange(input:string){const number='(?:[$£€]\\s*)?(?:\\d+(?:\\.\\d+)?|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty)(?:\\s*(?:pounds?|dollars?|euros?|quid))?';return new RegExp(`${number}\\s*(?:to|through|or|-|–|—)\\s*${number}\\b|\\bbetween\\s+${number}\\s+and\\s+${number}\\b`,'i').test(input)}
/** Explicit typed bounds only; ambiguous wording remains unresolved. */
export function parseAmountRange(input:string,percent=false):AmountRange|undefined{const text=input.trim().replace(/,/g,''),match=text.match(/^(?:(?:about|roughly|around|approximately)\s+)?(?:between\s+)?[£$€]?\s*(\d+(?:\.\d+)?)\s*(%?)\s*(?:to|through|and|[-–—])\s*[£$€]?\s*(\d+(?:\.\d+)?)\s*(%?)(?:\s+(?:per\s+(?:item|piece|order|batch|month)|each|for\s+(?:all\s+)?\d+))?$/i);if(!match||(!percent&&(match[2]||match[4])))return undefined;const hasPercent=percent||!!match[2]||!!match[4],factor=hasPercent?100:1,min=Number(match[1])/factor,max=Number(match[3])/factor;if(!Number.isFinite(min)||!Number.isFinite(max)||min<0||min>max)return undefined;return {min,max}}
/** Parse the deliberately small vocabulary used in the interview before considering AI. */
export function parseRoughAmount(input:string,percent=false):number|undefined {
 const text=input.trim().toLowerCase().replace(/,/g,'');
 if(!text||/don'?t know|not sure|skip/.test(text)||hasAmountRange(text))return undefined;
 if(/\ba fiver\b/.test(text))return 5;
 if(/\ba tenner\b/.test(text))return 10;
 const words:Record<string,number>={zero:0,one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12,twenty:20};const spoken=text.match(/\b(zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty)\s+(?:pounds?|dollars?|euros?|quid|pence|cents?)\b/);if(spoken){const amount=words[spoken[1]];return /pence|cents/.test(spoken[0])?amount/100:amount;}
 if(/\b(?:a|one) quarter\b/.test(text))return percent?.25:undefined;
 if(/\b(?:a|one) third\b/.test(text))return percent?1/3:undefined;
 const range=text.match(/(-?\d+(?:\.\d+)?)\s*(?:to|-)\s*(-?\d+(?:\.\d+)?)/);
 if(range)return undefined;
 const number=Number((text.match(/-?\d+(?:\.\d+)?/)||[])[0]);
 if(!Number.isFinite(number)||number<0)return undefined;
 return percent||/%/.test(text)?number/100:number;
}

/** Estimate this order's fee using the selected shop's aggregate fee rate. */
export function estimatedPayPalFee(shopFees:number,shopSales:number,itemGross:number,itemOrders:number){return shopFees/Math.max(1,shopSales)*itemGross/Math.max(1,itemOrders)}

export function costResult(input:{kind:SellerKind;answers:CostAnswers;cameIn:number;fee:number|null;units:number|undefined;ordersPerMonth:number;currency?:string;singleItemOrder?:boolean;averageTotals?:{grossMinor:number;feeMinor:number|null;orders:number}}) : CostResult {
 const {kind,answers,units,ordersPerMonth}=input;
 const currency=input.currency||'USD',scale=currencyScale(currency),cents=(value:number)=>toMinor(value,currency);
 const totals=input.averageTotals;if(totals&&(!Number.isSafeInteger(totals.grossMinor)||totals.grossMinor<0||!Number.isSafeInteger(totals.orders)||totals.orders<1||totals.feeMinor!==null&&(!Number.isSafeInteger(totals.feeMinor)||totals.feeMinor<0)))throw new Error('Invalid order totals.');const cameInCents=totals?Math.round(totals.grossMinor/totals.orders):cents(input.cameIn),feeCents=totals?(totals.feeMinor===null?null:Math.round(totals.feeMinor/totals.orders)):input.fee===null?null:cents(input.fee);
 const helpInput=answers.ranges?.helpers??answers.helpers;const helpers=answers.notApplicable?.includes('helpers')?0:helpInput!==undefined&&ordersPerMonth>0?(isAmountRange(helpInput)?{min:helpInput.min/ordersPerMonth,max:helpInput.max/ordersPerMonth}:helpInput/ordersPerMonth):undefined;
 const businessId='00000000-0000-4000-8000-000000000001',productId='00000000-0000-4000-8000-000000000002';let sequence=10;const facts:Fact[]=[];
 const add=(field:FactField,value:Amount|undefined,basis:FactBasis,monetary:boolean)=>{if(value===undefined||typeof value==='number'&&(!Number.isFinite(value)||value<0))return;const id=`00000000-0000-4000-8000-${String(sequence++).padStart(12,'0')}`;facts.push({id,operationId:id,businessId,productId,field,state:'confirmed',value,currency:monetary?currency:null,basis,validFrom:'2000-01-01',validTo:null,confirmedAt:'2000-01-01T00:00:00Z',source:'seller_confirmed',supersedes:[]})};
 if(kind==='maker'){add('batch',answers.ranges?.batch??answers.batch,'batch',true);add('pieces',answers.ranges?.pieces??answers.pieces,'batch',false);add('waste',answers.ranges?.waste??answers.waste,'share',false)}else add('buy',answers.ranges?.buy??answers.buy,'unit',true);add('post',answers.notApplicable?.includes('post')?0:answers.ranges?.post??answers.post,'order',true);add('pay',answers.notApplicable?.includes('pay')?0:answers.ranges?.pay??answers.pay,answers.payBasis||'order',true);
 const resolved=resolveOrderEconomics({businessId,productId,currency,date:'2000-01-01',kind,quantity:answers.ranges?.units??units??null,cameInMinor:cameInCents,feeMinor:feeCents,singleItemOrder:true,facts});const helpRange=helpers===undefined?null:isAmountRange(helpers)?outwardMinor(helpers.min,helpers.max,currency):{min:cents(helpers),max:cents(helpers)},ranges=[resolved.goodsRangeMinor,resolved.postRangeMinor,resolved.payRangeMinor,helpRange],rounded=ranges.map(range=>range&&range.min===range.max?range.min:undefined);
 const costCents=rounded.reduce<number>((sum,value)=>sum+(value??0),0),keepCents=remainderMinor(cameInCents,[feeCents,...rounded]);
 const cost=costCents/scale,keep=keepCents/scale,fee=feeCents===null?null:feeCents/scale,cameIn=cameInCents/scale,hasRange=ranges.some(range=>range&&range.min!==range.max),minCosts=ranges.reduce((sum,range)=>sum+(range?.min??0),0),maxCosts=ranges.reduce((sum,range)=>sum+(range?.max??0),0),keepRange=hasRange?{min:(cameInCents-(feeCents??0)-maxCosts)/scale,max:(cameInCents-(feeCents??0)-minCosts)/scale}:undefined;
 const negativeRaise=!hasRange&&fee!==null&&keep<0?Math.ceil((-keep/Math.max(.01,1-fee/Math.max(cameIn,.01)))*2)/2:undefined;
 const wasteGain=!hasRange&&kind==='maker'&&answers.batch!==undefined&&answers.pieces&&answers.waste!==undefined&&answers.waste>0&&answers.waste<1&&units!==undefined?(answers.batch/(answers.pieces*(1-answers.waste))-answers.batch/(answers.pieces*(1-answers.waste/2)))*units:undefined;
 return {cost,keep,fee,cameIn,parts:rounded.map((value,index)=>({label:[kind==='maker'?'Materials':'Buying','Posting','Your time','Help'][index],value:value===undefined?undefined:value/scale,...(ranges[index]&&ranges[index]!.min!==ranges[index]!.max?{range:{min:ranges[index]!.min/scale,max:ranges[index]!.max/scale}}:{})})),...(keepRange?{keepRange}:{}),...(negativeRaise===undefined?{}:{negativeRaise}),...(wasteGain===undefined?{}:{wasteGain})};
}

/** Turn common product-category plurals into a usable one-item label. */
export function singularItem(label:string){return label.replace(/\b(earrings|necklaces|bracelets|rings|pouches|boxes|pieces)\b/gi, word=>{const lower=word.toLowerCase();return lower.endsWith('ches')||lower.endsWith('xes')?word.slice(0,-2):word.slice(0,-1)});}

/** Match the sales counted in the analysis; refunds are not extra units sold. */
export function averageItemUnits(rows:Txn[],item:string,currency:string,orders:number){return dedupeRows(rows).filter(row=>(row.item_group||row.item_title)===item&&row.currency===currency&&isSettledSale(row)).reduce((sum,row)=>sum+(row.quantity||1),0)/Math.max(1,orders)}
