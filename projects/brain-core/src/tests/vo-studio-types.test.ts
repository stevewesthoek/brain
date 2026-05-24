import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  projectFromWire,
  platformAccountFromWire,
  contentItemFromWire,
  packageFromWire,
} from '../types/vo-studio.js';

test('VO Studio Types', async (t) => {
  await t.test('projectFromWire converts snake_case to camelCase', () => {
    const wire = {
      id: 'proj-123',
      name: 'YeshuaAcademy.com',
      description: 'Bible teaching channel',
      status: 'active',
      brand_profile_id: 'brand-001',
      created_at: '2026-05-24T00:00:00Z',
      updated_at: '2026-05-24T10:00:00Z',
    };

    const project = projectFromWire(wire);

    assert.equal(project.id, 'proj-123');
    assert.equal(project.name, 'YeshuaAcademy.com');
    assert.equal(project.brandProfileId, 'brand-001');
    assert.equal(project.createdAt, '2026-05-24T00:00:00Z');
    assert.equal(project.status, 'active');
  });

  await t.test('platformAccountFromWire handles optional fields', () => {
    const wire = {
      id: 'acc-123',
      project_id: 'proj-123',
      platform_id: 'youtube',
      account_handle: '@YeshuaAcademy',
      display_name: 'Yeshua Academy',
      email: null,
      credential_state: 'configured',
      adapter_mode: 'direct',
      quota_remaining: 10000,
      quota_reset_at: '2026-05-25T00:00:00Z',
      enabled_profiles: ['profile-1', 'profile-2'],
      created_at: '2026-05-24T00:00:00Z',
      last_verified_at: null,
    };

    const account = platformAccountFromWire(wire);

    assert.equal(account.id, 'acc-123');
    assert.equal(account.platformId, 'youtube');
    assert.equal(account.credentialState, 'configured');
    assert.equal(account.quotaRemaining, 10000);
    assert.equal(account.email, null);
    assert.equal(account.lastVerifiedAt, null);
    assert.deepEqual(account.enabledProfiles, ['profile-1', 'profile-2']);
  });

  await t.test('contentItemFromWire sets language default', () => {
    const wire = {
      id: 'item-123',
      project_id: 'proj-123',
      title: 'Genesis Chapter 1',
      description: 'Overview of creation',
      status: 'in_progress',
      source_audio_path: '/sources/genesis-01.mp3',
      background_image_path: '/sources/series-bg.jpg',
      duration_sec: 1800,
      // no language provided — should default
      created_at: '2026-05-24T00:00:00Z',
      updated_at: '2026-05-24T10:00:00Z',
    };

    const item = contentItemFromWire(wire);

    assert.equal(item.id, 'item-123');
    assert.equal(item.language, 'en');
    assert.equal(item.durationSec, 1800);
    assert.equal(item.status, 'in_progress');
  });

  await t.test('packageFromWire converts nested artifacts with defaults', () => {
    const wire = {
      id: 'pkg-123',
      content_item_id: 'item-123',
      project_id: 'proj-123',
      pipeline_profile_id: 'pipe-123',
      status: 'approved',
      stage: 'completed',
      artifacts: [
        {
          id: 'variant_a',
          type: 'thumbnail',
          path: '/output/thumb-a.jpg',
          metadata: { template: 'bold-text', active: true },
          active: true,
        },
        {
          id: 'composition_1920x1080',
          type: 'composition',
          path: '/output/video-1920x1080.mp4',
          // no metadata provided — should default to empty
          // no active provided — should default to false
        },
      ],
      approvals: [
        {
          id: 'appr-123',
          package_id: 'pkg-123',
          type: 'metadata',
          status: 'approved',
          required_fields: ['title', 'description'],
          approved_by: 'operator@example.com',
          rejected_by: null,
          requested_at: '2026-05-24T08:00:00Z',
          responded_at: '2026-05-24T09:00:00Z',
          notes: 'Looks good',
        },
      ],
      posting_targets: [],
      audit_events: [],
      created_at: '2026-05-24T00:00:00Z',
      updated_at: '2026-05-24T10:00:00Z',
      approved_at: '2026-05-24T09:00:00Z',
      published_at: null,
    };

    const pkg = packageFromWire(wire);

    assert.equal(pkg.id, 'pkg-123');
    assert.equal(pkg.status, 'approved');
    assert.equal(pkg.artifacts.length, 2);
    const artifact0 = pkg.artifacts[0];
    const artifact1 = pkg.artifacts[1];
    if (artifact0) {
      assert.equal(artifact0.id, 'variant_a');
      assert.equal(artifact0.active, true);
    }
    if (artifact1) {
      assert.equal(artifact1.active, false);
      assert.deepEqual(artifact1.metadata, {});
    }
    assert.equal(pkg.approvals.length, 1);
    const approval = pkg.approvals[0];
    if (approval) {
      assert.equal(approval.type, 'metadata');
    }
    assert.equal(pkg.publishedAt, null);
  });

  await t.test('packageFromWire handles empty nested arrays', () => {
    const wire = {
      id: 'pkg-456',
      content_item_id: 'item-456',
      project_id: 'proj-123',
      pipeline_profile_id: 'pipe-123',
      status: 'queued',
      stage: 'pending',
      // no artifacts, approvals, posting_targets, audit_events
      created_at: '2026-05-24T00:00:00Z',
      updated_at: '2026-05-24T00:00:00Z',
      approved_at: null,
      published_at: null,
    };

    const pkg = packageFromWire(wire);

    assert.deepEqual(pkg.artifacts, []);
    assert.deepEqual(pkg.approvals, []);
    assert.deepEqual(pkg.postingTargets, []);
    assert.deepEqual(pkg.auditEvents, []);
  });

  await t.test('all status type literals are valid', () => {
    const project = projectFromWire({
      id: 'test',
      name: 'Test',
      description: 'Test',
      status: 'archived', // test the archive status
      brand_profile_id: 'brand',
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });
    assert.equal(project.status, 'archived');

    const account = platformAccountFromWire({
      id: 'test',
      project_id: 'proj',
      platform_id: 'youtube',
      account_handle: 'test',
      display_name: 'Test',
      credential_state: 'expired', // test expired state
      adapter_mode: 'manual-only', // test manual-only mode
      created_at: '2026-01-01T00:00:00Z',
      enabled_profiles: [],
    });
    assert.equal(account.credentialState, 'expired');
    assert.equal(account.adapterMode, 'manual-only');
  });
});
