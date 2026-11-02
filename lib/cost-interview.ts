export type SellerKind='maker'|'reseller';
export type CostAnswers={kind?:SellerKind;buy?:number;batch?:number;pieces?:number;waste?:number;post?:number;pay?:number;helpers?:number};
export type CostResult={cost:number;keep:number;fee:number;cameIn:number;parts:Array<{label:string;value:number|undefined}>;negativeRaise?:number;wasteGain?:number};

/** Parse the deliberately small vocabulary used in the interview before considering AI. */
export function parseRoughAmount(input:string,percent=false):number|undefined {
 const text=input.trim().toLowerCase().replace(/,/g,'');
 if(!text||/don'?t know|not sure|skip/.test(text))return undefined;
 if(/\ba fiver\b/.test(text))return 5;
 if(/\ba tenner\b/.test(text))return 10;
 if(/\ba third\b/.test(text))return percent?.33:undefined;
 const range=text.match(/(-?\d+(?:\.\d+)?)\s*(?:to|-)\s*(-?\d+(?:\.\d+)?)/);
 const number=range?(Number(range[1])+Number(range[2]))/2:Number((text.match(/-?\d+(?:\.\d+)?/)||[])[0]);
 if(!Number.isFinite(number)||number<0)return undefined;
 return percent||/%/.test(text)?number/100:number;
}

export function costResult(input:{kind:SellerKind;answers:CostAnswers;cameIn:number;fee:number;units:number;ordersPerMonth:number}) : CostResult {
 const {kind,answers,cameIn,fee,units,ordersPerMonth}=input;
 const helpers=(answers.helpers||0)/Math.max(1,ordersPerMonth);
 const material=kind==='maker'&&answers.batch!==undefined&&answers.pieces?answers.batch/(answers.pieces*Math.max(.01,1-(answers.waste||0))):undefined;
 const goods=kind==='maker'?material:answers.buy;
 const cost=(goods===undefined?0:goods*units)+(answers.post||0)+(answers.pay||0)+helpers;
 const keep=cameIn-fee-cost;
 const negativeRaise=keep<0?Math.ceil((-keep/Math.max(.01,1-fee/Math.max(cameIn,.01)))*2)/2:undefined;
 const wasteGain=kind==='maker'&&answers.batch!==undefined&&answers.pieces&&answers.waste?answers.batch/(answers.pieces*(1-answers.waste))-answers.batch/(answers.pieces*(1-answers.waste/2)):undefined;
 return {cost,keep,fee,cameIn,parts:[{label:kind==='maker'?'Materials':'Buying',value:goods===undefined?undefined:goods*units},{label:'Posting',value:answers.post},{label:'Your time',value:answers.pay},{label:'Help',value:helpers}],...(negativeRaise===undefined?{}:{negativeRaise}),...(wasteGain===undefined?{}:{wasteGain})};
}
