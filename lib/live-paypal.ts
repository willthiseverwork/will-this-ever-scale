/** Server-only, deliberately unconnected live Transaction Search adapter.
 * The caller must establish merchant ownership and a PayPal-approved grant before use.
 */
const LIVE_ORIGIN = 'https://api-m.paypal.com';
const DAY = 86_400_000;
export type TransactionInfo = Record<string, unknown> & { transaction_id?: string; transaction_event_code?: string; transaction_initiation_date?: string; transaction_updated_date?: string };
export type LiveTransaction = { transaction_info: TransactionInfo };
export type TransactionPage = { transactions: LiveTransaction[]; totalPages: number };
export interface LiveTransactionReader { page(start: Date, end: Date, page: number): Promise<TransactionPage> }
export type LiveGrant = { accessToken: string; merchantBindingVerified: boolean; transactionReadGranted: boolean };

/** No credentials are obtained or stored here; there is no public route to this adapter. */
export function createLiveTransactionReader(options: { enabled: boolean; grant: LiveGrant; fetcher?: typeof fetch }): LiveTransactionReader {
  return { async page(start, end, page) {
    if (!options.enabled || !options.grant.merchantBindingVerified || !options.grant.transactionReadGranted || !options.grant.accessToken) throw new Error('Live PayPal access is not configured and verified.');
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end.getTime() <= start.getTime() || end.getTime() - start.getTime() > 31 * DAY || !Number.isSafeInteger(page) || page < 1 || page > 1000) throw new Error('Invalid transaction window or page.');
    const query = new URLSearchParams({ start_date: start.toISOString(), end_date: end.toISOString(), fields: 'transaction_info', page_size: '500', page: String(page) });
    const response = await (options.fetcher || fetch)(`${LIVE_ORIGIN}/v1/reporting/transactions?${query}`, { method: 'GET', headers: { Authorization: `Bearer ${options.grant.accessToken}` }, cache: 'no-store', redirect: 'error' });
    if (!response.ok) throw new Error(`PayPal transaction read failed (${response.status}).`);
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object') throw new Error('Invalid PayPal transaction page.');
    const data = result as Record<string, unknown>;
    const items = data.transaction_details === undefined && data.total_items === 0 ? [] : data.transaction_details;
    const totalPages = data.total_pages === undefined && data.total_items === 0 ? 1 : data.total_pages;
    if (!Array.isArray(items) || !Number.isSafeInteger(totalPages) || (totalPages as number) < 1 || (totalPages as number) > 1000 || page > (totalPages as number) || items.some(x => !x || typeof x !== 'object' || !x.transaction_info || typeof x.transaction_info !== 'object')) throw new Error('Invalid PayPal transaction page.');
    return { transactions: items as LiveTransaction[], totalPages: totalPages as number };
  }};
}
