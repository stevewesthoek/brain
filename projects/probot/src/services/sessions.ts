import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runCommand } from "../connectors/process.js";
import type { SessionSummary } from "../types/app.js";

function readJsonLines(filePath: string): unknown[] {
  try {
    return fs
      .readFileSync(filePath, "utf8")
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      })
      .filter(Boolean) as unknown[];
  } catch {
    return [];
  }
}

function formatAge(timestamp: string): string {
  try {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const mins = Math.max(0, Math.floor(diffMs / 60_000));
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return `${Math.floor(days / 7)}w ago`;
  } catch {
    return "?";
  }
}

function shortProjectLabel(cwd: string): string {
  const home = os.homedir();
  const cleaned = cwd.replace(home, "~");
  const parts = cleaned.split("/").filter(Boolean);
  return parts.slice(-2).join("/") || cleaned;
}

function extractClaudeHeadline(entries: Record<string, unknown>[]): string {
  for (const entry of entries) {
    if (entry.type !== "user" || entry.isMeta) continue;
    const message = entry.message as Record<string, unknown> | undefined;
    const content = message?.content;
    if (typeof content === "string" && content.trim() && !content.trim().startsWith("<")) {
      return content.trim().slice(0, 120);
    }
    if (Array.isArray(content)) {
      const text = content
        .map((part) => {
          if (!part || typeof part !== "object") return "";
          const block = part as Record<string, unknown>;
          return block.type === "text" && typeof block.text === "string" ? block.text : "";
        })
        .join(" ")
        .trim();
      if (text && !text.startsWith("<")) {
        return text.slice(0, 120);
      }
    }
  }
  return "(no summary)";
}

export async function listTmuxSessions(): Promise<Set<string>> {
  try {
    const { stdout } = await runCommand("tmux", ["ls"], 4_000);
    const names = stdout
      .split("\n")
      .map((line) => line.split(":")[0]?.trim())
      .filter((line): line is string => Boolean(line));
    return new Set(names);
  } catch {
    return new Set();
  }
}

export async function listClaudeSessions(claudeProjectsDir: string): Promise<SessionSummary[]> {
  const tmuxSessions = await listTmuxSessions();
  const summaries: SessionSummary[] = [];

  if (!fs.existsSync(claudeProjectsDir)) {
    return summaries;
  }

  for (const projectDir of fs.readdirSync(claudeProjectsDir)) {
    const fullProject = path.join(claudeProjectsDir, projectDir);
    if (!fs.statSync(fullProject).isDirectory()) continue;

    for (const filename of fs.readdirSync(fullProject)) {
      if (!filename.endsWith(".jsonl")) continue;
      const entries = readJsonLines(path.join(fullProject, filename)) as Record<string, unknown>[];
      if (entries.length === 0) continue;

      const firstEntry = entries.find((entry) => typeof entry.timestamp === "string");
      if (!firstEntry || typeof firstEntry.timestamp !== "string") continue;

      const cwd = typeof firstEntry.cwd === "string" ? firstEntry.cwd : "~";
      const sessionId = filename.slice(0, -6);
      summaries.push({
        tool: "claude",
        id: sessionId,
        projectLabel: shortProjectLabel(cwd),
        cwd,
        age: formatAge(firstEntry.timestamp),
        updatedAt: firstEntry.timestamp,
        headline: extractClaudeHeadline(entries),
        activeInTmux: tmuxSessions.has(sessionId),
      });
    }
  }

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
}

interface CodexIndexEntry {
  id: string;
  thread_name?: string;
  updated_at?: string;
}

function loadCodexIndex(indexPath: string): Map<string, CodexIndexEntry> {
  const map = new Map<string, CodexIndexEntry>();
  for (const entry of readJsonLines(indexPath) as CodexIndexEntry[]) {
    if (entry?.id) map.set(entry.id, entry);
  }
  return map;
}

