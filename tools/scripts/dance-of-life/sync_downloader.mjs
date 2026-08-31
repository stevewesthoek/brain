#!/usr/bin/env bun
/**
 * sync_downloader.mjs — Dance of Life Library sync: source → Google Drive
 *
 * ARCHITECTURE (important — read before modifying):
 *
 *   Source:       sync.com shared folder (E2E encrypted, ~500 GB)
 *   Intermediary: this Mac (temporary download staging only)
 *   Destination:  Google Drive  ←  this is the permanent home of all files
 *
 *   Flow per file:
 *     1. Download from sync.com → local Mac disk  (temporary)
 *     2. Google Drive macOS app detects new file, uploads it to Google Drive
 *     3. Once uploaded, you can offload the local copy via:
 *        Finder → right-click → "Make available online only"
 *        This frees local disk but keeps the file on Google Drive.
 *        Offloaded files appear as 0-byte stubs locally, with the
 *        `com.google.drivefs.item-id` xattr set by the Drive app.
 *
 * COMPARISON LOGIC:
 *   Source (sync.com) is compared against GOOGLE DRIVE, not local disk.
 *   A file is considered "done" when it is confirmed on Google Drive,
 *   detected via the `com.google.drivefs.item-id` xattr on the local stub.
 *   DO NOT treat 0-byte local stubs as missing — they are offloaded Drive files.
 *
 * NIGHTLY BEHAVIOUR (FORCE_RESCAN=1, the default):
 *   - Rescans the source folder tree to detect new files added upstream.
 *   - Compares source manifest against Google Drive.
 *   - Downloads ONLY new files not yet on Google Drive.
 *   - Never re-downloads files already on Google Drive, even if offloaded locally.
 *   - Preserves all existing files on Google Drive (no deletes, ever).
 *
 * SOURCE AVAILABILITY:
 *   If the sync.com link is unreachable, expired, or returns 0 items, the script
 *   exits with a fatal error so an explicit operator session can surface the
 *   failure. The production Brain Scheduler does not invoke this blocked job.
 *
 * Usage:
 *   bun sync_downloader.mjs              # normal run / resume
 *   FORCE_RESCAN=1 bun sync_downloader.mjs  # rebuild source manifest (default for nightly)
 *
 * Called by:  ../dance-of-life-sync.sh  (which sets FORCE_RESCAN=1 by default)
 *
 * Disk management:
 *   - Script pauses when free space < MIN_FREE_GB (needed as staging buffer)
 *   - To free space after upload: Finder → right-click file → "Make available online only"
 *
 * State:  ~/.local/state/dance-of-life/state.json  (persistent between runs)
 * Log:    ~/Library/Logs/office-scheduler/dance-of-life.log
 */

import { chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';
import * as os from 'os';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const C = {
  baseUrl:    'https://ln5.sync.com/dl/8cd2a10a0',
  rootId:     '16714321270009',
  key:        '#j6eaxvtw-p6bejis7-qpswiw7h-9wbzk3vm',
  pubId:      '8cd2a10a0',
  dest:       '/Users/Office/Library/CloudStorage/GoogleDrive-info@prochat.tools/My Drive/Bible Study/Dance of Life/Bible Studies',
  minFreeGB:  20,
  stateFile:  path.join(os.homedir(), '.local/state/dance-of-life/state.json'),
  logFile:    path.join(os.homedir(), 'Library/Logs/office-scheduler/dance-of-life.log'),
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString().slice(11,19)}] ${msg}`;
  console.log(line);
  fs.mkdirSync(path.dirname(C.logFile), { recursive: true });
  fs.appendFileSync(C.logFile, line + '\n');
}

function getFreeGB() {
  try {
    const out = execSync(`df -k "${C.dest}" 2>/dev/null || df -k /`, { encoding: 'utf8' });
    const lines = out.trim().split('\n');
    const parts = lines[lines.length - 1].trim().split(/\s+/);
    return parseInt(parts[3]) / (1024 * 1024);
  } catch { return 999; }
}

async function waitForSpace() {
  while (true) {
    const gb = getFreeGB();
    if (gb >= C.minFreeGB) return;
    log(`⏳ Only ${gb.toFixed(1)}GB free (need ${C.minFreeGB}GB). Waiting 2 min…`);
    log('   → In Finder, right-click uploaded files → "Make available online only"');
    await new Promise(r => setTimeout(r, 120_000));
  }
}

function fileOnGDrive(p) {
  if (!fs.existsSync(p)) return false;

  // Check for the Google Drive item ID xattr FIRST.
  // Offloaded files ("Make available online only") have 0 bytes locally but keep this xattr.
  // They ARE on Google Drive and must NEVER be re-downloaded.
  try {
    const id = execSync(`xattr -p com.google.drivefs.item-id "${p}" 2>/dev/null`, { encoding: 'utf8' }).trim();
    if (id) return true; // Confirmed on Google Drive — may be fully local or offloaded (0 bytes)
  } catch { /* xattr absent — not yet confirmed on Google Drive */ }

  // No Drive ID yet. If a local copy exists (non-zero), the upload may still be in progress.
  // Skip it to avoid re-downloading while the Drive app is uploading.
  if (fs.statSync(p).size > 0) return true;

  // 0 bytes + no Drive ID = genuinely incomplete download stub. Mark for re-download.
  return false;
}

function loadState() {
  try { return JSON.parse(fs.readFileSync(C.stateFile, 'utf8')); }
  catch { return { done: [], failed: [], manifest: null }; }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(C.stateFile), { recursive: true });
  fs.writeFileSync(C.stateFile, JSON.stringify(s, null, 2));
}

// ─── SYNC.COM API ─────────────────────────────────────────────────────────────
async function apiPathList(page, syncId) {
  const args = [C.pubId, syncId];
  return page.evaluate(async ([pubId, syncId]) => {
    const r = await fetch(
      'https://ln5.sync.com/api/v1/linkpathlist?engine=cp-3.1.38&userid=0&deviceid=0&devicetypeid=3',
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ publink_id: pubId, sync_id: syncId, responsetype: 'json' }) }
    );
    return r.json();
  }, args);
}

// ─── DOM SCRAPING ─────────────────────────────────────────────────────────────
/**
 * Collect all visible rows from the DOM.
 * The tall viewport (6000px) forces Angular to render ALL rows at once,
 * so no scroll-and-collect is needed.
 */
async function scrapeDomRows(page) {
  await page.waitForTimeout(1200);
  return page.evaluate(() =>
    Array.from(document.querySelectorAll('tr[data-row-id]')).map(r => ({
      sync_id: r.getAttribute('data-row-id'),
      name:    (r.querySelectorAll('td')[1]?.innerText || '').trim(),
    })).filter(r => r.name)
  );
}

async function getPageTitle(page) {
  return page.evaluate(() => document.title.replace(/\s*\|\s*Sync\.com\s*$/, '').trim());
}

// ─── NAVIGATE ─────────────────────────────────────────────────────────────────
async function goTo(page, syncId) {
  const url = `${C.baseUrl}?sync_id=${syncId}${C.key}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });
  } catch {
    await page.goto(url, { timeout: 30_000 });
  }
  await page.waitForTimeout(1500);
}

// ─── CRAWL (recursive) ────────────────────────────────────────────────────────
/**
 * Returns an array of file entries: { relPath, folderSyncId, fileSyncId, size, name }
 * relPath is relative to C.dest
 */
async function crawl(page, syncId, parentRelPath, depth) {
  await goTo(page, syncId);

  const apiData = await apiPathList(page, syncId);
  const folderTitle = await getPageTitle(page);
  const apiItems = apiData.pathitems || [];

  // Build sync_id → api_item map
  const apiMap = Object.fromEntries(apiItems.map(i => [String(i.sync_id), i]));

  // Get DOM names (handles name decryption via the browser)
  const domRows = await scrapeDomRows(page);
  const domMap  = Object.fromEntries(domRows.map(r => [r.sync_id, r.name]));

  // Merge: use DOM for names, API for type/size/cachekey
  const items = apiItems.map(item => ({
    sync_id: String(item.sync_id),
    name:    domMap[String(item.sync_id)] || null,
    type:    item.type,
    size:    item.size,
  })).filter(i => i.name);

  log(`${'  '.repeat(depth)}📂 ${folderTitle} (${items.length} items)`);

  const files = [];
  for (const item of items) {
    const relPath = parentRelPath ? path.join(parentRelPath, item.name) : item.name;

    if (item.type === 'dir') {
      // Recurse
      const subFiles = await crawl(page, item.sync_id, relPath, depth + 1);
      files.push(...subFiles);
      // Navigate back to parent after recursion
      await goTo(page, syncId);
    } else {
      files.push({
        relPath,
        folderSyncId: syncId,
        fileSyncId:   item.sync_id,
        size:         item.size,
        name:         item.name,
      });
    }
  }

  return files;
}

