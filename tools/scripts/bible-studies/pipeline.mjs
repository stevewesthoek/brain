#!/usr/bin/env bun
/**
 * pipeline.mjs — Dance of Life Bible Studies transcription pipeline
 *
 * Phases:
 *  1. Scan Bible Studies/ for new .mp4 / .mp3 files not yet transcribed
 *  2. Transcribe each with mlx-whisper (mlx-community/whisper-large-v3-mlx, max quality)
 *  3. Format transcript as Obsidian markdown with [HH:MM:SS] timestamped segments
 *  4. Write note to brain/personal/bible-studies/dance-of-life/[Series]/[NN-of-TT] - Title.md
 *  5. Batch-sync new notes + series PDFs/RTFs to NotebookLM via `claude --print`
 *     (one notebook per series, named "DOL - [Series]"; auto-created on first encounter)
 *  6. Regenerate README.md index
 *  7. Git-commit new notes to brain repo
 *
 * Robustness & crash-safety:
 *  - MEMORY GATE: before each transcription, available RAM is checked. If below 4 GB,
 *    the pipeline waits (checking every 30 s, max 30 min) before spawning mlx_whisper.
 *    This prevents swap exhaustion and the kernel watchdog panic that would otherwise
 *    result from loading the 3 GB model 282 times back-to-back without recovery pauses.
 *  - NICE: mlx_whisper runs at nice 10 so critical system services stay responsive.
 *  - COOLDOWN: 5-second sleep after each transcription gives macOS time to fully
 *    reclaim the subprocess memory before the next spawn.
 *  - AUTO-RESUME: successfully transcribed videos are written to state immediately after
 *    each file completes. If the process is interrupted (crash, power loss, nightly
 *    timeout), the next run picks up exactly where it left off — skipping any video
 *    already in state.transcribed.
 *  - FAILED LIST: videos that fail transcription are added to state.failed and skipped
 *    on subsequent runs. Re-run with FORCE_RESCAN=1 to clear the failed list and retry.
 *  - NIGHTLY SCHEDULE: triggered automatically by office-nightly-scheduler.sh after
 *    dance-of-life-sync completes (new videos first, then transcribe). The nightly job
 *    has a 4-hour timeout; any remaining videos are picked up the following night.
 *
 * Dynamic growth:
 *  - New series folders in Bible Studies/ are auto-detected every run (logged as 🆕).
 *  - New videos in existing series are auto-detected via relPath tracking in state.
 *  - New sub-series subfolders are discovered via walkDir; organisational dirs
 *    (Videos/, Resources/, etc.) are flattened; meaningful sub-series become subfolders.
 *  - New NotebookLM notebooks are created automatically for new series.
 *  - NLM sync failures are retried the next run (only confirmed-synced series
 *    are marked in state; unconfirmed remain in the queue).
 *
 * State schema (~/.local/state/bible-studies/state.json):
 *  {
 *    transcribed:  string[]   // relPaths of successfully transcribed videos
 *    nlmSynced:    string[]   // relPaths confirmed synced to NotebookLM
 *    failed:       string[]   // relPaths that failed transcription (skipped until FORCE_RESCAN)
 *    notebooks:    Record<series, notebookId>  // NotebookLM IDs per series
 *    knownSeries:  string[]   // all series ever seen; new entries logged on discovery
 *  }
 *
 * State: ~/.local/state/bible-studies/state.json
 * Log:   ~/Library/Logs/office-scheduler/bible-studies.log
 */