export async function listCodexSessions(
  sessionsDir: string,
  indexPath: string,
): Promise<SessionSummary[]> {
  const index = loadCodexIndex(indexPath);
  const tmuxSessions = await listTmuxSessions();
  const summaries: SessionSummary[] = [];

  if (!fs.existsSync(sessionsDir)) {
    return summaries;
  }

  const walk = (dir: string): string[] => {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    return items.flatMap((item) => {
      const itemPath = path.join(dir, item.name);
      if (item.isDirectory()) return walk(itemPath);
      return item.isFile() && item.name.endsWith(".jsonl") ? [itemPath] : [];
    });
  };

  for (const filePath of walk(sessionsDir)) {
    const entries = readJsonLines(filePath) as Record<string, unknown>[];
    const meta = entries.find((entry) => entry.type === "session_meta") as
      | { payload?: { cwd?: string; timestamp?: string } }
      | undefined;

    if (!meta?.payload?.cwd) continue;

    const filename = path.basename(filePath, ".jsonl");
    const parts = filename.split("-");
    if (parts.length < 5) continue;
    const sessionId = parts.slice(-5).join("-");
    const indexed = index.get(sessionId);
    const updatedAt = indexed?.updated_at ?? meta.payload.timestamp;
    if (!updatedAt) continue;

    const headline = indexed?.thread_name || "(unnamed)";
    summaries.push({
      tool: "codex",
      id: sessionId,
      projectLabel: shortProjectLabel(meta.payload.cwd),
      cwd: meta.payload.cwd,
      age: formatAge(updatedAt),
      updatedAt,
      headline,
      activeInTmux: tmuxSessions.has(sessionId),
    });
  }

  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 6);
}

export async function buildSessionOverview(
  claudeProjectsDir: string,
  codexSessionsDir: string,
  codexSessionIndex: string,
): Promise<SessionSummary[]> {
  const [claude, codex] = await Promise.all([
    listClaudeSessions(claudeProjectsDir),
    listCodexSessions(codexSessionsDir, codexSessionIndex),
  ]);

  return [...claude, ...codex].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function formatSessionOverview(sessions: SessionSummary[], limit = 8): string {
  if (sessions.length === 0) {
    return "No Claude or Codex sessions found.";
  }

  return sessions
    .slice(0, limit)
    .map((session) =>
      [
        `${session.tool.toUpperCase()} · ${session.projectLabel} · ${session.age}`,
        session.headline,
        session.activeInTmux ? "tmux: active" : "tmux: not detected",
      ].join("\n"),
    )
    .join("\n\n");
}

export async function buildTimeSummary(
  period: "today" | "week",
  claudeProjectsDir: string,
  codexSessionsDir: string,
  codexSessionIndex: string,
): Promise<string> {
  const all = await buildSessionOverview(claudeProjectsDir, codexSessionsDir, codexSessionIndex);
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - (period === "today" ? 1 : 7));

  const recent = all.filter((session) => new Date(session.updatedAt).getTime() >= cutoff.getTime());
  if (recent.length === 0) {
    return `No ${period} session activity found.`;
  }

  const repoCounts = new Map<string, number>();
  const toolCounts = new Map<string, number>();
  let activeCount = 0;
  for (const session of recent) {
    repoCounts.set(session.projectLabel, (repoCounts.get(session.projectLabel) ?? 0) + 1);
    toolCounts.set(session.tool, (toolCounts.get(session.tool) ?? 0) + 1);
    if (session.activeInTmux) activeCount += 1;
  }

  const topRepos = [...repoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([repo, count]) => `${repo} (${count})`)
    .join(", ");

  const toolSummary = [...toolCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tool, count]) => `${tool}: ${count}`)
    .join(", ");

  const latest = recent
    .slice(0, 3)
    .map((session) => `- ${session.tool}: ${session.projectLabel} — ${session.headline}`);

  const rangeLabel = period === "today" ? "today" : "the last 7 days";

  return [
    `${recent.length} recent session(s) from ${rangeLabel}.`,
    `By tool: ${toolSummary}`,
    `Active tmux-backed sessions: ${activeCount}`,
    `Top repos: ${topRepos}`,
    "Latest threads:",
    ...latest,
  ].join("\n");
}
