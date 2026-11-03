/** Display the actual shop currency rather than guessing an unrelated symbol. */
export function currencySymbol(currency:string){return new Intl.NumberFormat(currency==='GBP'?'en-GB':'en-US',{style:'currency',currency}).formatToParts(0).find(part=>part.type==='currency')?.value||currency+' ';}
export function minorUnit(currency:string){return currency==='GBP'?'p':currency==='EUR'?'c':['USD','CAD','AUD','NZD'].includes(currency)?'¢':' cents';}