import * as fs   from 'fs';
import * as path from 'path';
import * as os   from 'os';
import { execSync, spawnSync } from 'child_process';

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const C = {
  bibleSrc:   '/Users/Office/Library/CloudStorage/GoogleDrive-info@prochat.tools/My Drive/Bible Study/Dance of Life/Bible Studies',
  notesDest:  '/Users/Office/Repos/stevewesthoek/brain/personal/bible-studies/dance-of-life',
  brainRoot:  '/Users/Office/Repos/stevewesthoek/brain',
  stateFile:  path.join(os.homedir(), '.local/state/bible-studies/state.json'),
  logFile:    path.join(os.homedir(), 'Library/Logs/office-scheduler/bible-studies.log'),
  model:      'mlx-community/whisper-large-v3-mlx',
  mlxBin:     process.env.MLX_WHISPER_BIN || process.env.HOME + '/.local/bin/mlx_whisper',
  claudeBin:  process.env.CLAUDE_BIN || 'claude',
  // Subdirectory names that are organisational (flatten into parent series notes)
  flattenDirs: new Set([
    'videos', 'video', 'resources', 'resource', 'thumbnails', 'thumbnail',
    'vds thumbnails', 'pastor resources', 'cosmology thumbnails',
    'the afterlife thumbnails', 'exposing babylon documentation',
  ]),
};

// ─── LOGGING ──────────────────────────────────────────────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
  console.log(line);
  fs.mkdirSync(path.dirname(C.logFile), { recursive: true });
  fs.appendFileSync(C.logFile, line + '\n');
}

// ─── STATE ────────────────────────────────────────────────────────────────────
function loadState() {
  try { return JSON.parse(fs.readFileSync(C.stateFile, 'utf8')); }
  catch { return { transcribed: [], nlmSynced: [], notebooks: {}, failed: [] }; }
}
function saveState(s) {
  fs.mkdirSync(path.dirname(C.stateFile), { recursive: true });
  fs.writeFileSync(C.stateFile, JSON.stringify(s, null, 2));
}

// ─── FILE DISCOVERY ───────────────────────────────────────────────────────────
function walkDir(dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else results.push(full);
  }
  return results;
}

/**
 * Returns all series names (immediate subdirectories of bibleSrc).
 */
function discoverSeries() {
  if (!fs.existsSync(C.bibleSrc)) {
    log(`⚠️  Bible Studies source not found: ${C.bibleSrc}`);
    return [];
  }
  return fs.readdirSync(C.bibleSrc, { withFileTypes: true })
    .filter(e => e.isDirectory())
    .map(e => e.name)
    .sort();
}

/**
 * Finds all audio/video files in a series folder.
 * Returns entries sorted by full path (numeric filenames sort correctly).
 */
function discoverVideos(seriesName) {
  const seriesPath = path.join(C.bibleSrc, seriesName);
  const allFiles = walkDir(seriesPath);
  return allFiles
    .filter(f => /\.(mp4|mp3|m4a|mov|mkv)$/i.test(f))
    .sort();
}

/**
 * Finds all resource documents (PDFs, RTFs, TXTs) in a series folder.
 */
function discoverResources(seriesName) {
  const seriesPath = path.join(C.bibleSrc, seriesName);
  return walkDir(seriesPath).filter(f => /\.(pdf|rtf|txt|docx|doc)$/i.test(f));
}

// ─── TITLE PARSING ────────────────────────────────────────────────────────────
/**
 * Extracts a clean human-readable title from a video filename.
 * Handles patterns like:
 *   "7 - Synagogue of Satan - From Babylon to Rome (The False Prophet) (Video 7 of 9).mp4"
 *   "Should Christians Be Involved with Politics.mp4"
 *   "1 - Introduction.mp4"
 */
function parseTitle(filename, seriesName) {
  let name = path.basename(filename, path.extname(filename));

  // Remove "(Video N of M)" annotation
  name = name.replace(/\s*\(Video \d+ of \d+\)\s*/gi, '').trim();

  // Remove leading "N - " or "N. " numeric prefix
  name = name.replace(/^\d+\s*[-–.]\s*/, '').trim();

  // Remove series name prefix if present: "Series Name - Title" → "Title"
  const seriesEscaped = seriesName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  name = name.replace(new RegExp(`^${seriesEscaped}\\s*[-–]\\s*`, 'i'), '').trim();

  return name || path.basename(filename, path.extname(filename));
}

/**
 * Extracts explicit part/total from "(Video N of M)" in filename.
 * Returns null if not present.
 */
