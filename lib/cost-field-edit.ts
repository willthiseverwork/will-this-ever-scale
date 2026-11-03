import {fieldOrder,type Field,type Interview} from './voice/interview-engine';
/** Select an existing question without changing any confirmed or skipped answer. */
export function costFieldIndex(interview:Interview,field:Field){const index=fieldOrder[interview.kind].indexOf(field);if(index<0)throw new Error('This question does not apply to this item.');return index;}
