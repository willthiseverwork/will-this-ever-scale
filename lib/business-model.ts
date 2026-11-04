import {z} from 'zod';
import {isAmountRange} from './amount-range';
/** Pure, owner-local business facts. Persistence and seller confirmation are separate boundaries. */
export type Compartment='seller_file'|'demo'|'sandbox'|'verified_live';
export type FactState='confirmed'|'unknown'|'not_applicable';
export type FactBasis='unit'|'order'|'batch'|'month'|'share';
export type FactField='buy'|'batch'|'pieces'|'waste'|'post'|'pay'|'helpers'|'units'|'trading_start'|'single_item_orders'|'other_expense'|'owner_hours'|'coverage_complete';
export const factSchema=z.object({id:z.string().uuid(),operationId:z.string().uuid(),businessId:z.string().uuid(),productId:z.string().uuid().nullable(),field:z.enum(['buy','batch','pieces','waste','post','pay','helpers','units','trading_start','single_item_orders','other_expense','owner_hours','coverage_complete']),state:z.enum(['confirmed','unknown','not_applicable']),value:z.union([z.number().finite().min(0).max(1e12),z.object({min:z.number().finite().min(0).max(1e12),max:z.number().finite().min(0).max(1e12)}).strict().refine(value=>value.min<=value.max),z.string().max(10)]).nullable(),currency:z.string().regex(/^[A-Z]{3}$/).nullable(),basis:z.enum(['unit','order','batch','month','share']).nullable(),validFrom:z.string(),validTo:z.string().nullable(),confirmedAt:z.string().datetime(),source:z.enum(['seller_confirmed','observed','assumed','benchmark']),precision:z.enum(['exact','approximate']).optional(),supersedes:z.array(z.string().uuid()).max(20),sourceIds:z.array(z.string().uuid()).min(1).max(50).optional()}).strict();
export type Fact=z.infer<typeof factSchema>;
export type Business={id:string;compartment:Compartment;label:string};
export type FactResolution={state:'missing'}|{state:'contested';facts:Fact[]}|{state:'resolved';fact:Fact;facts:Fact[]};
const datePattern=/^\d{4}-\d{2}-\d{2}$/;
function dateValid(value:string){return datePattern.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value}
/** An operation is idempotent; conflicting reuse is rejected rather than guessed. */
export function addFact(facts:Fact[],fact:Fact):Fact[]{
 fact=factSchema.parse(fact);
 if(!dateValid(fact.validFrom)||(fact.validTo!==null&&(!dateValid(fact.validTo)||fact.validTo<fact.validFrom)))throw new Error('Invalid effective dates.');
 const allowed:Record<FactField,Array<FactBasis|null>>={buy:['unit'],batch:['batch'],pieces:['batch'],waste:['share'],post:['order'],pay:['unit','order'],helpers:['month'],units:['order'],trading_start:[null],single_item_orders:['order'],other_expense:['month'],owner_hours:['month'],coverage_complete:['month']};
 if(!allowed[fact.field].includes(fact.basis))throw new Error('Invalid fact basis.');
 const monetary=['buy','batch','post','pay','helpers','other_expense','coverage_complete'].includes(fact.field);if(monetary!==Boolean(fact.currency))throw new Error('Invalid fact currency.');
 if(['helpers','trading_start','other_expense','owner_hours','coverage_complete'].includes(fact.field)){if(fact.productId!==null)throw new Error('Invalid fact scope.');}else if(!fact.productId)throw new Error('Invalid fact scope.');
 if(fact.state==='confirmed'&&(fact.field==='trading_start'?typeof fact.value!=='string'||!dateValid(fact.value):typeof fact.value!=='number'&&!isAmountRange(fact.value)))throw new Error('Invalid confirmed value.');
 if((fact.field==='pieces'||fact.field==='units')&&fact.state==='confirmed'&&(typeof fact.value==='number'?(!Number.isSafeInteger(fact.value)||fact.value<1):!isAmountRange(fact.value)||!Number.isSafeInteger(fact.value.min)||!Number.isSafeInteger(fact.value.max)||fact.value.min<1))throw new Error('Invalid quantity or batch yield.');
 if(fact.state!=='confirmed'&&fact.value!==null)throw new Error('Unknown facts cannot contain values.');
 if(fact.state==='not_applicable'&&!['post','pay','helpers','other_expense','coverage_complete'].includes(fact.field))throw new Error('Not applicable is invalid for this fact.');
 if(['other_expense','owner_hours','coverage_complete'].includes(fact.field)){const month=fact.validFrom.slice(0,7),last=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);if(fact.validFrom!==month+'-01'||fact.validTo!==last)throw new Error('A period fact must cover one calendar month.');}
 if(fact.field==='coverage_complete'&&(fact.state!=='confirmed'||fact.value!==1||!fact.sourceIds?.length))throw new Error('Coverage requires explicit source confirmation.');
 if(fact.field==='single_item_orders'&&(fact.state!=='confirmed'||fact.value!==1||!fact.sourceIds?.length))throw new Error('Invalid order attribution confirmation.');
 if(fact.field==='waste'&&(typeof fact.value==='number'?fact.value>1:isAmountRange(fact.value)&&fact.value.max>1))throw new Error('Invalid waste fraction.');
 const prior=facts.find(x=>x.operationId===fact.operationId);if(prior){if(JSON.stringify(prior)!==JSON.stringify(fact))throw new Error('Operation conflict.');return facts;}
 if(facts.some(x=>x.id===fact.id))throw new Error('Fact already exists.');
 for(const id of fact.supersedes){const target=facts.find(x=>x.id===id);if(!target||target.businessId!==fact.businessId||target.productId!==fact.productId||target.field!==fact.field||(target.basis!==fact.basis&&fact.field!=='pay')||target.currency!==fact.currency)throw new Error('Invalid correction target.');}
 return [...facts,fact];
}
/** A correction supersedes its targets only during its own effective interval. */
export function resolveFact(facts:Fact[],scope:{businessId:string;productId:string|null;field:FactField;currency:string|null;basis:FactBasis|null;date:string}):FactResolution{
 if(!dateValid(scope.date))throw new Error('Invalid effective date.');
 const eligible=facts.filter(f=>f.businessId===scope.businessId&&f.productId===scope.productId&&f.field===scope.field&&f.currency===scope.currency&&f.validFrom<=scope.date&&(f.validTo===null||f.validTo>=scope.date));
 const superseded=new Set(eligible.flatMap(f=>f.supersedes));const active=eligible.filter(f=>f.basis===scope.basis&&!superseded.has(f.id));if(!active.length)return {state:'missing'};
 const values=new Set(active.map(f=>JSON.stringify([f.state,f.value])));return values.size>1?{state:'contested',facts:active}:{state:'resolved',fact:active[0],facts:active};
}
