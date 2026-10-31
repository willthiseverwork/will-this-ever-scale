import type {Analysis} from './types';
import {readAggregate,templateRead,validateRead,type ReadAggregate} from './read';
export type DemoModelCache={aggregate:ReadAggregate;read:string;model:string};
// Filled only after a real synthetic model response has passed factual review.
export function getDemoCache():DemoModelCache|null{return null;}
export function demoReadWithSource(a:Analysis):{read:string;read_source:'cached_model'|'template'}{
 const aggregate=readAggregate(a),cache=getDemoCache();
 if(cache&&JSON.stringify(cache.aggregate)===JSON.stringify(aggregate)&&validateRead(cache.read,aggregate))return {read:cache.read,read_source:'cached_model'};
 return {read:templateRead(aggregate),read_source:'template'};
}