// ─── DOWNLOAD ─────────────────────────────────────────────────────────────────
async function captureDownloadUrl(page, folderSyncId, fileSyncId, attempt) {
  // Re-navigate to parent folder on each attempt (fresh page state)
  await goTo(page, folderSyncId);

  // Scroll to make the row visible
  try {
    await page.locator(`tr[data-row-id="${fileSyncId}"]`).scrollIntoViewIfNeeded({ timeout: 5000 });
    await page.waitForTimeout(300);
  } catch {
    for (let i = 0; i < 5; i++) {
      const visible = await page.locator(`tr[data-row-id="${fileSyncId}"]`).isVisible().catch(() => false);
      if (visible) break;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(400);
    }
  }

  let downloadUrl = null;
  await page.route('**syncusercontent**', async route => {
    const url = route.request().url();
    if (url.includes('/p/') && !url.includes('isup.txt')) {
      downloadUrl = url;
      await route.abort();
    } else {
      await route.continue();
    }
  });

  try {
    // Longer wait on retries to let the page settle
    if (attempt > 1) await page.waitForTimeout(1000 * attempt);

    const row     = page.locator(`tr[data-row-id="${fileSyncId}"]`);
    const moreBtn = row.locator('button').last();
    await moreBtn.click({ timeout: 8000 });
    await page.waitForTimeout(700);

    const dlItem = page.locator('[role="menuitem"]').filter({ hasText: 'Download' });
    await dlItem.click({ timeout: 8000 });

    const deadline = Date.now() + 12_000;
    while (!downloadUrl && Date.now() < deadline) await page.waitForTimeout(200);
  } finally {
    await page.keyboard.press('Escape').catch(() => {});
    await page.unroute('**syncusercontent**');
  }

  return downloadUrl;
}

