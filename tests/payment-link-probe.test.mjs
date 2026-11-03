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

test('a rejected create records only sanitized allowlisted error details without retrying', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'wtes-probe-')); const receiptPath = join(dir, 'receipt.json'); let calls = 0;
  const fetcher = async () => { calls++; if (calls === 1) return Response.json({ access_token: 'access-token-private' }); return Response.json({ name: 'NOT_AUTHORIZED', message: 'Denied for client-private and Bearer access-token-private', debug_id: 'debug123', details: [{ field: '/integration_mode', issue: 'NOT_ENABLED', description: 'Unavailable for seller@example.com', value: 'secret-private' }], token: 'access-token-private', extra: 'secret-private' }, {status: 403}); };
  try {
    await assert.rejects(() => probePaymentLink({ clientId: 'client-private', clientSecret: 'secret-private', confirmed: true, receiptPath, fetcher }), /Create not confirmed \(403\)/);
    const text = readFileSync(receiptPath, 'utf8'); const receipt = JSON.parse(text);
    assert.equal(receipt.create, 'not_confirmed'); assert.equal(receipt.createStatus, 403);
    assert.deepEqual(receipt.createError, {name: 'NOT_AUTHORIZED', message: 'Denied for [redacted] and [redacted]', debug_id: 'debug123', details: [{field: '/integration_mode', issue: 'NOT_ENABLED', description: 'Unavailable for [redacted]'}]});
    for (const sensitive of ['client-private', 'secret-private', 'access-token-private', 'seller@example.com']) assert.equal(text.includes(sensitive), false);
    await assert.rejects(() => probePaymentLink({ clientId: 'client-private', clientSecret: 'secret-private', confirmed: true, receiptPath, fetcher }), /Receipt already exists/); assert.equal(calls, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
