import {z} from 'zod';

export const productGroupItemSchema=z.object({title:z.string().trim().min(1).max(160),orders:z.number().int().nonnegative()}).strict();
export const productGroupRequestSchema=z.object({items:z.array(productGroupItemSchema).min(1).max(200)}).strict();
const groupSchema=z.object({name:z.string().trim().min(1).max(80),titles:z.array(z.string().trim().min(1).max(160)).min(1).max(200)}).strict();
export const productGroupingResponseSchema=z.object({shop:z.string().trim().min(1).max(240),groups:z.array(groupSchema).max(200),unplaced:z.array(z.string().trim().min(1).max(160)).max(200)}).strict();
export type ProductGrouping=z.infer<typeof productGroupingResponseSchema>&{source:'ai'|'fallback'};

export function validateProductGrouping(value:unknown,items:ReadonlyArray<{title:string;orders:number}>):ProductGrouping|null {
 const parsed=productGroupingResponseSchema.safeParse(value);if(!parsed.success)return null;
 const available=new Set(items.map(item=>item.title)),seen=new Set<string>();
 for(const group of parsed.data.groups)for(const title of group.titles){if(!available.has(title)||seen.has(title))return null;seen.add(title);}
 for(const title of parsed.data.unplaced){if(!available.has(title)||seen.has(title))return null;seen.add(title);}
 return {...parsed.data,source:'ai'};
}

const fallbackLabel=(title:string)=>{const words=title.toLowerCase();if(/\blunch bags?\b/.test(words))return 'Lunch bags';if(/\b(?:hoop|stud|drop|dangle)?\s*earrings?\b/.test(words))return 'Earrings';if(/\brings?\b/.test(words))return 'Rings';if(/\bnecklaces?\b/.test(words))return 'Necklaces';if(/\bbracelets?\b/.test(words))return 'Bracelets';return null;};
/** The pre-AI local grouping remains available when the protected model is unavailable. */
export function fallbackProductGrouping(items:ReadonlyArray<{title:string;orders:number}>):ProductGrouping {const byName=new Map<string,string[]>(),unplaced:string[]=[];for(const item of items){const name=fallbackLabel(item.title);if(name)byName.set(name,[...(byName.get(name)||[]),item.title]);else unplaced.push(item.title);}return {shop:'This shop sells the items listed in its PayPal activity.',groups:[...byName].map(([name,titles])=>({name,titles})),unplaced,source:'fallback'};}
export function groupingPrompt(items:ReadonlyArray<{title:string;orders:number}>){return `Group product-title variants into clear shopper-facing product groups. A title may appear once at most. Keep a title unplaced if its category is uncertain. Return one JSON object only: {"shop":"one neutral sentence saying what this shop sells","groups":[{"name":"plural group name","titles":["exact supplied title"]}],"unplaced":["exact supplied title"]}. Do not include buyer details, transactions, IDs, prices, totals, code, or extra fields. Items: ${JSON.stringify(items)}`;}
