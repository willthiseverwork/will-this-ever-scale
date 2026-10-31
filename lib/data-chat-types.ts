/** A read-only, allowlisted intent. Never includes product names, raw rows or executable code. */
export type DataChatMetric = 'gross' | 'orders' | 'refunds' | 'fees' | 'kept';
export type DataChatPeriod = { kind:'whole' } | { kind:'month'; month:string } | { kind:'three_months'; months:[string,string,string] };
export type DataChatPlan =
  | { kind:'rank_items'; metric:'gross'|'orders'|'refunds'; period:DataChatPeriod }
  | { kind:'compare_months'; metric:DataChatMetric; months:[string,string] }
  | { kind:'summary'; metric:DataChatMetric; period:DataChatPeriod }
  | { kind:'issues'; mode:'issues'|'questions' };
export type DataChatAnswer = { status:'answer'|'clarify'|'unavailable'; text:string; sources:string[]; caveats:string[]; choices?:string[] };
