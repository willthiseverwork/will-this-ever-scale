import {interviewCommand} from './interview-command';
import type {Field} from './voice/interview-engine';
/** A shortcut may add only its own missing field, over the displayed interval. */
export function shortcutCommand(input:Parameters<typeof interviewCommand>[0],expectedProduct:string,field:Field,end:string|null){
 const command=interviewCommand(input);if(command.product.id!==expectedProduct||command.facts.length!==1||command.facts[0].field!==field)throw new Error('This field or date needs review in Change a number.');const fact=command.facts[0];fact.validTo=end;
 if(end!==null&&end<fact.validFrom)throw new Error('Choose a valid effective interval.');
 if(input.state.facts.some(f=>f.businessId===fact.businessId&&f.productId===fact.productId&&f.field===fact.field&&f.currency===fact.currency&&f.basis===fact.basis&&f.validFrom<=(end||'9999-12-31')&&(f.validTo===null||f.validTo>=fact.validFrom)))throw new Error('An existing answer overlaps this interval. Use Change a number to review it.');
 return command;
}
