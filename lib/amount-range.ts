/** Confirmed interval endpoints are retained; a point is never silently inferred. */
export type AmountRange={min:number;max:number};
export type Amount=number|AmountRange;
export function bounds(value:Amount):AmountRange{return typeof value==='number'?{min:value,max:value}:value}
export function isAmountRange(value:unknown):value is AmountRange{return !!value&&typeof value==='object'&&Number.isFinite((value as AmountRange).min)&&Number.isFinite((value as AmountRange).max)&&(value as AmountRange).min>=0&&(value as AmountRange).min<=(value as AmountRange).max}
export function sameAmount(a:unknown,b:unknown){return JSON.stringify(a)===JSON.stringify(b)}
