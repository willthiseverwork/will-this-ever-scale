import {z} from 'zod';
import {workspaceProductLabel} from './workspace-types';
const uuid=z.string().uuid();
const aliasSchema=z.object({id:uuid,operationId:uuid,productId:uuid,source:z.enum(['seller_file','demo','sandbox','verified_live']),sourceKey:z.string().regex(/^b_[a-f0-9]{64}$/),validFrom:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),validTo:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable()}).strict();
const productSchema=z.object({id:uuid,label:workspaceProductLabel,kind:z.enum(['maker','reseller']).optional()}).strict();
export const businessSchema=z.object({id:uuid,label:workspaceProductLabel,compartment:z.enum(['seller_file','demo','sandbox','verified_live']),products:z.array(productSchema).max(200),aliases:z.array(aliasSchema).max(1000)}).strict().refine(b=>new Set(b.products.map(p=>p.id)).size===b.products.length&&new Set(b.aliases.map(a=>a.id)).size===b.aliases.length&&new Set(b.aliases.map(a=>a.operationId)).size===b.aliases.length&&b.aliases.every(a=>a.source===b.compartment&&b.products.some(p=>p.id===a.productId)),'Invalid business identity.');
export type BusinessIdentity=z.infer<typeof businessSchema>;export type ProductAlias=z.infer<typeof aliasSchema>;
function validDate(date:string){return Number.isFinite(Date.parse(date+'T00:00:00Z'))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date}
/** Alias assignment is an explicit seller operation, never an inference from a name. */
export function confirmAlias(value:BusinessIdentity,candidate:ProductAlias):BusinessIdentity{
 const business=businessSchema.parse(value),alias=aliasSchema.parse(candidate);if(!validDate(alias.validFrom)||(alias.validTo!==null&&(!validDate(alias.validTo)||alias.validTo<alias.validFrom)))throw new Error('Invalid alias dates.');
 if(alias.source!==business.compartment||!business.products.some(p=>p.id===alias.productId))throw new Error('Alias outside business.');
 const prior=business.aliases.find(x=>x.operationId===alias.operationId);if(prior){if(JSON.stringify(prior)!==JSON.stringify(alias))throw new Error('Operation conflict.');return business;}
 if(business.aliases.some(x=>x.id===alias.id))throw new Error('Alias already exists.');
 const collision=business.aliases.some(x=>x.source===alias.source&&x.sourceKey===alias.sourceKey&&x.productId!==alias.productId&&x.validFrom<=(alias.validTo??'9999-12-31')&&alias.validFrom<=(x.validTo??'9999-12-31'));if(collision)throw new Error('Alias requires resolution.');
 return businessSchema.parse({...business,aliases:[...business.aliases,alias]});
}
/** No match means unassigned; callers must ask rather than copy costs by title. */
export function findAlias(business:BusinessIdentity,source:BusinessIdentity['compartment'],sourceKey:string,date:string):string|null{
 if(!validDate(date))throw new Error('Invalid alias date.');const matches=new Set(business.aliases.filter(x=>x.source===source&&source===business.compartment&&x.sourceKey===sourceKey&&x.validFrom<=date&&(x.validTo===null||x.validTo>=date)).map(x=>x.productId));return matches.size===1?[...matches][0]:null;
}
