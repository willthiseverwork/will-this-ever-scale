import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { probePaymentLink } from '../scripts/probe-payment-link.mjs';

test('sandbox probe creates exactly one £1 link and deletes the returned ID', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wtes-probe-')); const receiptPath = join(dir, 'receipt.json'); const calls = [];
  const fetcher = async (url, init) => { calls.push({ url, init }); if (calls.length === 1) return Response.json({ access_token: 'test' }); if (calls.length === 2) return Response.json({ id: 'PLB-123', links: [] }, { status: 201 }); return new Response(null, { status: 204 }); };
  try {
    const result = await probePaymentLink({ clientId: 'sandbox', clientSecret: 'secret', confirmed: true, receiptPath, fetcher });
    assert.equal(result.delete, 'confirmed'); assert.equal(calls.length, 3);
    assert.equal(calls[1].url, 'https://api-m.sandbox.paypal.com/v1/checkout/payment-resources');
    assert.deepEqual(JSON.parse(calls[1].init.body).line_items, [{ name: 'WTES probe', unit_amount: { currency_code: 'GBP', value: '1.00' } }]);
    assert.equal(calls[2].url, 'https://api-m.sandbox.paypal.com/v1/checkout/payment-resources/PLB-123'); assert.equal(calls[2].init.method, 'DELETE');
    await assert.rejects(() => probePaymentLink({ clientId: 'sandbox', clientSecret: 'secret', confirmed: true, receiptPath, fetcher }), /Receipt already exists/); assert.equal(calls.length, 3);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('an uncertain create is journaled and never retried automatically', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wtes-probe-')); const receiptPath = join(dir, 'receipt.json'); let calls = 0;
  const fetcher = async () => { calls++; if (calls === 1) return Response.json({ access_token: 'test' }); throw new Error('connection lost'); };
  try {
    await assert.rejects(() => probePaymentLink({ clientId: 'sandbox', clientSecret: 'secret', confirmed: true, receiptPath, fetcher }));
    assert.equal(JSON.parse(readFileSync(receiptPath, 'utf8')).create, 'pending');
    await assert.rejects(() => probePaymentLink({ clientId: 'sandbox', clientSecret: 'secret', confirmed: true, receiptPath, fetcher }), /Receipt already exists/); assert.equal(calls, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
