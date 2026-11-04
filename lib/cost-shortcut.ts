import {isAmountRange} from './amount-range';
import {resolveFact,type Fact,type FactBasis,type FactField} from './business-model';
import type {SellerKind} from './cost-interview';
import type {Field} from './voice/interview-engine';

type Input={facts:Fact[];businessId:string;productId:string;currency:string;date:string;kind:SellerKind;singleItemOrders:boolean;writable:boolean};
/** Resolve the persisted, dated inputs rather than interpreting skipped interview slots as absent. */
export function costShortcut(input:Input):Field|null{
 if(!input.writable||!input.singleItemOrders)return null;
 const basis:Record<Field,FactBasis>={units:'order',buy:'unit',batch:'batch',pieces:'batch',waste:'share',post:'order',pay:'order',helpers:'month'};
 const fields:Field[]=['units',...(input.kind==='maker'?['batch','pieces','waste'] as Field[]:['buy'] as Field[]),'post','pay','helpers'];
 const results=new Map<Field,ReturnType<typeof resolveFact>>();
 for(const field of fields){const monetary=['buy','batch','post','pay','helpers'].includes(field),scope={businessId:input.businessId,productId:field==='helpers'?null:input.productId,field:field as FactField,currency:monetary?input.currency:null,date:input.date};const primary=resolveFact(input.facts,{...scope,basis:basis[field]});if(field==='pay'){const alternate=resolveFact(input.facts,{...scope,basis:'unit'});if(primary.state!=='missing'&&alternate.state!=='missing')return null;if(alternate.state!=='missing'){results.set(field,alternate);continue}}results.set(field,primary)}
 if([...results.values()].some(r=>r.state==='contested'||r.state==='resolved'&&r.facts.some(f=>f.source!=='seller_confirmed')))return null;
 const goods:Field[]=input.kind==='maker'?['units','batch','pieces','waste']:['units','buy'];
 const missing=goods.filter(f=>results.get(f)?.state==='missing');
 const waste=results.get('waste');const possibleZero=waste?.state==='resolved'&&waste.fact.state==='confirmed'&&(typeof waste.fact.value==='number'?waste.fact.value>=1:isAmountRange(waste.fact.value)&&waste.fact.value.max>=1);
 const othersResolved=goods.filter(f=>!missing.includes(f)).every(f=>{const r=results.get(f);return r?.state==='resolved'&&r.fact.state==='confirmed'});
 if(missing.length===1&&othersResolved&&!possibleZero)return missing[0];
 if(results.get('post')?.state==='missing')return 'post';
 return null;
}
