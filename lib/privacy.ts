import type { Analysis, Txn } from './types';
// A non-reversible identifier only used to match a buyer inside this browser session.
// The raw input is discarded immediately. This intentionally avoids sending it server-side.
export const buyerKey = (value:string) => { let h=2166136261; for (const c of `wtes-v1:${value.trim().toLowerCase()}`) { h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return `b_${(h>>>0).toString(16)}`; };
export function aiPayload(a: Analysis) { return { currency:a.currency, period:a.period, money_map:a.money_map, buyers:a.buyers, item_groups:a.item_groups, ranked_leaks:a.ranked_leaks, quick_win:a.quick_win, small_leaks:a.small_leaks }; }
export function assertNoPersonalData(value:unknown) { const json=JSON.stringify(value); if (/@|example\.com|buyer_key|from email|buyer email/i.test(json)) throw new Error('Personal data must not enter an AI payload.'); }
export function redactTransactions(rows:Txn[]) { return rows.map(({buyer_key, ...row}) => row); }
