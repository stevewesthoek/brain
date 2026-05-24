import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  readVOStudioProjects,
  readVOStudioAccounts,
  readVOStudioPipelineProfiles,
  readVOStudioContentItems,
  readVOStudioPackage,
  readVOStudioAnalyticsSummary,
} from '../adapters/vo-studio-read-routes.js';

test('VO Studio Read Routes', async (t) => {
  await t.test('readVOStudioProjects returns response with summary', () => {
    const response = readVOStudioProjects();

    assert.equal(response.id, 'video-orchestrator-projects');
    assert.ok(response.generatedAt);
    assert.ok(response.items);
    assert.ok(response.brands);
    assert.ok(response.summary);
    assert.equal(typeof response.summary.total, 'number');
    assert.equal(typeof response.summary.active, 'number');
    assert.ok(response.safety);
    assert.equal(response.safety.readOnly, true);
    assert.ok(response.nextSafeStep);
  });

  await t.test('readVOStudioAccounts returns accounts with summary', () => {
    const response = readVOStudioAccounts('proj-yeshua-main');

    assert.equal(response.id, 'video-orchestrator-accounts');
    assert.equal(response.projectId, 'proj-yeshua-main');
    assert.ok(response.items);
    assert.ok(response.platforms);
    assert.ok(response.summary);
    assert.equal(typeof response.summary.total, 'number');
    assert.equal(typeof response.summary.configured, 'number');
    assert.equal(typeof response.summary.direct, 'number');
  });

  await t.test('readVOStudioAccounts uses default projectId', () => {
    const response = readVOStudioAccounts();

    assert.equal(response.projectId, 'proj-yeshua-main');
    assert(response.items.length > 0);
  });

  await t.test('readVOStudioPipelineProfiles returns profiles with summary', () => {
    const response = readVOStudioPipelineProfiles('proj-yeshua-main');

    assert.equal(response.id, 'video-orchestrator-pipeline-profiles');
    assert.equal(response.projectId, 'proj-yeshua-main');
    assert.ok(response.items);
    assert.ok(response.formats);
    assert.ok(response.summary);
    assert.equal(typeof response.summary.total, 'number');
    assert.equal(typeof response.summary.enabled, 'number');
    assert.equal(typeof response.summary.formatCount, 'number');
  });

  await t.test('readVOStudioContentItems returns paginated items', () => {
    const response = readVOStudioContentItems('proj-yeshua-main', 10, 0);

    assert.equal(response.id, 'video-orchestrator-content-items');
    assert.equal(response.projectId, 'proj-yeshua-main');
    assert.ok(response.items);
    assert.ok(response.pagination);
    assert.equal(response.pagination.limit, 10);
    assert.equal(response.pagination.offset, 0);
    assert.equal(typeof response.pagination.total, 'number');
    assert.equal(typeof response.pagination.hasMore, 'boolean');
    assert.ok(response.summary);
    assert.equal(typeof response.summary.total, 'number');
  });

  await t.test('readVOStudioContentItems respects limit and offset', () => {
    const page1 = readVOStudioContentItems('proj-yeshua-main', 2, 0);
    const page2 = readVOStudioContentItems('proj-yeshua-main', 2, 2);

    assert.equal(page1.pagination.limit, 2);
    assert.equal(page1.pagination.offset, 0);
    assert.equal(page2.pagination.limit, 2);
    assert.equal(page2.pagination.offset, 2);
  });

  await t.test('readVOStudioPackage returns package or null', () => {
    const pkg1 = readVOStudioPackage('proj-yeshua-main', 'pkg-gen-01-yt-fb');
    assert.ok(pkg1);
    assert.equal(pkg1?.id, 'pkg-gen-01-yt-fb');

    const pkg2 = readVOStudioPackage('proj-yeshua-main', 'nonexistent');
    assert.equal(pkg2, null);
  });

  await t.test('readVOStudioAnalyticsSummary returns summary with statistics', () => {
    const response = readVOStudioAnalyticsSummary('proj-yeshua-main');

    assert.equal(response.id, 'video-orchestrator-analytics-summary');
    assert.equal(response.projectId, 'proj-yeshua-main');
    assert.ok(response.summary);
    assert.equal(typeof response.summary.contentItems, 'number');
    assert.equal(typeof response.summary.published, 'number');
    assert.ok(response.platforms);
    assert(response.platforms.includes('youtube'));
    assert.ok(response.statistics);
    assert.ok(response.statistics.avgProductionTime);
  });

  await t.test('All route responses include safety metadata', () => {
    const projects = readVOStudioProjects();
    const accounts = readVOStudioAccounts();
    const profiles = readVOStudioPipelineProfiles();
    const items = readVOStudioContentItems();
    const summary = readVOStudioAnalyticsSummary();

    for (const response of [projects, accounts, profiles, items, summary]) {
      assert.ok(response.safety);
      assert.equal(response.safety.readOnly, true);
      assert.equal(response.safety.writesFiles, false);
      assert.equal(response.safety.publishesContent, false);
    }
  });

  await t.test('All route responses include nextSafeStep guidance', () => {
    const projects = readVOStudioProjects();
    const accounts = readVOStudioAccounts();
    const profiles = readVOStudioPipelineProfiles();
    const items = readVOStudioContentItems();
    const summary = readVOStudioAnalyticsSummary();

    for (const response of [projects, accounts, profiles, items, summary]) {
      assert.ok(response.nextSafeStep);
      assert(response.nextSafeStep.length > 10);
    }
  });

  await t.test('Content items summary counts match status values', () => {
    const response = readVOStudioContentItems('proj-yeshua-main', 1000, 0);

    const publishedCount = response.items.filter((i) => i.status === 'published').length;
    const inProgressCount = response.items.filter((i) => i.status === 'in_progress').length;
    const approvedCount = response.items.filter((i) => i.status === 'approved').length;

    assert.equal(response.summary.published, publishedCount);
    assert.equal(response.summary.inProgress, inProgressCount);
    assert.equal(response.summary.approved, approvedCount);
  });

  await t.test('Pagination hasMore flag is accurate', () => {
    const allItems = readVOStudioContentItems('proj-yeshua-main', 1000, 0);
    const page1 = readVOStudioContentItems('proj-yeshua-main', 2, 0);

    if (allItems.pagination.total <= 2) {
      assert.equal(page1.pagination.hasMore, false);
    } else {
      assert.equal(page1.pagination.hasMore, true);
    }
  });

  await t.test('Accounts response has platforms metadata', () => {
    const response = readVOStudioAccounts('proj-yeshua-main');

    assert.ok(response.platforms);
    assert(response.platforms.length > 0);

    for (const platform of response.platforms) {
      assert.ok(platform.id);
      assert.ok(platform.label);
      assert.equal(typeof platform.enabled, 'boolean');
    }
  });

  await t.test('Pipeline profiles response has formats metadata', () => {
    const response = readVOStudioPipelineProfiles('proj-yeshua-main');

    assert.ok(response.formats);
    assert(response.formats.length > 0);

    for (const format of response.formats) {
      assert.ok(format.id);
      assert.ok(format.label);
      assert.equal(typeof format.width, 'number');
      assert.equal(typeof format.height, 'number');
    }
  });
});
