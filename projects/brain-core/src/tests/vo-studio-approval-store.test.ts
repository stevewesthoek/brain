/**
 * vo-studio-approval-store.test.ts
 *
 * Tests for Phase 2W: VO Studio approval store — timeout, escalation,
 * and checkAndEscalateExpiredApprovals().
 *
 * Uses a temp-based approach: each test writes to the real store then
 * restores it. Tests clean up after themselves.
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { mkdtempSync, rmSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createVOApproval,
  decideVOApproval,
  readAllVOApprovals,
  readPendingVOApprovals,
  checkAndEscalateExpiredApprovals,
  getVOApprovalsPath,
} from '../adapters/vo-studio-approval-store.js';

// ── Isolation helpers ─────────────────────────────────────────────────────────
// The store writes to ~/.local/video-orchestrator/state/approvals.json.
// For test isolation we back up the existing store and restore it after each test.

const STORE_PATH = getVOApprovalsPath();

function backupStore(): string | null {
  if (!fs.existsSync(STORE_PATH)) return null;
  try {
    return fs.readFileSync(STORE_PATH, 'utf8');
  } catch {
    return null;
  }
}

function restoreStore(backup: string | null): void {
  try {
    if (backup !== null) {
      fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
      fs.writeFileSync(STORE_PATH, backup);
    } else {
      // No original store — clean up what the test wrote
      try { fs.rmSync(STORE_PATH, { force: true }); } catch { /* ignore */ }
    }
  } catch { /* ignore restore errors */ }
}

function clearStore(): void {
  // Write an empty store
  try {
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, '[]');
  } catch { /* ignore */ }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('checkAndEscalateExpiredApprovals auto-rejects expired pending approvals', () => {
  const backup = backupStore();
  clearStore();
  try {
    // Create approval with past expiry
    const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString();
    const summary = createVOApproval('content', 'proj-exp-001', { action: 'publish' });

    // Manually override the expiresAt in the store to be in the past
    const records = readAllVOApprovals();
    const idx = records.findIndex((r) => r.id === summary.id);
    if (idx !== -1) {
      const r = records[idx];
      if (r) {
        records[idx] = { ...r, expiresAt: pastExpiry };
      }
    }
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(records, null, 2));

    const result = checkAndEscalateExpiredApprovals();

    assert.ok(result.failed.includes(summary.id), 'expired approval should be in failed list');

    const updated = readAllVOApprovals().find((r) => r.id === summary.id);
    assert.equal(updated?.status, 'rejected', 'expired approval should be auto-rejected');
    assert.equal(updated?.decisionNote, 'auto_rejected_timeout');
  } finally {
    restoreStore(backup);
  }
});

test('checkAndEscalateExpiredApprovals escalates approvals expiring within 5 minutes', () => {
  const backup = backupStore();
  clearStore();
  try {
    // Create approval expiring in ~3 minutes
    const nearExpiry = new Date(Date.now() + 3 * 60 * 1000).toISOString();
    const summary = createVOApproval('content', 'proj-esc-001', { action: 'upload' });

    // Override expiresAt to near-expiry
    const records = readAllVOApprovals();
    const idx = records.findIndex((r) => r.id === summary.id);
    if (idx !== -1) {
      const r = records[idx];
      if (r) {
        records[idx] = { ...r, expiresAt: nearExpiry };
      }
    }
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(records, null, 2));

    const result = checkAndEscalateExpiredApprovals();

    assert.ok(result.escalated.includes(summary.id), 'near-expiry approval should be in escalated list');
    assert.ok(!result.failed.includes(summary.id), 'near-expiry approval should not be in failed list');

    // Status should still be pending — not auto-rejected
    const updated = readAllVOApprovals().find((r) => r.id === summary.id);
    assert.equal(updated?.status, 'pending', 'near-expiry approval should remain pending');
  } finally {
    restoreStore(backup);
  }
});

test('checkAndEscalateExpiredApprovals ignores already-decided approvals', () => {
  const backup = backupStore();
  clearStore();
  try {
    const pastExpiry = new Date(Date.now() - 60 * 1000).toISOString();
    const summary = createVOApproval('content', 'proj-decided-001', { action: 'publish' });

    // Approve it
    decideVOApproval(summary.id, 'approved');

    // Manually set expiresAt to the past (shouldn't matter since it's already decided)
    const records = readAllVOApprovals();
    const idx = records.findIndex((r) => r.id === summary.id);
    if (idx !== -1) {
      const r = records[idx];
      if (r) {
        records[idx] = { ...r, expiresAt: pastExpiry };
      }
    }
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(records, null, 2));

    const result = checkAndEscalateExpiredApprovals();

    assert.ok(!result.failed.includes(summary.id), 'already-decided approval should not be in failed list');
    assert.ok(!result.escalated.includes(summary.id), 'already-decided approval should not be in escalated list');

    // Should still be approved (not re-rejected)
    const updated = readAllVOApprovals().find((r) => r.id === summary.id);
    assert.equal(updated?.status, 'approved');
  } finally {
    restoreStore(backup);
  }
});

