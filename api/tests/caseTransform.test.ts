/**
 * Tests for snakeToCamel utility
 * Run with: npx tsx tests/caseTransform.test.ts
 */

import assert from 'node:assert/strict';
import { snakeToCamel } from '../src/utils/caseTransform.js';

// The assertions below were written to run standalone under tsx. Wrapped in a jest test so the
// suite is actually discovered and executed — before this, `npm test` never ran it at all.
it('snakeToCamel converts keys correctly across all shapes', () => {

// --- Null / undefined / primitives pass through ---
assert.strictEqual(snakeToCamel(null), null, 'null passthrough');
assert.strictEqual(snakeToCamel(undefined), undefined, 'undefined passthrough');
assert.strictEqual(snakeToCamel(42), 42, 'number passthrough');
assert.strictEqual(snakeToCamel('hello'), 'hello', 'string passthrough');
assert.strictEqual(snakeToCamel(true), true, 'boolean passthrough');

// --- Date objects pass through unchanged ---
const d = new Date('2026-01-01');
assert.strictEqual(snakeToCamel(d), d, 'Date passthrough');

// --- Simple flat object ---
assert.deepStrictEqual(
  snakeToCamel({ organization_id: '123', created_at: '2026-01-01', name: 'Acme' }),
  { organizationId: '123', createdAt: '2026-01-01', name: 'Acme' },
  'flat object conversion'
);

// --- Nested object ---
assert.deepStrictEqual(
  snakeToCamel({ admin_info: { first_name: 'Jane', last_login: '2026-05-01' } }),
  { adminInfo: { firstName: 'Jane', lastLogin: '2026-05-01' } },
  'nested object conversion'
);

// --- Array of objects ---
assert.deepStrictEqual(
  snakeToCamel([
    { subscription_tier: 'standard', user_count: 5 },
    { subscription_tier: 'enterprise', user_count: 50 },
  ]),
  [
    { subscriptionTier: 'standard', userCount: 5 },
    { subscriptionTier: 'enterprise', userCount: 50 },
  ],
  'array of objects conversion'
);

// --- Empty object / empty array ---
assert.deepStrictEqual(snakeToCamel({}), {}, 'empty object');
assert.deepStrictEqual(snakeToCamel([]), [], 'empty array');

// --- Already camelCase keys stay unchanged ---
assert.deepStrictEqual(
  snakeToCamel({ userId: '1', firstName: 'Bob' }),
  { userId: '1', firstName: 'Bob' },
  'already camelCase'
);

// --- Multiple underscores ---
assert.deepStrictEqual(
  snakeToCamel({ is_beta_customer: true, total_cost_usd: 99.5 }),
  { isBetaCustomer: true, totalCostUsd: 99.5 },
  'multiple underscores'
);

// --- Mixed array with nulls ---
assert.deepStrictEqual(
  snakeToCamel([null, { ip_address: '1.2.3.4' }, undefined]),
  [null, { ipAddress: '1.2.3.4' }, undefined],
  'array with null/undefined entries'
);

});
