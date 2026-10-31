import raw from '../playbook.json';
import {z} from 'zod';
export const cardDraftSchema=z.object({id:z.string().regex(/^[a-z_]+$/),title:z.string().min(1).max(160),text:z.string().min(1).max(1500),placeholders:z.array(z.enum(['sign_up_link','shop_link','item_one','item_two','set_link'])).max(5)}).strict();
export type CardDraft=z.infer<typeof cardDraftSchema>;
export function cardDrafts(id:string):CardDraft[] {
 const entry=(raw.leaks as unknown as Array<{id:string;lesson?:{drafts?:unknown[]}}>).find(x=>x.id===id);
 if(!entry?.lesson?.drafts)return [];
 return entry.lesson.drafts.map(value=>cardDraftSchema.parse(value));
}
/** Browser-only substitution; never send these values back to the draft API. */
export function fillCardDraft(draft:CardDraft,values:Record<string,string>):string {
 return draft.text.replace(/\{([a-z_]+)\}/g,(placeholder,key:string)=>draft.placeholders.includes(key as CardDraft['placeholders'][number])&&typeof values[key]==='string'&&values[key].trim()?values[key].trim():placeholder);
}
