import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Config } from "../config.js";

const CHECK_INTERVAL_MS = 10 * 60 * 1000; // every 10 minutes
const DEFAULT_IDLE_THRESHOLD_MS = 50 * 60 * 1000; // 50 minutes

interface SessionFile {
  filePath: string;
  cwd: string;
  lastActivityAt: number;
  lastPrompt: string;
  tool: "claude" | "codex";
}

function readJsonLines(filePath: string): unknown[] {
  try {
    return fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((line) => { try { return JSON.parse(line); } catch { return null; } })
      .filter(Boolean) as unknown[];
  } catch {
    return [];
  }
}

function extractLastPrompt(entries: Record<string, unknown>[]): string {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i] as Record<string, unknown>;
    if (e["type"] !== "user" || e["isMeta"]) continue;
    const message = e["message"] as Record<string, unknown> | undefined;
    const content = message?.["content"];
    let text = "";
    if (typeof content === "string") text = content.trim();
    else if (Array.isArray(content)) {
      text = content
        .filter((c): c is Record<string, unknown> => !!c && typeof c === "object")
        .filter((c) => c["type"] === "text")
        .map((c) => String(c["text"] ?? ""))
        .join(" ")
        .trim();
    }
    if (text && !text.startsWith("<")) return text.slice(0, 300);
  }
  return "No prompt recorded";
}

function scanClaudeSessions(claudeProjectsDir: string): SessionFile[] {
  const results: SessionFile[] = [];
  if (!fs.existsSync(claudeProjectsDir)) return results;

  for (const projectDir of fs.readdirSync(claudeProjectsDir)) {
    const fullProject = path.join(claudeProjectsDir, projectDir);
    if (!fs.statSync(fullProject).isDirectory()) continue;

    for (const filename of fs.readdirSync(fullProject)) {
      if (!filename.endsWith(".jsonl")) continue;
      const filePath = path.join(fullProject, filename);
      const stat = fs.statSync(filePath);
      const entries = readJsonLines(filePath) as Record<string, unknown>[];
      if (entries.length === 0) continue;

      const cwdEntry = entries.find((e) => typeof (e as Record<string, unknown>)["cwd"] === "string") as Record<string, unknown> | undefined;
      const cwd = typeof cwdEntry?.["cwd"] === "string" ? cwdEntry["cwd"] : "";
      if (!cwd) continue;

      results.push({
        filePath,
        cwd,
        lastActivityAt: stat.mtimeMs,
        lastPrompt: extractLastPrompt(entries),
        tool: "claude",
      });
    }
  }
  return results;
}

function scanCodexSessions(codexSessionsDir: string): SessionFile[] {
  const results: SessionFile[] = [];
  if (!fs.existsSync(codexSessionsDir)) return results;

  const walk = (dir: string): string[] => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    return items.flatMap((item) => {
      const itemPath = path.join(dir, item.name);
      if (item.isDirectory()) return walk(itemPath);
      return item.isFile() && item.name.endsWith(".jsonl") ? [itemPath] : [];
    });
  };

  for (const filePath of walk(codexSessionsDir)) {
    try {
      const stat = fs.statSync(filePath);
      const entries = readJsonLines(filePath) as Record<string, unknown>[];
      const meta = entries.find((e) => (e as Record<string, unknown>)["type"] === "session_meta") as
        | { payload?: { cwd?: string } }
        | undefined;
      const cwd = meta?.payload?.cwd;
      if (!cwd) continue;

      results.push({
        filePath,
        cwd,
        lastActivityAt: stat.mtimeMs,
        lastPrompt: "Codex session",
        tool: "codex",
      });
    } catch {
      continue;
    }
  }
  return results;
}

function writeAutoHandoff(session: SessionFile): boolean {
  const aiDir = path.join(session.cwd, ".ai");
  if (!fs.existsSync(aiDir)) return false;

  const handoffPath = path.join(aiDir, "current.md");
  const repoName = path.basename(session.cwd);
  const now = new Date().toISOString().slice(0, 16).replace("T", " ");
  const idleMin = Math.round((Date.now() - session.lastActivityAt) / 60_000);

  // Don't overwrite a handoff that was written more recently than the session
  if (fs.existsSync(handoffPath)) {
    const handoffStat = fs.statSync(handoffPath);
    if (handoffStat.mtimeMs > session.lastActivityAt) return false;
  }

  const handoff = `# Current Handoff

## Repo
${repoName}

## Tool
${session.tool === "claude" ? "Claude Code" : "Codex"}

## Goal
${session.lastPrompt}

## Status
- Auto-saved at ${now} (idle for ${idleMin} minutes)
- Run \`git diff --name-only HEAD\` to see recent file changes

## Files touched
- (check git diff --name-only HEAD)

## Decisions made
- (review session if decisions were made)

## Next steps
1. Run \`/resume ${repoName}\` in ProBot to get the resume prompt
2. Check git status for uncommitted changes

## Blockers
- None recorded automatically

## Resume prompt
Continue work on ${repoName}. Last task: ${session.lastPrompt.slice(0, 200)}
`;

  fs.writeFileSync(handoffPath, handoff, "utf8");
  return true;
}

export function startInactivityMonitor(
  config: Config,
  notify: (message: string) => Promise<void>,
): void {
  const idleThresholdMs =
    typeof process.env["PROBOT_INACTIVITY_MINUTES"] === "string"
      ? Number(process.env["PROBOT_INACTIVITY_MINUTES"]) * 60_000
      : DEFAULT_IDLE_THRESHOLD_MS;

  const check = async (): Promise<void> => {
    try {
      const now = Date.now();
      const sessions = [
        ...scanClaudeSessions(config.claudeProjectsDir),
        ...scanCodexSessions(config.codexSessionsDir),
      ];

      const written: string[] = [];

      for (const session of sessions) {
        const idleMs = now - session.lastActivityAt;
        if (idleMs < idleThresholdMs) continue;
        if (!fs.existsSync(session.cwd)) continue;

        const didWrite = writeAutoHandoff(session);
        if (didWrite) {
          const repoName = path.basename(session.cwd);
          const idleMin = Math.round(idleMs / 60_000);
          written.push(`${repoName} (${session.tool}, idle ${idleMin}min)`);
        }
      }

      if (written.length > 0) {
        await notify(`Auto-handoff written:\n${written.map((r) => `· ${r}`).join("\n")}`);
      }
    } catch (error) {
      console.error("[inactivity] check failed", error);
    }
  };

  // Run first check after 5 minutes, then every CHECK_INTERVAL_MS
  setTimeout(() => {
    void check();
    setInterval(() => void check(), CHECK_INTERVAL_MS);
  }, 5 * 60 * 1000);

  console.log(`[inactivity] monitor started — idle threshold: ${idleThresholdMs / 60_000}min, check every ${CHECK_INTERVAL_MS / 60_000}min`);
}
