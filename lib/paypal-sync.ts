import { createHash } from 'node:crypto';
import type { LiveTransaction, LiveTransactionReader } from './live-paypal';
const DAY = 86_400_000;
export type SyncWindow = { start: string; end: string; records: LiveTransaction[] };
export type SyncResult = { status: 'complete' | 'partial'; windows: SyncWindow[]; requestedStart: string; requestedEnd: string; completedThrough: string | null; failedWindow: string | null; fetchedAt: string; invoices: 'unavailable'; reconciliation: 'requires_review' };
/** Each window is an atomic snapshot, not an append-only ledger. */
export async function collectTransactionSnapshots(reader: LiveTransactionReader, start: Date, end: Date, fetchedAt = new Date()): Promise<SyncResult> {
  if (![start, end, fetchedAt].every(d => Number.isFinite(d.getTime())) || start >= end) throw new Error('Invalid sync interval.');
  const windows: SyncWindow[] = [];
  let cursor = start.getTime();
  const result = (): SyncResult => ({ status: cursor === end.getTime() ? 'complete' : 'partial', windows, requestedStart: start.toISOString(), requestedEnd: end.toISOString(), completedThrough: windows.length ? windows[windows.length - 1].end : null, failedWindow: cursor === end.getTime() ? null : new Date(cursor).toISOString(), fetchedAt: fetchedAt.toISOString(), invoices: 'unavailable', reconciliation: 'requires_review' });
  while (cursor < end.getTime()) {
    const next = Math.min(cursor + 31 * DAY, end.getTime());
    const records: LiveTransaction[] = [];
    try {
      let pages = 1;
      for (let page = 1; page <= pages; page++) {
        const response = await reader.page(new Date(cursor), new Date(next), page);
        if (!Number.isSafeInteger(response.totalPages) || response.totalPages < 1 || response.totalPages > 1000 || (page > 1 && response.totalPages !== pages) || !Array.isArray(response.transactions)) throw new Error('Pagination changed during read.');
        pages = response.totalPages;
        records.push(...response.transactions);
      }
    } catch { return result(); }
    windows.push({ start: new Date(cursor).toISOString(), end: new Date(next).toISOString(), records });
    cursor = next;
  }
  return result();
}
/** Exact-record fingerprint only; PayPal transaction IDs are not unique. Never use this as a financial ledger key. */
export function exactObservationFingerprint(record: LiveTransaction): string {
  const canonical = (value: unknown): string => {
    if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
    if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k,v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  };
  return createHash('sha256').update(canonical(record)).digest('hex');
}

/** Storage implementations must perform one atomic compare-and-swap of the complete
 * snapshot and watermark, keyed by operationId; the same ID and payload is a no-op.
 * A failed or conflicting commit must not advance the watermark. */
export interface SnapshotCommitter {
  commitComplete(input:{operationId:string;expectedRevision:string|null;result:SyncResult}):Promise<'committed'|'already_committed'|'conflict'>;
}
export type DailySyncOutcome = {status:'committed'|'already_committed'|'conflict'|'partial'|'commit_failed';result:SyncResult};
/** Caller supplies a merchant-isolated committer and stable, merchant-scoped operation ID.
 * No retries, schedule, durable storage or provider credentials are created here. */
export async function runDailySnapshot(input:{reader:LiveTransactionReader;committer:SnapshotCommitter;operationId:string;expectedRevision:string|null;start:Date;end:Date;now?:Date}):Promise<DailySyncOutcome>{
 if(!/^[A-Za-z0-9_-]{16,128}$/.test(input.operationId)||input.expectedRevision!==null&&(typeof input.expectedRevision!=='string'||input.expectedRevision.length>256))throw new Error('Invalid sync checkpoint.');
 const start=input.start.getTime(),end=input.end.getTime(),now=(input.now||new Date()).getTime();
 if(!Number.isFinite(start)||!Number.isFinite(end)||!Number.isFinite(now)||end<=start||end>now||end-start>1098*DAY)throw new Error('Invalid bounded sync interval.');
 const result=await collectTransactionSnapshots(input.reader,input.start,input.end,new Date(now));
 if(result.status!=='complete')return {status:'partial',result};
 try {return {status:await input.committer.commitComplete({operationId:input.operationId,expectedRevision:input.expectedRevision,result}),result};} catch {return {status:'commit_failed',result};}
}
