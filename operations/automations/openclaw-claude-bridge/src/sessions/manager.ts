import { exec as execCb } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { config } from '../config';

const exec = promisify(execCb);

const SESSION_PREFIX = 'claude-';
const DEFAULT_SESSION = 'claude-default';

function sanitizeName(str: string): string {
  return str.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function repoToSessionId(repoPath: string): string {
  const rel = path.relative(config.repos.root, repoPath);
  return SESSION_PREFIX + sanitizeName(rel).slice(0, 60);
}

export function defaultSessionId(): string {
  return DEFAULT_SESSION;
}

interface ValidationResult {
  ok: boolean;
  resolved: string;
  error?: string;
}

export function validateRepoPath(inputPath: string): ValidationResult {
  const resolved = path.resolve(inputPath);
  const reposRoot = config.repos.root;

  if (!resolved.startsWith(reposRoot + path.sep) && resolved !== reposRoot) {
    return { ok: false, resolved, error: `Path outside REPOS_ROOT: ${resolved}` };
  }

  try {
    const raw = fs.readFileSync(config.repos.allowlistPath, 'utf8');
    const allowlist = JSON.parse(raw) as { allowed: string[] };
    const rel = path.relative(reposRoot, resolved);
    const topDir = rel.split(path.sep)[0];
    if (topDir && !allowlist.allowed.includes(topDir)) {
      return { ok: false, resolved, error: `Top-level dir '${topDir}' not in repos.allowlist.json` };
    }
  } catch {
    console.warn('[manager] repos.allowlist.json unreadable — skipping allowlist check');
  }

  if (!fs.existsSync(resolved)) {
    return { ok: false, resolved, error: `Path does not exist: ${resolved}` };
  }

  return { ok: true, resolved };
}

// ── tmux helpers ──────────────────────────────────────────────────────────────

async function rawCapture(sessionId: string): Promise<string> {
  try {
    const { stdout } = await exec(`tmux capture-pane -t ${JSON.stringify(sessionId)} -p 2>/dev/null`);
    // Strip ANSI
    return stdout.replace(/\x1B\[[0-9;]*[mGKHFJABCDEFsuhl]/g, '').replace(/\r/g, '');
  } catch {
    return '';
  }
}

export async function sessionExists(sessionId: string): Promise<boolean> {
  try {
    await exec(`tmux has-session -t ${JSON.stringify(sessionId)} 2>/dev/null`);
    return true;
  } catch {
    return false;
  }
}

export async function listSessions(): Promise<string[]> {
  try {
    const { stdout } = await exec(`tmux list-sessions -F "#{session_name}" 2>/dev/null`);
    return stdout.split('\n').map(s => s.trim()).filter(s => s.startsWith(SESSION_PREFIX));
  } catch {
    return [];
  }
}

export async function stopSession(sessionId: string): Promise<void> {
  if (!sessionId.startsWith(SESSION_PREFIX)) throw new Error(`Refusing to kill: ${sessionId}`);
  await exec(`tmux kill-session -t ${JSON.stringify(sessionId)} 2>/dev/null || true`);
}

// ── Session boot with blocking trust-accept ───────────────────────────────────

async function bootSession(sessionId: string, cwd: string): Promise<void> {
  // Create tmux session
  await exec(`tmux new-session -d -s ${JSON.stringify(sessionId)} -c ${JSON.stringify(cwd)}`);

  // Find claude binary
  let claudeBin = 'claude';
  try {
    const { stdout } = await exec('which claude 2>/dev/null');
    if (stdout.trim()) claudeBin = stdout.trim();
  } catch { /* use default */ }

  // Start Claude
  await exec(`tmux send-keys -t ${JSON.stringify(sessionId)} ${JSON.stringify(claudeBin)} Enter`);

  // Wait up to 30s for Claude to be ready — auto-accept trust prompt if it appears
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await new Promise(r => setTimeout(r, 1200));
    const pane = await rawCapture(sessionId);

    // Trust prompt — auto-accept (safe: REPOS_ROOT is our own code)
    if (/trust this folder/i.test(pane) || /Yes, I trust/i.test(pane)) {
      // Two separate send-keys: "1" selects option, then Enter confirms
      await exec(`tmux send-keys -t ${JSON.stringify(sessionId)} "1" ""`);
      await new Promise(r => setTimeout(r, 300));
      await exec(`tmux send-keys -t ${JSON.stringify(sessionId)} "" Enter`);
      await new Promise(r => setTimeout(r, 2500));
      continue;
    }

    // Claude is ready when its status bar is visible (shows model name + ❯ prompt)
    if (/❯/.test(pane) && /(Sonnet|Haiku|Opus|claude)/i.test(pane)) {
      return; // Ready
    }
  }
  // Timed out waiting — proceed anyway, trust may have been accepted already
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface EnsureSessionResult {
  sessionId: string;
  repoResolved: string | null;
  created: boolean;
}

export async function ensureSession(repoPath?: string): Promise<EnsureSessionResult> {
  let sessionId: string;
  let repoResolved: string | null = null;
  let cwd = config.repos.root;

  if (repoPath) {
    const v = validateRepoPath(repoPath);
    if (!v.ok) throw new Error(v.error);
    repoResolved = v.resolved;
    cwd = v.resolved;
    sessionId = repoToSessionId(v.resolved);
  } else {
    sessionId = defaultSessionId();
  }

  let created = false;
  if (!(await sessionExists(sessionId))) {
    await bootSession(sessionId, cwd);
    created = true;
  }

  return { sessionId, repoResolved, created };
}
