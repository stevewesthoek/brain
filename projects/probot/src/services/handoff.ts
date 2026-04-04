import fs from "node:fs";
import path from "node:path";

export interface RepoHandoffStatus {
  name: string;
  path: string;
  exists: boolean;
  goal: string | null;
  updatedAt: string | null;
}

export function resolveRepoPath(input: string, aliases: Map<string, string>): string | null {
  const trimmed = input.trim();
  if (trimmed.startsWith("/") && fs.existsSync(trimmed)) {
    return trimmed;
  }
  const key = trimmed.toLowerCase();
  for (const [alias, repoPath] of aliases) {
    if (alias.toLowerCase() === key) return repoPath;
  }
  return null;
}

function extractSection(content: string, heading: string): string | null {
  const lines = content.split("\n");
  let inSection = false;
  const collected: string[] = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (inSection) break;
      if (line.trim() === `## ${heading}`) {
        inSection = true;
        continue;
      }
    }
    if (inSection && line.trim()) {
      collected.push(line.trim());
    }
  }
  return collected.length > 0 ? collected[0] ?? null : null;
}

function extractSectionFull(content: string, heading: string): string | null {
  const lines = content.split("\n");
  let inSection = false;
  const collected: string[] = [];
  for (const line of lines) {
    if (line.startsWith("## ")) {
      if (inSection) break;
      if (line.trim() === `## ${heading}`) {
        inSection = true;
        continue;
      }
    }
    if (inSection) {
      collected.push(line);
    }
  }
  const result = collected.join("\n").trim();
  return result.length > 0 ? result : null;
}

export function readCurrentHandoff(repoPath: string): { content: string; exists: boolean } {
  const handoffPath = path.join(repoPath, ".ai", "current.md");
  if (!fs.existsSync(handoffPath)) {
    return { content: "No handoff found. Run /handoff setup to initialize.", exists: false };
  }
  return { content: fs.readFileSync(handoffPath, "utf8"), exists: true };
}

export function listRepoHandoffs(aliases: Map<string, string>): RepoHandoffStatus[] {
  const results: RepoHandoffStatus[] = [];
  for (const [name, repoPath] of aliases) {
    const handoffPath = path.join(repoPath, ".ai", "current.md");
    const exists = fs.existsSync(handoffPath);
    let goal: string | null = null;
    let updatedAt: string | null = null;
    if (exists) {
      try {
        const content = fs.readFileSync(handoffPath, "utf8");
        goal = extractSection(content, "Goal");
        const stat = fs.statSync(handoffPath);
        updatedAt = stat.mtime.toISOString().slice(0, 16).replace("T", " ");
      } catch {
        // best-effort
      }
    }
    results.push({ name, path: repoPath, exists, goal, updatedAt });
  }
  return results;
}

export function buildResumePrompt(repoPath: string): string {
  const handoffPath = path.join(repoPath, ".ai", "current.md");
  if (!fs.existsSync(handoffPath)) {
    return "Start a new session.";
  }
  try {
    const content = fs.readFileSync(handoffPath, "utf8");
    const prompt = extractSectionFull(content, "Resume prompt");
    return prompt ?? "Start a new session.";
  } catch {
    return "Start a new session.";
  }
}

export function formatHandoffSummary(name: string, content: string): string {
  const header = `Handoff: ${name}\n\n`;
  const maxBody = 3900 - header.length;
  const body = content.length > maxBody ? content.slice(0, maxBody) + "\n…(truncated)" : content;
  return header + body;
}
