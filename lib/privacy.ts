import type { Txn } from './types';
/** A fresh salt must be shared by all files in one analysis and discarded afterwards. */
export function createBuyerSessionSalt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}
export async function buyerKey(value:string, salt:string):Promise<string> {
  if (!salt) throw new Error('A fresh session salt is required.');
  const bytes = new TextEncoder().encode(`${salt}\0${value.trim().toLowerCase()}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return `b_${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2,'0')).join('')}`;
}
export function redactTransactions(rows:Txn[]) { return rows.map(({buyer_key, ...row}) => row); }
