/** One sandbox-only PayPal payment-link probe. The receipt prevents blind retries. */
import { createHash, randomUUID } from 'node:crypto';
import { closeSync, existsSync, fsyncSync, openSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { pathToFileURL } from 'node:url';

const base = 'https://api-m.sandbox.paypal.com';
const payload = { integration_mode: 'LINK', type: 'BUY_NOW', reusable: 'MULTIPLE', line_items: [{ name: 'WTES probe', unit_amount: { currency_code: 'GBP', value: '1.00' } }] };
async function safeError(response, secrets) {
  let body;
  try { body = await response.json(); } catch { return undefined; }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return undefined;
  const clean = value => {
    if (typeof value !== 'string') return undefined;
    let result = value.slice(0, 1000);
    for (const secret of secrets) if (secret) result = result.split(secret).join('[redacted]');
    return result.replace(/\bBearer\s+\S+/gi, '[redacted]').replace(/\b[^\s@]+@[^\s@]+\b/g, '[redacted]').replace(/https?:\/\/\S+/gi, '[redacted]').slice(0, 500);
  };
  const error = Object.fromEntries(['name', 'message', 'debug_id'].flatMap(key => { const value = clean(body[key]); return value ? [[key, value]] : []; }));
  if (Array.isArray(body.details)) error.details = body.details.slice(0, 10).map(detail => Object.fromEntries(['field', 'issue', 'description'].flatMap(key => { const value = clean(detail?.[key]); return value ? [[key, value]] : []; }))).filter(detail => Object.keys(detail).length);
  return Object.keys(error).length ? error : undefined;
}
function save(path, receipt) {
  const temp = path + '.tmp';
  const fd = openSync(temp, 'w', 0o600);
  try { writeFileSync(fd, JSON.stringify(receipt, null, 2)); fsyncSync(fd); } finally { closeSync(fd); }
  renameSync(temp, path);
}
export async function probePaymentLink({ clientId, clientSecret, receiptPath, confirmed, fetcher = fetch }) {
  if (!confirmed || !clientId || !clientSecret || !receiptPath || !isAbsolute(receiptPath)) throw new Error('Supply sandbox credentials, --confirm and an absolute --receipt path.');
  const lock = receiptPath + '.lock';
  const lockFd = openSync(lock, 'wx', 0o600);
  try {
    const accountHash = createHash('sha256').update(clientId).digest('hex');
    if (existsSync(receiptPath)) {
      const prior = JSON.parse(readFileSync(receiptPath, 'utf8'));
      if (prior.accountHash !== accountHash) throw new Error('Receipt belongs to another account.');
      throw new Error('Receipt already exists. Inspect and reconcile the sandbox before any further action.');
    }
    const auth = await fetcher(base + '/v1/oauth2/token', { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials' });
    if (!auth.ok) throw new Error(`Sandbox authentication failed (${auth.status}).`);
    const { access_token: access } = await auth.json();
    if (!access) throw new Error('Sandbox authentication returned no token.');
    const receipt = { version: 1, accountHash, requestId: randomUUID(), create: 'pending', delete: 'not_started' };
    save(receiptPath, receipt);
    const create = await fetcher(base + '/v1/checkout/payment-resources', { method: 'POST', headers: { Authorization: `Bearer ${access}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': receipt.requestId }, body: JSON.stringify(payload) });
    if (!create.ok) { receipt.createStatus = create.status; receipt.create = 'not_confirmed'; receipt.createError = await safeError(create, [clientId, clientSecret, access]); save(receiptPath, receipt); throw new Error(`Create not confirmed (${create.status}); inspect receipt and sandbox before retrying.`); }
    const body = await create.json();
    if (typeof body.id !== 'string' || !/^[A-Za-z0-9-]+$/.test(body.id)) throw new Error('Create response has no usable ID; inspect sandbox before retrying.');
    receipt.id = body.id; receipt.create = 'confirmed'; receipt.createStatus = create.status;
    receipt.responseFields = Object.keys(body).sort();
    receipt.delete = 'pending'; save(receiptPath, receipt);
    const removed = await fetcher(base + '/v1/checkout/payment-resources/' + encodeURIComponent(body.id), { method: 'DELETE', headers: { Authorization: `Bearer ${access}` } });
    receipt.deleteStatus = removed.status; receipt.delete = removed.status === 204 ? 'confirmed' : 'not_confirmed'; if (!removed.ok) receipt.deleteError = await safeError(removed, [clientId, clientSecret, access]); save(receiptPath, receipt);
    if (receipt.delete !== 'confirmed') throw new Error(`Delete not confirmed (${removed.status}); inspect ID ${body.id} in sandbox.`);
    return receipt;
  } finally { closeSync(lockFd); unlinkSync(lock); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const i = process.argv.indexOf('--receipt');
  probePaymentLink({ clientId: process.env.PAYPAL_SANDBOX_CLIENT_ID, clientSecret: process.env.PAYPAL_SANDBOX_CLIENT_SECRET, receiptPath: i < 0 ? undefined : process.argv[i + 1], confirmed: process.argv.includes('--confirm') }).then(r => console.log(`Probe created and deleted: ${r.id}; receipt ${process.argv[i + 1]}`)).catch(e => { console.error(e.message); process.exitCode = 1; });
}
