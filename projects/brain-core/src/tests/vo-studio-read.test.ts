import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  getProjects,
  getAccounts,
  getPipelineProfiles,
  getContentItems,
  getContentItem,
  getPackage,
  getAccountAdapterMode,
  getAccountQuotaState,
} from '../adapters/vo-studio-read.js';

test('VO Studio Read Adapters', async (t) => {
  await t.test('getProjects returns all projects with brands', () => {
    const response = getProjects();

    assert.ok(response.projects);
    assert.ok(response.brands);
    assert(response.projects.length > 0);
    assert(response.brands.length > 0);

    const project = response.projects[0];
    if (project) {
      assert.equal(project.name, 'YeshuaAcademy.com Main Channel');
      assert.equal(project.status, 'active');
      assert.ok(project.brandProfileId);
    }

    const brand = response.brands[0];
    if (brand) {
      assert.equal(brand.brandLine, 'YeshuaAcademy.com');
      assert.equal(brand.labelText, 'BIBLE STUDY');
      assert.equal(brand.accentColor, '#F5C842');
    }
  });

  await t.test('getProjects converts snake_case to camelCase', () => {
    const response = getProjects();
    const project = response.projects[0];
    assert.ok(project, 'project should exist');

    // Verify camelCase conversion
    assert.ok('brandProfileId' in project);
    assert.ok('createdAt' in project);
  });

  await t.test('getAccounts returns filtered accounts and platform specs', () => {
    const response = getAccounts('proj-yeshua-main');

    assert.ok(response.accounts);
    assert.ok(response.platforms);
    assert(response.accounts.length > 0);
    assert(response.platforms.length >= 3); // YouTube, Facebook, TikTok

    // All accounts should be for the requested project
    for (const account of response.accounts) {
      assert.equal(account.projectId, 'proj-yeshua-main');
    }
  });

  await t.test('getAccounts exposes adapter mode and credential state', () => {
    const response = getAccounts('proj-yeshua-main');

    const youtubeAccount = response.accounts.find((a) => a.platformId === 'youtube');
    assert.ok(youtubeAccount);
    if (youtubeAccount) {
      assert.equal(youtubeAccount.adapterMode, 'direct');
      assert.equal(youtubeAccount.credentialState, 'configured');
    }

    const facebookAccount = response.accounts.find((a) => a.platformId === 'facebook');
    assert.ok(facebookAccount);
    if (facebookAccount) {
      assert.equal(facebookAccount.adapterMode, 'n8n-dispatch');
      assert.equal(facebookAccount.credentialState, 'configured');
    }

    const tiktokAccount = response.accounts.find((a) => a.platformId === 'tiktok');
    assert.ok(tiktokAccount);
    if (tiktokAccount) {
      assert.equal(tiktokAccount.credentialState, 'missing');
      assert.equal(tiktokAccount.adapterMode, 'manual-only');
    }
  });

  await t.test('getAccounts exposes quota state', () => {
    const response = getAccounts('proj-yeshua-main');

    const youtubeAccount = response.accounts.find((a) => a.platformId === 'youtube');
    assert.ok(youtubeAccount);
    if (youtubeAccount) {
      assert.equal(youtubeAccount.quotaRemaining, 9500);
      assert.ok(youtubeAccount.quotaResetAt);
    }

    const facebookAccount = response.accounts.find((a) => a.platformId === 'facebook');
    assert.ok(facebookAccount);
    if (facebookAccount) {
      assert.equal(facebookAccount.quotaRemaining, null);
      assert.equal(facebookAccount.quotaResetAt, null);
    }
  });

  await t.test('getPipelineProfiles returns profiles and formats', () => {
    const response = getPipelineProfiles('proj-yeshua-main');

    assert.ok(response.profiles);
    assert.ok(response.formats);
    assert(response.profiles.length > 0);
    assert(response.formats.length > 0);

    const profile = response.profiles[0];
    assert.ok(profile);
    assert.ok(profile.stages.length > 0);
    assert.ok(profile.targetPlatforms.length > 0);

    const format = response.formats[0];
    assert.ok(format);
    assert.equal(typeof format.width, 'number');
    assert.equal(typeof format.height, 'number');
    assert.ok(format.platforms.length > 0);
  });

  await t.test('getContentItems returns items paginated', () => {
    const response = getContentItems('proj-yeshua-main', 10, 0);

    assert.ok(response.items);
    assert.ok(typeof response.count === 'number');
    assert(response.items.length > 0);
    assert.equal(response.count, 3); // fixture has 3 items

    const item = response.items[0];
    assert.ok(item);
    assert.equal(item.projectId, 'proj-yeshua-main');
    assert.ok(item.title);
    assert.ok(item.sourceAudioPath);
  });

  await t.test('getContentItems respects limit and offset', () => {
    const page1 = getContentItems('proj-yeshua-main', 2, 0);
    const page2 = getContentItems('proj-yeshua-main', 2, 2);

    assert.equal(page1.items.length, 2);
    assert.equal(page1.count, 3);

    if (page2.count > 2) {
      assert(page2.items.length > 0);
      const item1 = page1.items[0];
      const item2 = page2.items[0];
      if (item1 && item2) {
        assert.notEqual(item1.id, item2.id);
      }
    }
  });

  await t.test('getContentItem returns single item by ID', () => {
    const item = getContentItem('proj-yeshua-main', 'item-gen-01');

    assert.ok(item);
    assert.equal(item?.id, 'item-gen-01');
    assert.equal(item?.title, 'Genesis 1 - Creation & Beginning');
    assert.equal(item?.status, 'published');
  });

  await t.test('getContentItem returns null for non-existent item', () => {
    const item = getContentItem('proj-yeshua-main', 'nonexistent');
    assert.equal(item, null);
  });

  await t.test('getContentItem returns null for wrong project', () => {
    const item = getContentItem('wrong-project', 'item-gen-01');
    assert.equal(item, null);
  });

  await t.test('getPackage returns package with all nested data', () => {
    const pkg = getPackage('proj-yeshua-main', 'pkg-gen-01-yt-fb');

    assert.ok(pkg);
    assert.equal(pkg?.id, 'pkg-gen-01-yt-fb');
    assert.equal(pkg?.status, 'published');
    assert.equal(pkg?.stage, 'completed');

    // Check artifacts
    assert.ok(pkg?.artifacts);
    if (pkg?.artifacts) {
      assert.equal(pkg.artifacts.length, 2);
      const art0 = pkg.artifacts[0];
      const art1 = pkg.artifacts[1];
      if (art0) assert.equal(art0.type, 'thumbnail');
      if (art0) assert.equal(art0.active, true);
      if (art1) assert.equal(art1.active, false);
    }

    // Check approvals
    assert.ok(pkg?.approvals);
    if (pkg?.approvals) {
      assert.equal(pkg.approvals.length, 1);
      const appr = pkg.approvals[0];
      if (appr) {
        assert.equal(appr.type, 'thumbnail');
        assert.equal(appr.status, 'approved');
      }
    }

    // Check posting targets
    assert.ok(pkg?.postingTargets);
    if (pkg?.postingTargets) {
      assert.equal(pkg.postingTargets.length, 2);
      const youtubeTarget = pkg.postingTargets.find((t) => t.platformId === 'youtube');
      assert.ok(youtubeTarget);
      if (youtubeTarget) {
        assert.equal(youtubeTarget.status, 'published');
        assert.ok(youtubeTarget.publishedUrl);
      }
    }

    // Check audit events
    assert.ok(pkg?.auditEvents);
    if (pkg?.auditEvents) {
      assert.equal(pkg.auditEvents.length, 2);
      const evt = pkg.auditEvents[0];
      if (evt) assert.equal(evt.eventType, 'job_started');
    }
  });

  await t.test('getPackage returns null for non-existent package', () => {
    const pkg = getPackage('proj-yeshua-main', 'nonexistent');
    assert.equal(pkg, null);
  });

  await t.test('getAccountAdapterMode returns mode and credential state', () => {
    const mode = getAccountAdapterMode('proj-yeshua-main', 'acc-yt-yeshua');

    assert.ok(mode);
    assert.equal(mode?.mode, 'direct');
    assert.equal(mode?.credentialState, 'configured');
  });

  await t.test('getAccountAdapterMode handles missing account', () => {
    const mode = getAccountAdapterMode('proj-yeshua-main', 'nonexistent');
    assert.equal(mode, null);
  });

  await t.test('getAccountAdapterMode shows manual-only for missing credentials', () => {
    const mode = getAccountAdapterMode('proj-yeshua-main', 'acc-tiktok-yeshua-disabled');

    assert.ok(mode);
    if (mode) {
      assert.equal(mode.mode, 'manual-only');
      assert.equal(mode.credentialState, 'missing');
    }
  });

  await t.test('getAccountQuotaState returns quota information', () => {
    const quota = getAccountQuotaState('proj-yeshua-main', 'acc-yt-yeshua');

    assert.ok(quota);
    if (quota) {
      assert.equal(quota.remaining, 9500);
      assert.ok(quota.resetAt);
    }
  });

  await t.test('getAccountQuotaState handles null quota (no per-request limit)', () => {
    const quota = getAccountQuotaState('proj-yeshua-main', 'acc-fb-yeshua');

    assert.ok(quota);
    if (quota) {
      assert.equal(quota.remaining, null);
      assert.equal(quota.resetAt, null);
    }
  });

  await t.test('getAccountQuotaState returns null for non-existent account', () => {
    const quota = getAccountQuotaState('proj-yeshua-main', 'nonexistent');
    assert.equal(quota, null);
  });

  await t.test('All responses use camelCase (not snake_case)', () => {
    const projects = getProjects();
    for (const project of projects.projects) {
      assert.ok('brandProfileId' in project);
      assert.ok(!('brand_profile_id' in project));
    }

    const accounts = getAccounts('proj-yeshua-main');
    for (const account of accounts.accounts) {
      assert.ok('platformId' in account);
      assert.ok(!('platform_id' in account));
      assert.ok('adapterMode' in account);
      assert.ok(!('adapter_mode' in account));
    }
  });

  await t.test('Filtering by project ID works correctly', () => {
    const accounts1 = getAccounts('proj-yeshua-main');
    const accounts2 = getAccounts('nonexistent-project');

    assert(accounts1.accounts.length > 0);
    assert.equal(accounts2.accounts.length, 0);

    const items1 = getContentItems('proj-yeshua-main');
    const items2 = getContentItems('nonexistent-project');

    assert(items1.items.length > 0);
    assert.equal(items2.items.length, 0);
  });
});
