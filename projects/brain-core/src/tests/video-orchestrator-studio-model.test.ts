import test from 'node:test';
import assert from 'node:assert/strict';
import {
  readVOStudioAccounts,
  readVOStudioAnalyticsSummary,
  readVOStudioContentItems,
  readVOStudioPackage,
  readVOStudioPipelineProfiles,
  readVOStudioProjects,
} from '../adapters/video-orchestrator-studio-model.js';

test('normalized VO studio model exposes Says the Bible as first project', () => {
  const projects = readVOStudioProjects();
  assert.equal(projects.safety.readOnly, true);
  assert.equal(projects.items[0]?.id, 'says-the-bible');
  assert.equal(projects.items[0]?.defaultPipelineProfileId, 'profile-stb-package-parity');
});

test('pipeline profile resolves target platforms and disabled direct publish stage', () => {
  const profiles = readVOStudioPipelineProfiles();
  const profile = profiles.items[0];
  assert.ok(profile, 'profile must exist');
  assert.deepEqual(profile.targetPlatforms, ['youtube', 'youtube-shorts', 'pinterest', 'facebook']);
  assert.equal(profile.enabledStages.find((stage) => stage.id === 'publish')?.status, 'disabled');
  assert.match(profile.fallbackBehavior, /manual upload package/i);
});

test('content item has one canonical source with platform variants and posting targets', () => {
  const content = readVOStudioContentItems();
  const item = content.items[0];
  assert.ok(item, 'content item must exist');
  assert.equal(item.projectId, 'says-the-bible');
  assert.equal(item.platformTargets.length, 4);
  assert.ok(item.artifactVariants.some((variant) => variant.kind === 'thumbnail' && variant.sourceTemplateId === 'template-thumbnail-unified'));
});

test('production package remains manual fallback and approval gated', () => {
  const pkg = readVOStudioPackage('pkg-stb-story-052');
  assert.ok(pkg, 'package must exist');
  assert.equal(pkg.packageType, 'manual-fallback');
  assert.equal(pkg.postingTargets.every((target) => target.mode === 'manual-package'), true);
  assert.equal(pkg.approvals.some((approval) => approval.status === 'required'), true);
});

test('accounts and analytics stay read-only and platform/account agnostic', () => {
  const accounts = readVOStudioAccounts();
  const analytics = readVOStudioAnalyticsSummary();
  assert.equal(accounts.safety.publishesContent, false);
  assert.equal(accounts.items.length >= 4, true);
  assert.equal(analytics.kpis.some((kpi) => kpi.label === 'Direct publishing' && kpi.value === 'disabled'), true);
});
