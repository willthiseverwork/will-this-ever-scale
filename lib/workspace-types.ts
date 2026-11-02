import {z} from 'zod';
const id=z.string().uuid();
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s+'T00:00:00Z'))&&new Date(s+'T00:00:00Z').toISOString().slice(0,10)===s);
const number=z.number().finite().min(-1e12).max(1e12);
const findingId=z.enum(['one_time_buyers','lapsed_buyers','items_stopped','item_jumped','best_month','unpaid_invoices','refunds_one_item','small_order_fees','cross_border_fees','one_item_dependence','below_cost_items','fewer_new_buyers','subscription_failed_payments','sets','held_money']);
const testKind=z.enum(['parcel_card','email','signup','price_plus_one','minimum_order','message_regulars','relist_item','feature_item','season_prep','refund_fix','abroad_postage','set_offer']);
const month=z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const count=z.number().int().nonnegative().max(1e9);
const monthly=z.object({month,cameIn:number,fees:number,refunds:number,costs:number,ads:number,kept:number,orders:count.optional()}).strict();
export const workspaceProductLabel=z.string().transform(s=>s.replace(/[\u0000-\u001f\u007f-\u009f]/g,'').trim()).pipe(z.string().min(1).max(120).refine(s=>!/(?:\b[^\s@]+@[^\s@]+\.[^\s@]+\b|(?:https?:\/\/|www\.)\S+|(?:\+?\d[\d\s().-]{6,}\d))/i.test(s),'Do not include contact information or URLs.')); 
const item=z.object({label:workspaceProductLabel.optional(),labelReviewed:z.literal(true).optional(),id:z.string().regex(/^item_([1-9]\d{0,2})$/),gross:number,orders:count,refunds:number}).strict().refine(x=>(x.label!==undefined)===(x.labelReviewed===true),'Review product label before saving.');
export const workspaceInput=z.object({settings:z.object({shareWorkspaceWithAssistant:z.boolean().default(false),shareProductNamesWithAssistant:z.boolean()}).strict(),revision:z.number().int().nonnegative().safe(),snapshots:z.array(z.object({id,capturedAt:z.string().datetime(),currency:z.string().regex(/^[A-Z]{3}$/),periodStart:date,periodEnd:date,periodPrecision:z.literal('month').default('month'),source:z.enum(['csv','paypal_live']),coverageGaps:z.array(z.enum(['item_costs_missing','ad_spend_missing','separate_fees_excluded','other_currencies_excluded','date_coverage_unknown'])).max(5).default(['date_coverage_unknown']),months:z.array(monthly).max(120),items:z.array(item).max(200),cameIn:number,fees:number,refunds:number,costs:number,adSpend:number,kept:number}).strict()).max(100),reminders:z.array(z.object({id,findingId,dueDate:date,kind:z.enum(['review','experiment']),status:z.enum(['open','done'])}).strict()).max(100),tests:z.array(z.object({id,findingId,testKind:testKind.optional(),answers:z.record(z.string().max(40),z.string().max(40)).optional(),checkDate:date.optional(),subject:z.array(z.string().regex(/^b_[a-f0-9]{64}$/)).max(300).optional(),startedAt:date,status:z.enum(['planned','running','completed']),baseline:number.nullable(),result:number.nullable()}).strict()).max(100),profile:z.object({shopDescription:z.string().max(240).optional(),helpersMonthly:number.optional(),items:z.record(z.string().regex(/^b_[a-f0-9]{64}$/),z.object({label:workspaceProductLabel,kind:z.enum(['maker','reseller']).optional(),answers:z.record(z.string().max(40),z.union([z.string().max(120),number])).optional(),payYourself:number.optional(),payYourselfUnit:z.enum(['per_order','per_piece']).optional()}).strict())}).strict().optional()}).strict().refine(x=>[x.snapshots,x.reminders,x.tests].every(a=>new Set(a.map(v=>v.id)).size===a.length)&&x.snapshots.every(s=>s.periodStart<=s.periodEnd&&new Set(s.items.map(i=>i.id)).size===s.items.length&&new Set(s.months.map(m=>m.month)).size===s.months.length),'Duplicate IDs');
export type WorkspaceInput=z.infer<typeof workspaceInput>;
export type Workspace=WorkspaceInput&{trialStartedAt:string|null;trialEndsAt:string|null};
export function emptyWorkspace():Workspace{return {settings:{shareWorkspaceWithAssistant:false,shareProductNamesWithAssistant:false},revision:0,snapshots:[],reminders:[],tests:[],trialStartedAt:null,trialEndsAt:null};}

/** An expired subscription must not prevent a user from withdrawing sharing. */
export function isSharingOptOutOnly(current:Workspace,input:WorkspaceInput):boolean {
 const before=current.settings,after=input.settings;
 return input.revision===current.revision &&
  (!after.shareWorkspaceWithAssistant || before.shareWorkspaceWithAssistant) &&
  (!after.shareProductNamesWithAssistant || before.shareProductNamesWithAssistant) &&
  (before.shareWorkspaceWithAssistant!==after.shareWorkspaceWithAssistant || before.shareProductNamesWithAssistant!==after.shareProductNamesWithAssistant) &&
  JSON.stringify([input.snapshots,input.reminders,input.tests])===JSON.stringify([current.snapshots,current.reminders,current.tests]);
}