function parseExplicitPart(filename) {
  const m = filename.match(/\(Video (\d+) of (\d+)\)/i);
  if (m) return { part: parseInt(m[1]), total: parseInt(m[2]) };
  return null;
}

/**
 * Extracts leading numeric index from filename (e.g. "7 - title.mp4" → 7).
 */
function parseLeadingIndex(filename) {
  const m = path.basename(filename).match(/^(\d+)\s*[-–.]/);
  return m ? parseInt(m[1]) : null;
}

// ─── NOTE PATHS ───────────────────────────────────────────────────────────────
/**
 * Computes the intermediate subfolder path within the series notes directory.
 * Flattens known organisational dirs (Videos/, Resources/, etc.).
 * Preserves meaningful subfolders (sub-series).
 */
function getNoteSubfolders(videoAbsPath, seriesName) {
  const seriesRoot = path.join(C.bibleSrc, seriesName);
  const rel = path.relative(seriesRoot, path.dirname(videoAbsPath));
  if (!rel || rel === '.') return [];
  return rel.split(path.sep).filter(part => !C.flattenDirs.has(part.toLowerCase()));
}

/**
 * Builds the note filename: "NN-of-TT - Title.md"
 */
function buildNoteFilename(indexInSeries, totalInSeries, title) {
  const nn = String(indexInSeries).padStart(2, '0');
  const tt = String(totalInSeries).padStart(2, '0');
  // Sanitise title for filesystem
  const safeTitle = title.replace(/[/\\:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim();
  return `${nn}-of-${tt} - ${safeTitle}.md`;
}

// ─── MEMORY GATE ─────────────────────────────────────────────────────────────
// Returns available memory in GB: free + speculative + purgeable + 50% inactive.
// We don't count all inactive pages because the OS may need them; taking half is
// a conservative estimate of what macOS can reclaim without thrashing swap.
function getAvailableMemoryGB() {
  const vmstat = spawnSync('vm_stat', [], { encoding: 'utf8' }).stdout;
  const PAGE = 16384; // 16 KB pages on Apple Silicon
  const parse = (label) =>
    parseInt(vmstat.match(new RegExp(label + '\\s+(\\d+)'))?.[1] ?? '0');
  const free       = parse('Pages free:');
  const speculative= parse('Pages speculative:');
  const purgeable  = parse('Pages purgeable:');
  const inactive   = parse('Pages inactive:');
  const bytes = (free + speculative + purgeable + Math.floor(inactive * 0.5)) * PAGE;
  return bytes / (1024 ** 3);
}

// Waits until at least `requiredGB` GB of memory is available, checking every
// `intervalMs` ms. Logs a warning each time it has to wait. Hard caps at
// `maxWaitMs` total (default 30 min) so a stuck system doesn't hang forever.
async function waitForMemory(requiredGB = 4, intervalMs = 30_000, maxWaitMs = 1_800_000) {
  const deadline = Date.now() + maxWaitMs;
  while (true) {
    const avail = getAvailableMemoryGB();
    if (avail >= requiredGB) return;
    if (Date.now() >= deadline) {
      log(`   ⚠️  Memory wait exceeded ${maxWaitMs / 60_000} min (${avail.toFixed(1)} GB available) — proceeding anyway`);
      return;
    }
    log(`   ⏳ Memory pressure: ${avail.toFixed(1)} GB available, need ${requiredGB} GB — waiting ${intervalMs / 1000}s`);
    await new Promise(r => setTimeout(r, intervalMs));
  }
}

// ─── TRANSCRIPTION ────────────────────────────────────────────────────────────
function transcribeVideo(videoPath) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-'));
  try {
    // Run mlx_whisper at reduced CPU priority (nice 10) so critical system
    // services stay responsive and the watchdog does not lose heartbeats.
    const result = spawnSync('nice', [
      '-n', '10',
      C.mlxBin,
      videoPath,
      '--model', C.model,
      '--output-format', 'json',
      '--output-dir', tmpDir,
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 14_400_000, // 4 hours max per video
    });

    if (result.status !== 0) {
      const err = (result.stderr || '').toString().slice(0, 300);
      throw new Error(`mlx_whisper exited ${result.status}: ${err}`);
    }

    // Find the JSON output file
    const basename = path.basename(videoPath, path.extname(videoPath));
    const jsonPath = path.join(tmpDir, basename + '.json');

    if (!fs.existsSync(jsonPath)) {
      // mlx-whisper may sanitise the filename — find any .json in tmpDir
      const jsons = fs.readdirSync(tmpDir).filter(f => f.endsWith('.json'));
      if (jsons.length === 0) throw new Error('No JSON output from mlx_whisper');
      return JSON.parse(fs.readFileSync(path.join(tmpDir, jsons[0]), 'utf8'));
    }

    return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ─── NOTE FORMATTING ──────────────────────────────────────────────────────────
function formatTimestamp(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return [h, m, s].map(n => String(n).padStart(2, '0')).join(':');
}

function formatNote({ seriesName, title, indexInSeries, totalInSeries, videoBasename, transcript }) {
  const tags = [
    'dance-of-life',
    'bible-study',
    seriesName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
  ];

  const frontmatter = [
    '---',
    `title: "${seriesName} — ${indexInSeries} of ${totalInSeries}: ${title}"`,
    `series: "${seriesName}"`,
    `part: ${indexInSeries}`,
    `total_parts: ${totalInSeries}`,
    `source_video: "${videoBasename}"`,
    `transcribed: "${new Date().toISOString().slice(0, 10)}"`,
    `notebooklm_notebook: "DOL - ${seriesName}"`,
    'tags:',
    ...tags.map(t => `  - ${t}`),
    '---',
  ].join('\n');

  // Body: full text followed by timestamped segments
  const segments = (transcript.segments || [])
    .map(seg => `**[${formatTimestamp(seg.start)}]** ${seg.text.trim()}`)
    .join('\n\n');

  return `${frontmatter}\n\n# ${title}\n\n${segments}\n`;
}

// ─── WRITE NOTE ───────────────────────────────────────────────────────────────
function writeNote(seriesName, subfolders, noteFilename, content) {
  const noteDir = path.join(C.notesDest, seriesName, ...subfolders);
  fs.mkdirSync(noteDir, { recursive: true });
  const notePath = path.join(noteDir, noteFilename);
  fs.writeFileSync(notePath, content);
  return notePath;
}

// ─── NOTEBOOKLM SYNC ──────────────────────────────────────────────────────────
/**
 * Builds a batched claude --print prompt to create/update DOL notebooks.
 * Groups new notes and resources by series. One claude call per batch of series.
 */
function syncToNotebookLM(newNotesBySeries, resourcesBySeries, state) {
  const seriesToSync = Object.keys(newNotesBySeries).filter(
    s => (newNotesBySeries[s]?.length || 0) + (resourcesBySeries[s]?.length || 0) > 0
  );

  if (seriesToSync.length === 0) {
    log('📓 NotebookLM: nothing new to sync');
    return;
  }

  log(`📓 NotebookLM: syncing ${seriesToSync.length} series…`);

  // Process up to 5 series per claude call to keep prompts manageable
  const BATCH_SIZE = 5;
  const syncedSeries = new Set();
  for (let i = 0; i < seriesToSync.length; i += BATCH_SIZE) {
    const batch = seriesToSync.slice(i, i + BATCH_SIZE);
    const batchSynced = syncBatch(batch, newNotesBySeries, resourcesBySeries, state);
    for (const s of batchSynced) syncedSeries.add(s);
  }
  return syncedSeries; // caller uses this to mark only confirmed-synced videos
}

/**
 * Syncs one batch of series to NotebookLM via `claude --print`.
 * Returns the set of series that were successfully synced.
 */
function syncBatch(seriesList, newNotesBySeries, resourcesBySeries, state) {
  const instructions = seriesList.map(series => {
    const notebookName = `DOL - ${series}`;
    const existingId   = state.notebooks?.[series];
    const notes        = newNotesBySeries[series] || [];
    const resources    = resourcesBySeries[series] || [];
    const allFiles     = [...notes, ...resources];

    const fileList = allFiles.map(f => `    - ${f}`).join('\n');
    const createOrUpdate = existingId
      ? `Notebook "${notebookName}" already exists (id: ${existingId}). Add the files below to it.`
      : `Create a new notebook titled "${notebookName}", then add the files below to it.`;

    return `Series: ${series}\n  ${createOrUpdate}\n  Files:\n${fileList}`;
  }).join('\n\n');

  const prompt = `You are running in automation mode. Use the NotebookLM MCP tools to perform these exact operations — nothing else.

For each series listed below:
1. If the notebook does not exist, call notebook_create with the given title.
2. For each file, call notebook_add_local_file with the notebook ID and the file path.

${instructions}

When all operations are complete, output ONLY a valid JSON object (no other text) in this exact format:
{"notebooks": {"Series Name": "notebook_id_here", "Other Series": "notebook_id_here"}}`;

  log(`  → claude --print batch: ${seriesList.join(', ')}`);

  const result = spawnSync(C.claudeBin, ['--print', prompt], {
    cwd:      C.brainRoot,
    encoding: 'utf8',
    timeout:  600_000, // 10 min per batch
    stdio:    ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    log(`  ⚠️  claude exited ${result.status}: ${(result.stderr || '').slice(0, 200)}`);
    return new Set(); // no series synced
  }

  // Parse notebook IDs from response
  const stdout = (result.stdout || '').trim();
  const jsonMatch = stdout.match(/\{[\s\S]*"notebooks"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      state.notebooks = { ...(state.notebooks || {}), ...parsed.notebooks };
      log(`  ✅ Notebook IDs updated: ${JSON.stringify(parsed.notebooks)}`);
      return new Set(Object.keys(parsed.notebooks));
    } catch {
      log(`  ⚠️  Could not parse notebook IDs from response`);
    }
  } else {
    log(`  ⚠️  No JSON found in claude response (sync may still have succeeded)`);
  }
  return new Set(); // conservatively assume no confirmed sync
}

// ─── README GENERATION ────────────────────────────────────────────────────────
function regenerateReadme(state) {
  const allSeries = discoverSeries();
  const lines = [
    '# Dance of Life — Bible Studies',
    '',
    'Transcribed notes from the [Dance of Life Library](https://ln5.sync.com/dl/8cd2a10a0).',
    'Each series has a dedicated NotebookLM notebook prefixed `DOL -` for AI-assisted study.',
    '',
    `*Last updated: ${new Date().toISOString().slice(0, 10)}*`,
    '',
    '## Series',
    '',
  ];

  for (const series of allSeries) {
    const seriesDir = path.join(C.notesDest, series);
    const noteCount = fs.existsSync(seriesDir)
      ? walkDir(seriesDir).filter(f => f.endsWith('.md')).length
      : 0;
    const totalVideos = discoverVideos(series).length;
    const notebookId  = state.notebooks?.[series];
    const nlmLink     = notebookId ? ` · [NotebookLM](https://notebooklm.google.com/notebook/${notebookId})` : '';
    const status      = noteCount === 0 ? '⏳ pending'
                      : noteCount < totalVideos ? `📝 ${noteCount}/${totalVideos}`
                      : `✅ ${noteCount}/${totalVideos}`;

    lines.push(`- **[[${series}/index|${series}]]** — ${status}${nlmLink}`);
  }

  lines.push('');
  fs.mkdirSync(C.notesDest, { recursive: true });
  fs.writeFileSync(path.join(C.notesDest, 'README.md'), lines.join('\n'));
}

// ─── GIT COMMIT ───────────────────────────────────────────────────────────────
function gitCommit(count) {
  try {
    const gitAdd = spawnSync('git', ['add', 'personal/bible-studies/'], {
      cwd: C.brainRoot, encoding: 'utf8',
    });
    if (gitAdd.status !== 0) throw new Error(gitAdd.stderr);

    // Check if there's anything staged
    const diff = spawnSync('git', ['diff', '--cached', '--quiet'], { cwd: C.brainRoot });
    if (diff.status === 0) {
      log('git: nothing to commit');
      return;
    }

    const msg = count === 1
      ? 'transcripts: add 1 new Dance of Life note'
      : `transcripts: add ${count} new Dance of Life notes`;

    const commit = spawnSync('git', ['commit', '-m', msg], {
      cwd: C.brainRoot, encoding: 'utf8',
    });
    if (commit.status !== 0) throw new Error(commit.stderr);
    log(`git: committed — ${msg}`);
  } catch (err) {
    log(`⚠️  git commit failed: ${err.message}`);
  }
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
async function main() {
  log('');
  log('═══════════════════════════════════════════════════════════');
  log('📖 Dance of Life Bible Studies — transcription pipeline');
  log(`   Source:  ${C.bibleSrc}`);
  log(`   Notes:   ${C.notesDest}`);
  log(`   Model:   ${C.model}`);
  log('═══════════════════════════════════════════════════════════');

  const state = loadState();
  const transcribedSet = new Set(state.transcribed || []);
  const nlmSyncedSet   = new Set(state.nlmSynced   || []);
  const failedSet      = new Set(state.failed      || []);

  if (process.env.FORCE_RESCAN === '1') {
    log('🔄 FORCE_RESCAN=1 — clearing failed list so previously-failed videos are retried');
    state.failed = [];
    failedSet.clear();
    saveState(state);
  }

  const allSeries = discoverSeries();
  if (allSeries.length === 0) {
    log('⚠️  No series found. Is the Google Drive folder mounted?');
    return;
  }
  log(`📂 Found ${allSeries.length} series`);

  // ── Phase 1: Build video manifest ──────────────────────────────────────────
  const allVideos = []; // { absPath, relPath, series, subfolders, indexInSeries, totalInSeries, title }

  for (const series of allSeries) {
    const videos = discoverVideos(series);
    const total  = videos.length;

    videos.forEach((absPath, idx) => {
      const relPath    = path.relative(C.bibleSrc, absPath);
      const subfolders = getNoteSubfolders(absPath, series);
      const explicit   = parseExplicitPart(absPath);
      const leading    = parseLeadingIndex(path.basename(absPath));

      // Prefer explicit "(Video N of M)" data, else use position in sorted array
      const indexInSeries = explicit?.part ?? (leading ?? (idx + 1));
      const totalInSeries = explicit?.total ?? total;
      const title         = parseTitle(absPath, series);

      allVideos.push({ absPath, relPath, series, subfolders, indexInSeries, totalInSeries, title });
    });
  }

  const toTranscribe = allVideos.filter(v => !transcribedSet.has(v.relPath) && !failedSet.has(v.relPath));
  // Detect newly appeared series (not in state before this run)
  const knownSeries = new Set(state.knownSeries || []);
  const newSeriesFound = allSeries.filter(s => !knownSeries.has(s));
  if (newSeriesFound.length > 0) {
    log(`\n🆕 New series detected: ${newSeriesFound.join(', ')}`);
    for (const s of newSeriesFound) knownSeries.add(s);
    state.knownSeries = [...knownSeries];
    saveState(state);
  }

  log(`\n📊 Status:`);
  log(`   Total videos:        ${allVideos.length}`);
  log(`   Already transcribed: ${transcribedSet.size}`);
  log(`   Failed (skipped):    ${failedSet.size}`);
  log(`   To transcribe:       ${toTranscribe.length}`);

  if (toTranscribe.length === 0) {
    log('\n🎉 All videos already transcribed!');
  }

  // ── Phase 2 & 3: Transcribe + write notes ──────────────────────────────────
  const newNotesBySeries   = {}; // series → [notePath, ...]
  const resourcesBySeries  = {}; // series → [resourcePath, ...]
  let newNoteCount = 0;

  for (let i = 0; i < toTranscribe.length; i++) {
    const v = toTranscribe[i];
    log(`\n[${i + 1}/${toTranscribe.length}] ${v.relPath}`);
    log(`   Series: ${v.series}  |  Part ${v.indexInSeries} of ${v.totalInSeries}  |  "${v.title}"`);

    let transcript;
    try {
      // Wait until enough RAM is free before loading the model.
      // The large-v3 model needs ~3 GB; we require 4 GB headroom.
      await waitForMemory(4);
      log('   🎙️  Transcribing…');
      transcript = transcribeVideo(v.absPath);
      // Give macOS time to fully reclaim the memory the subprocess just freed
      // before we spin up the next mlx_whisper process.
      await new Promise(r => setTimeout(r, 5_000));
    } catch (err) {
      log(`   ❌ Transcription failed: ${err.message}`);
      failedSet.add(v.relPath);
      state.failed = [...failedSet];
      saveState(state);
      continue;
    }

    if (!transcript?.segments?.length) {
      log('   ⚠️  Empty transcript — skipping');
      failedSet.add(v.relPath);
      state.failed = [...failedSet];
      saveState(state);
      continue;
    }

    const noteFilename = buildNoteFilename(v.indexInSeries, v.totalInSeries, v.title);
    const content      = formatNote({
      seriesName:     v.series,
      title:          v.title,
      indexInSeries:  v.indexInSeries,
      totalInSeries:  v.totalInSeries,
      videoBasename:  path.basename(v.absPath),
      transcript,
    });

    const notePath = writeNote(v.series, v.subfolders, noteFilename, content);
    log(`   ✅ Note written: ${path.relative(C.brainRoot, notePath)}`);

    transcribedSet.add(v.relPath);
    (newNotesBySeries[v.series] ??= []).push(notePath);
    newNoteCount++;

    state.transcribed = [...transcribedSet];
    state.failed      = [...failedSet];
    saveState(state);
  }

  // ── Discover resources for series that have new notes ──────────────────────
  const seriesWithNewNotes = Object.keys(newNotesBySeries);
  for (const series of seriesWithNewNotes) {
    resourcesBySeries[series] = discoverResources(series);
  }

  // ── Phase 4: NotebookLM sync ───────────────────────────────────────────────
  // Also check for notes not yet synced (from previous runs that skipped NLM)
  for (const v of allVideos) {
    const noteFilename = buildNoteFilename(v.indexInSeries, v.totalInSeries, v.title);
    const notePath     = path.join(C.notesDest, v.series, ...v.subfolders, noteFilename);

    if (fs.existsSync(notePath) && !nlmSyncedSet.has(v.relPath)) {
      (newNotesBySeries[v.series] ??= []).push(notePath);
      if (!resourcesBySeries[v.series]) {
        resourcesBySeries[v.series] = discoverResources(v.series);
      }
    }
  }

  const confirmedSyncedSeries = syncToNotebookLM(newNotesBySeries, resourcesBySeries, state);

  // Only mark videos as NLM-synced for series where sync was confirmed.
  // Unconfirmed series remain in the queue and will be retried on the next run.
  for (const v of allVideos) {
    if (transcribedSet.has(v.relPath) && confirmedSyncedSeries.has(v.series)) {
      nlmSyncedSet.add(v.relPath);
    }
  }
  state.nlmSynced = [...nlmSyncedSet];
  saveState(state);

  // ── Phase 5: README ────────────────────────────────────────────────────────
  log('\n📄 Regenerating README…');
  regenerateReadme(state);

  // ── Phase 6: Git commit ────────────────────────────────────────────────────
  if (newNoteCount > 0) {
    log(`\n📦 Committing ${newNoteCount} new note(s) to brain…`);
    gitCommit(newNoteCount);
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  log('');
  log('═══════════════════════════════════════════════════════════');
  log(`✅ Pipeline complete`);
  log(`   New notes written:  ${newNoteCount}`);
  log(`   Total transcribed:  ${transcribedSet.size} / ${allVideos.length}`);
  if (failedSet.size) {
    log(`   Failed:             ${failedSet.size} (re-run to retry)`);
  }
  log('═══════════════════════════════════════════════════════════');
}

main().catch(err => {
  log(`💥 Fatal: ${err.message}`);
  process.exit(1);
});
