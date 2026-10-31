import {z} from 'zod';

// This is the complete vocabulary allowed to cross the browser/server boundary.
export const productFeature=z.enum(['hoop','silver','gold','earring','ring','necklace','bracelet','stud','digital','lesson','service']);
export type ProductFeature=z.infer<typeof productFeature>;
const group=z.enum(['silver_hoops','gold_hoops','hoop_earrings','rings','necklaces','bracelets','stud_earrings','digital_products','lessons','services']);
export type CanonicalGroup=z.infer<typeof group>;
const labels:Record<CanonicalGroup,string>={silver_hoops:'Silver hoops',gold_hoops:'Gold hoops',hoop_earrings:'Hoop earrings',rings:'Rings',necklaces:'Necklaces',bracelets:'Bracelets',stud_earrings:'Stud earrings',digital_products:'Digital products',lessons:'Lessons',services:'Services'};
const descriptor=z.object({index:z.number().int().min(1).max(1000000),features:z.array(productFeature).min(1).max(11).refine(v=>new Set(v).size===v.length),orders:z.number().int().min(1).max(1000000)}).strict();
export const descriptorListSchema=z.array(descriptor).max(20).refine(v=>new Set(v.map(x=>x.index)).size===v.length);
export type ItemDescriptor=z.infer<typeof descriptor>;
export type ItemMapping={index:number;group:CanonicalGroup};
const mappingsSchema=z.array(z.object({index:z.number().int().min(1),group}).strict()).max(20);
const terms:Record<ProductFeature,RegExp>={hoop:/\b(?:hoop|hoops|hoopss|hoopearrings|hoopearring|silverhoopearringssmall|goldhoopearringssmall)\b/i,silver:/\b(?:silver|sterling|silverhoopearringssmall)\b/i,gold:/\b(?:gold|golden|goldhoopearringssmall)\b/i,earring:/\b(?:earring|earrings|hoopearrings|hoopearring|silverhoopearringssmall|goldhoopearringssmall)\b/i,ring:/\b(?:ring|rings)\b/i,necklace:/\b(?:necklace|necklaces)\b/i,bracelet:/\b(?:bracelet|bracelets)\b/i,stud:/\b(?:stud|studs)\b/i,digital:/\b(?:digital|download|downloads)\b/i,lesson:/\b(?:lesson|lessons|class|classes)\b/i,service:/\b(?:service|services)\b/i};
/** Runs in the browser: emits only fixed features and counts, never source titles. */
export function buildItemDescriptors(items:ReadonlyArray<{name:string;orders:number}>):ItemDescriptor[]{
 const out:ItemDescriptor[]=[];
 items.forEach((item,i)=>{if(out.length>=20||i>=1000000||!Number.isInteger(item.orders)||item.orders<1||item.orders>1000000)return;const features=(Object.keys(terms) as ProductFeature[]).filter(f=>terms[f].test(item.name));if(features.length)out.push({index:i+1,features,orders:item.orders});});
 return descriptorListSchema.parse(out);
}
function supported(d:ItemDescriptor,g:CanonicalGroup):boolean {
 const f=new Set(d.features);
 // Competing product categories are ambiguous; keep the original title.
 if(['hoop','ring','necklace','bracelet','stud','digital','lesson','service'].filter(x=>f.has(x as ProductFeature)).length!==1)return false;
 switch(g){
  case 'silver_hoops':return f.has('silver')&&f.has('hoop')&&!f.has('gold');
  case 'gold_hoops':return f.has('gold')&&f.has('hoop')&&!f.has('silver');
  case 'hoop_earrings':return f.has('hoop')&&f.has('earring');
  case 'rings':return f.has('ring');case 'necklaces':return f.has('necklace');case 'bracelets':return f.has('bracelet');
  case 'stud_earrings':return f.has('stud')&&f.has('earring');case 'digital_products':return f.has('digital');case 'lessons':return f.has('lesson');case 'services':return f.has('service');
 }
}
/** Reject the entire model response on unknown, duplicate or unsupported assignments. */
export function validateItemMappings(input:unknown,descriptors:ItemDescriptor[]):ItemMapping[]|null {
 const d=descriptorListSchema.safeParse(descriptors),m=mappingsSchema.safeParse(input);if(!d.success||!m.success)return null;
 if(new Set(m.data.map(x=>x.index)).size!==m.data.length)return null;
 for(const x of m.data){const evidence=d.data.find(v=>v.index===x.index);if(!evidence||!supported(evidence,x.group))return null;}
 return m.data;
}
/** Accept plain JSON or one complete JSON code fence, then enforce the same schema and evidence checks. */
export function parseGroupingOutput(text:string,descriptors:ItemDescriptor[]):{jsonParsed:boolean;schemaValid:boolean;mappings:ItemMapping[]|null}{
 const trimmed=text.trim();const fence=/^```(?:json)?[ \t]*\r?\n([\s\S]*?)\r?\n```$/i.exec(trimmed);const json=fence?fence[1]:trimmed;
 let raw:unknown;try{raw=JSON.parse(json);}catch{return {jsonParsed:false,schemaValid:false,mappings:null};}
 const schemaValid=mappingsSchema.safeParse(raw).success;
 return {jsonParsed:true,schemaValid,mappings:validateItemMappings(raw,descriptors)};
}
/** Apply locally to matching original indexes; all missing assignments retain their original names. */
export function applyItemMappings<T extends {name:string}>(items:ReadonlyArray<T>,descriptors:ItemDescriptor[],input:unknown):T[]{
 const mappings=validateItemMappings(input,descriptors);if(!mappings)return items.map(v=>({...v}));const byIndex=new Map(mappings.map(m=>[m.index,m.group]));
 return items.map((v,i)=>({...v,name:byIndex.has(i+1)?labels[byIndex.get(i+1)!]:v.name}));
}
export function buildGroupingPrompt(descriptors:ItemDescriptor[]):string {const safe=descriptorListSchema.parse(descriptors);return `Group only items supported by the fixed features. Return JSON array only, each object has index and group. Allowed groups: silver_hoops, gold_hoops, hoop_earrings, rings, necklaces, bracelets, stud_earrings, digital_products, lessons, services. Omit uncertain items. Omit any item with competing product categories among hoop, ring, necklace, bracelet, stud, digital, lesson and service. Choose the most specific supported group. No extra fields. Descriptors: ${JSON.stringify(safe)}`;}
/** No fallback guesses: unavailable, malformed or unsupported output returns no mapping. */
export async function groupItems(descriptors:ItemDescriptor[]):Promise<{mappings:ItemMapping[];source:'model'|'template'}>{
 const safe=descriptorListSchema.parse(descriptors);if(!safe.length)return {mappings:[],source:'template'};
 try {const {selectModel}=await import('./ai-provider');const model=await selectModel();if(!model)return {mappings:[],source:'template'};const {generateText}=await import('ai');
  const result=await generateText({model,maxOutputTokens:300,maxRetries:0,prompt:buildGroupingPrompt(safe)});
  const {mappings}=parseGroupingOutput(result.text,safe);return result.finishReason==='stop'&&mappings?{mappings,source:'model'}:{mappings:[],source:'template'};
 } catch{return {mappings:[],source:'template'};}
}
