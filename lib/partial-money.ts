/** Shared same-currency arithmetic; callers decide which costs are evidenced. */
export function currencyScale(currency:string){const digits=new Intl.NumberFormat('en',{style:'currency',currency}).resolvedOptions().maximumFractionDigits;if(digits===undefined||digits>3)throw new Error('Unsupported currency.');return 10**digits;}
export function toMinor(value:number,currency:string){const result=Math.round((value+Number.EPSILON)*currencyScale(currency));if(!Number.isSafeInteger(result))throw new Error('Amount too large.');return result;}
export function remainderMinor(cameIn:number,components:Array<number|null|undefined>){const result=cameIn-components.reduce<number>((sum,value)=>sum+(value??0),0);if(!Number.isSafeInteger(result))throw new Error('Amount too large.');return result;}
