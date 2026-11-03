import {createHmac} from 'node:crypto';
import {z} from 'zod';
import {workspaceProductLabel} from './workspace-types';
import {privateStatuses} from './private-status';

const hash=z.string().regex(/^b_[a-f0-9]{64}$/);
const amount=z.number().finite().min(-1e9).max(1e9);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
/** Keep product text useful while stripping the contact details PayPal can put in a subject. */
export function privateItemTitle(value:string){return value.replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+\b/gi,'').replace(/(?:https?:\/\/|www\.)\S+/gi,'').replace(/(?:\+?\d[\d\s().-]{6,}\d)/g,'').replace(/\s+/g,' ').trim().slice(0,120);}
const privateLabel=z.string().transform(privateItemTitle).pipe(workspaceProductLabel);
const row=z.object({date:day,kind:z.enum(['sale','refund','reversal','dispute','invoice_payment','subscription_payment','fee','payout','transfer','other']),gross:amount,fee:amount,net:amount,currency:z.string().regex(/^[A-Z]{3}$/),status:z.enum(privateStatuses).optional(),hold_confirmed:z.boolean().optional(),tracking_present:z.boolean().optional(),fee_known:z.boolean().optional(),fee_adjustment:z.enum(['T1108','T1109']).optional(),quantity_known:z.boolean().optional(),quantity:z.number().int().min(1).max(1e6).optional(),item_title:privateLabel.optional(),country:z.string().regex(/^[A-Z]{2,3}$/).optional(),cart_complete:z.boolean().optional(),cart_items:z.array(z.object({name:privateLabel,quantity:z.number().int().min(1).max(1e6),unit_price:amount}).strict()).max(100).optional(),buyer_key:hash.optional(),id:hash,reference_id:hash.optional(),invoice_id:hash.optional()}).strict();
export const storedUpload=z.object({id:z.string().uuid(),uploadedAt:z.string().datetime(),source:z.enum(['seller_file','sandbox']).optional(),rows:z.array(row).min(1).max(20_000)}).strict().superRefine((value,ctx)=>{if(Buffer.byteLength(JSON.stringify(value))>2*1024*1024)ctx.addIssue({code:z.ZodIssueCode.custom,message:'Upload is larger than 2 MB after privacy filtering.'});});
export type StoredUpload=z.infer<typeof storedUpload>;

export function pseudonymousId(value:string,salt:string){return createHmac('sha256',salt).update(value).digest('hex');}
