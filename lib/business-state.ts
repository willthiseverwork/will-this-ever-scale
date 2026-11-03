import {z} from 'zod';
import {addFact,factSchema} from './business-model';
import {businessSchema,confirmAlias,type ProductAlias} from './business-identity';
import {workspaceProductLabel} from './workspace-types';
const uuid=z.string().uuid();
export const businessStateSchema=z.object({version:z.literal(1),revision:z.number().int().nonnegative().safe(),businesses:z.array(businessSchema).max(20),facts:z.array(factSchema).max(2000)}).strict().refine(s=>new Set(s.businesses.map(b=>b.id)).size===s.businesses.length&&new Set(s.facts.map(f=>f.id)).size===s.facts.length&&new Set(s.facts.map(f=>f.operationId)).size===s.facts.length&&s.facts.every(f=>s.businesses.some(b=>b.id===f.businessId&&(f.productId===null||b.products.some(p=>p.id===f.productId)))),'Invalid business state.');
export type BusinessState=z.infer<typeof businessStateSchema>;
export function emptyBusinessState():BusinessState{return {version:1,revision:0,businesses:[],facts:[]}}
const commandSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('create_business'),id:uuid,label:workspaceProductLabel,compartment:z.enum(['seller_file','demo','sandbox'])}).strict(),
 z.object({type:z.literal('create_product'),businessId:uuid,id:uuid,label:workspaceProductLabel}).strict(),
 z.object({type:z.literal('confirm_alias'),businessId:uuid,alias:z.object({id:uuid,operationId:uuid,productId:uuid,source:z.enum(['seller_file','demo','sandbox','verified_live']),sourceKey:z.string().regex(/^b_[a-f0-9]{64}$/),validFrom:z.string(),validTo:z.string().nullable()}).strict()}).strict(),
 z.object({type:z.literal('confirm_fact'),fact:factSchema}).strict()
]);
/** Apply explicit commands only; the caller supplies owner, entitlement and CAS checks. */
export function applyBusinessCommand(value:BusinessState,raw:unknown):BusinessState{
 const state=businessStateSchema.parse(value),command=commandSchema.parse(raw);let next=state;
 if(command.type==='create_business'){
  const existing=state.businesses.find(b=>b.id===command.id);if(existing){if(existing.label!==command.label||existing.compartment!==command.compartment)throw new Error('Business conflict.');return state;}
  next={...state,businesses:[...state.businesses,{id:command.id,label:command.label,compartment:command.compartment,products:[],aliases:[]}]};
 }else if(command.type==='create_product'){
  const business=state.businesses.find(b=>b.id===command.businessId);if(!business)throw new Error('Business not found.');const existing=business.products.find(p=>p.id===command.id);if(existing){if(existing.label!==command.label)throw new Error('Product conflict.');return state;}
  next={...state,businesses:state.businesses.map(b=>b.id===business.id?{...b,products:[...b.products,{id:command.id,label:command.label}]}:b)};
 }else if(command.type==='confirm_alias'){
  const business=state.businesses.find(b=>b.id===command.businessId);if(!business)throw new Error('Business not found.');const updated=confirmAlias(business,command.alias as ProductAlias);if(JSON.stringify(updated)===JSON.stringify(business))return state;next={...state,businesses:state.businesses.map(b=>b.id===business.id?updated:b)};
 }else{
  const fact=command.fact,business=state.businesses.find(b=>b.id===fact.businessId);if(!business||(fact.productId!==null&&!business.products.some(p=>p.id===fact.productId)))throw new Error('Fact outside business.');if(fact.source!=='seller_confirmed')throw new Error('Seller confirmation required.');const facts=addFact(state.facts,fact);if(facts===state.facts)return state;next={...state,facts};
 }
 return businessStateSchema.parse({...next,revision:state.revision+1});
}