test('checkAndEscalateExpiredApprovals ignores approvals with no expiry set', () => {
  const backup = backupStore();
  clearStore();
  try {
    const summary = createVOApproval('metadata', 'proj-noexpiry-001', { action: 'update_meta' });

    // Force-remove expiresAt from the stored record
    const records = readAllVOApprovals();
    const idx = records.findIndex((r) => r.id === summary.id);
    if (idx !== -1) {
      const r = records[idx];
      if (r) {
        const { expiresAt: _removed, ...rest } = r;
        void _removed;
        records[idx] = rest as typeof r;
      }
    }
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(records, null, 2));

    const result = checkAndEscalateExpiredApprovals();

    assert.ok(!result.failed.includes(summary.id));
    assert.ok(!result.escalated.includes(summary.id));

    const updated = readAllVOApprovals().find((r) => r.id === summary.id);
    assert.equal(updated?.status, 'pending');
  } finally {
    restoreStore(backup);
  }
});

test('checkAndEscalateExpiredApprovals returns empty lists when no approvals exist', () => {
  const backup = backupStore();
  clearStore();
  try {
    const result = checkAndEscalateExpiredApprovals();
    assert.ok(Array.isArray(result.escalated));
    assert.ok(Array.isArray(result.failed));
    assert.equal(result.escalated.length, 0);
    assert.equal(result.failed.length, 0);
  } finally {
    restoreStore(backup);
  }
});

test('decideVOApproval rejects an already-approved approval', () => {
  const backup = backupStore();
  clearStore();
  try {
    const summary = createVOApproval('thumbnail', 'proj-double-decide', { variant: 'A' });
    const first = decideVOApproval(summary.id, 'approved');
    assert.equal(first.ok, true);

    const second = decideVOApproval(summary.id, 'rejected');
    assert.equal(second.ok, false);
    assert.ok(second.error?.includes('already'), `error should mention already-decided: ${String(second.error)}`);
  } finally {
    restoreStore(backup);
  }
});

test('decideVOApproval returns error for unknown approval id', () => {
  const backup = backupStore();
  clearStore();
  try {
    const result = decideVOApproval('nonexistent-approval-xyz', 'approved');
    assert.equal(result.ok, false);
    assert.ok(result.error !== undefined);
  } finally {
    restoreStore(backup);
  }
});

test('readPendingVOApprovals filters out expired approvals', () => {
  const backup = backupStore();
  clearStore();
  try {
    // Create one fresh approval
    const fresh = createVOApproval('content', 'proj-filter-001', { action: 'create' });

    // Create one "expired" by manipulating the store
    const expired = createVOApproval('content', 'proj-filter-001', { action: 'delete' });
    const records = readAllVOApprovals();
    const idx = records.findIndex((r) => r.id === expired.id);
    if (idx !== -1) {
      const r = records[idx];
      if (r) {
        records[idx] = { ...r, expiresAt: new Date(Date.now() - 60 * 1000).toISOString() };
      }
    }
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(records, null, 2));

    const pending = readPendingVOApprovals('proj-filter-001');
    assert.ok(pending.some((r) => r.id === fresh.id), 'fresh approval should be in pending list');
    assert.ok(!pending.some((r) => r.id === expired.id), 'expired approval should not be in pending list');
  } finally {
    restoreStore(backup);
  }
});

test('multiple approvals can be created and independently decided', () => {
  const backup = backupStore();
  clearStore();
  try {
    const a1 = createVOApproval('content', 'proj-multi-001', { action: 'publish_video' });
    const a2 = createVOApproval('thumbnail', 'proj-multi-001', { action: 'upload_thumbnail' });
    const a3 = createVOApproval('metadata', 'proj-multi-001', { action: 'update_meta' });

    decideVOApproval(a1.id, 'approved');
    decideVOApproval(a2.id, 'rejected', 'bad_quality');
    // a3 left pending

    const all = readAllVOApprovals('proj-multi-001');
    assert.equal(all.length, 3);

    const r1 = all.find((r) => r.id === a1.id);
    const r2 = all.find((r) => r.id === a2.id);
    const r3 = all.find((r) => r.id === a3.id);

    assert.equal(r1?.status, 'approved');
    assert.equal(r2?.status, 'rejected');
    assert.equal(r2?.decisionNote, 'bad_quality');
    assert.equal(r3?.status, 'pending');
  } finally {
    restoreStore(backup);
  }
});
