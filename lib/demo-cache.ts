import type {Analysis} from './types';
import {aggregateSchema,readAggregate,templateRead,validateRead,type ReadAggregate} from './read';
import reviewed from './demo-read.json';
export type DemoModelCache={aggregate:ReadAggregate;read:string;model:string;validatedOn:string;validationCall:number};
// Synthetic response from call 10, reviewed for facts and playbook alignment.
export function getDemoCache():DemoModelCache|null {const aggregate=aggregateSchema.safeParse(reviewed.aggregate);return aggregate.success?{...reviewed,aggregate:aggregate.data}:null;}
export function demoReadWithSource(a:Analysis):{read:string;read_source:'cached_model'|'template'}{
 const aggregate=readAggregate(a),cache=getDemoCache();
 if(cache&&JSON.stringify(cache.aggregate)===JSON.stringify(aggregate)&&validateRead(cache.read,aggregate))return {read:`For this sample shop: ${cache.read}`,read_source:'cached_model'};
 return {read:`For this sample shop: ${templateRead(aggregate)}`,read_source:'template'};
}