async function downloadFile(page, folderSyncId, fileSyncId, destPath) {
  const MAX_ATTEMPTS = 3;
  let downloadUrl = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      downloadUrl = await captureDownloadUrl(page, folderSyncId, fileSyncId, attempt);
      if (downloadUrl) break;
      log(`  ⚠️  No URL captured (attempt ${attempt}/${MAX_ATTEMPTS}): ${path.basename(destPath)}`);
    } catch (err) {
      const msg = err.message.split('\n')[0];
      log(`  ⚠️  UI failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${path.basename(destPath)} — ${msg}`);
    }
  }

  if (!downloadUrl) {
    log(`  ❌ Skipping after ${MAX_ATTEMPTS} attempts: ${path.basename(destPath)}`);
    return false;
  }

  // Ensure directory exists
  fs.mkdirSync(path.dirname(destPath), { recursive: true });

  const tmpPath = destPath + '.part';
  log(`  ⬇️  curl → ${path.basename(destPath)}`);

  const result = spawnSync('curl', [
    '-L', '-o', tmpPath, '-C', '-',
    '--retry', '3', '--retry-delay', '5',
    '--max-time', '14400',    // 4 hour max for huge videos
    '--progress-bar',
    downloadUrl,
  ], { stdio: 'inherit', timeout: 14_500_000 });

  if (result.status === 0 && fs.existsSync(tmpPath)) {
    fs.renameSync(tmpPath, destPath);
    log(`  ✅ Done: ${path.basename(destPath)}`);
    return true;
  } else {
    log(`  ❌ Failed (exit ${result.status}): ${path.basename(destPath)}`);
    if (fs.existsSync(tmpPath) && fs.statSync(tmpPath).size === 0) fs.unlinkSync(tmpPath);
    return false;
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  log('');
  log('═══════════════════════════════════════════════════════════');
  log('🎬 Dance of Life Library — sync.com → Google Drive');
  log(`   Destination: ${C.dest}`);
  log(`   Free space:  ${getFreeGB().toFixed(1)} GB`);
  log('═══════════════════════════════════════════════════════════');

  fs.mkdirSync(C.dest, { recursive: true });

  const state = loadState();

  // FORCE_RESCAN=1: clear manifest (rebuild it) but keep done list so no re-downloads
  if (process.env.FORCE_RESCAN === '1' && state.manifest?.length) {
    log('🔄 FORCE_RESCAN=1 — clearing manifest to detect new source files');
    state.manifest = null;
    saveState(state);
  }

  const browser = await chromium.launch({ headless: true });
  const ctx     = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    // Tall viewport forces Angular virtual scroller to render ALL rows at once
    viewport: { width: 1280, height: 6000 },
  });
  const page = await ctx.newPage();

  try {
    // ── Verify source availability ──────────────────────────────────────────
    // Do this every run before touching the manifest, so a dead/blocked/expired
    // sync.com link surfaces as a failure in the explicit operator session.
    log('');
    log('🔍 Verifying source availability…');
    await goTo(page, C.rootId);
    const rootCheck = await apiPathList(page, C.rootId);
    const rootItems = rootCheck.pathitems || [];
    if (rootItems.length === 0) {
      const pageText = await page.evaluate(() =>
        (document.body?.innerText || '').slice(0, 400).replace(/\s+/g, ' ').trim()
      );
      const isErrorPage = /not found|expired|invalid|no longer|deleted|denied|blocked|unavailable/i.test(pageText);
      const reason = isErrorPage
        ? `page content: "${pageText.slice(0, 200)}"`
        : 'root folder returned 0 items — link may be expired or account deleted';
      throw new Error(
        `SOURCE UNAVAILABLE — sync.com link is unreachable or empty.\n` +
        `  URL:    ${C.baseUrl}?sync_id=${C.rootId}${C.key}\n` +
        `  Reason: ${reason}\n` +
        `  Action: Check the sync.com link manually. If the share was revoked or the\n` +
        `          URL changed, update C.rootId and C.key in sync_downloader.mjs.`
      );
    }
    log(`✅ Source accessible — ${rootItems.length} top-level items at root`);

    // ── Build manifest ──────────────────────────────────────────────────────
    if (!state.manifest?.length) {
      log('');
      log('📋 Phase 1: Scanning source folder tree (takes a few minutes)…');
      await goTo(page, C.rootId);
      state.manifest = await crawl(page, C.rootId, '', 0);
      log(`\n✅ Manifest: ${state.manifest.length} files found`);
      saveState(state);
    } else {
      log(`📋 Restored manifest: ${state.manifest.length} files`);
    }

    // ── Determine what needs downloading ────────────────────────────────────
    const doneSet = new Set(state.done || []);
    const toGet   = state.manifest.filter(item => {
      const p = path.join(C.dest, item.relPath);
      if (fileOnGDrive(p)) {
        doneSet.add(item.relPath);
        return false;
      }
      return !doneSet.has(item.relPath);
    });

    const totalSize = toGet.reduce((s, i) => s + (i.size || 0), 0);
    log('');
    log('📊 Status:');
    log(`   Already on Google Drive: ${doneSet.size} files`);
    log(`   To download:             ${toGet.length} files (${(totalSize / 1e9).toFixed(1)} GB)`);
    log(`   Free disk space:         ${getFreeGB().toFixed(1)} GB`);

    if (toGet.length === 0) {
      log('\n🎉 Everything is already downloaded!');
      return;
    }

    // ── Download loop ────────────────────────────────────────────────────────
    log('\n📥 Phase 2: Downloading missing files…\n');

    const failedSet = new Set(state.failed || []);
    let idx = 0;

    for (const item of toGet) {
      idx++;
      const destPath = path.join(C.dest, item.relPath);
      const sizeStr  = item.size ? `${(item.size / 1e6).toFixed(0)}MB` : '?MB';

      // Re-check in case it appeared since manifest was built
      if (fileOnGDrive(destPath)) {
        log(`[${idx}/${toGet.length}] ✅ Already present: ${item.relPath}`);
        doneSet.add(item.relPath);
        continue;
      }

      await waitForSpace();

      log(`[${idx}/${toGet.length}] ${item.relPath} (${sizeStr})`);

      const ok = await downloadFile(page, item.folderSyncId, item.fileSyncId, destPath);

      if (ok) {
        doneSet.add(item.relPath);
        failedSet.delete(item.relPath);
      } else {
        failedSet.add(item.relPath);
      }

      state.done   = [...doneSet];
      state.failed = [...failedSet];
      saveState(state);

      await page.waitForTimeout(300);
    }

    // ── Summary ──────────────────────────────────────────────────────────────
    log('');
    log('═══════════════════════════════════════════════════════════');
    log(`✅ Done — ${doneSet.size} files on Google Drive`);
    if (failedSet.size) {
      log(`⚠️  ${failedSet.size} failed — re-run to retry:`);
      for (const f of failedSet) log(`    • ${f}`);
    }
    log('═══════════════════════════════════════════════════════════');

  } finally {
    await browser.close();
  }
}

main().catch(err => {
  log(`💥 Fatal: ${err.message}`);
  process.exit(1);
});
