import type { SearchHit } from "../types/app.js";
import { runCommand } from "../connectors/process.js";
import fs from "node:fs";
import path from "node:path";

const SEARCH_PATHS = ["projects", "operations", "ai"];
const STOP_WORDS = new Set([
  "a",
  "about",
  "agree",
  "an",
  "and",
  "did",
  "for",
  "in",
  "is",
  "it",
  "of",
  "repo",
  "strategy",
  "that",
  "the",
  "this",
  "to",
  "we",
  "what",
  "with",
]);

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token))
    .slice(0, 6);
}

function isRepoOverviewQuery(query: string): boolean {
  const normalized = query.toLowerCase();
  return (
    normalized.includes("what is in this repo") ||
    normalized.includes("what's in this repo") ||
    normalized.includes("what is this repo") ||
    normalized.includes("repo overview") ||
    normalized.includes("summarize this repo")
  );
}

function isDecisionQuery(query: string): boolean {
  const normalized = query.toLowerCase();
  return normalized.includes("what did we agree") || normalized.includes("decision");
}

function getRepoOverview(brainRoot: string): string {
  const readmePath = path.join(brainRoot, "README.md");
  const readme = fs.existsSync(readmePath) ? fs.readFileSync(readmePath, "utf8") : "";
  const structure = readme
    .split("\n")
    .filter((line) => /^- `[^`]+`/.test(line.trim()))
    .slice(0, 7)
    .map((line) => line.trim());

  return [
    "This repo is the Brain: a private knowledge base and operational control repo for personal, business, project, AI, and infrastructure context.",
    "Main areas:",
    ...structure,
    "Use it as the canonical source for notes, skills, operations, and project context.",
  ].join("\n");
}

async function runBrainSearch(pattern: string, searchPaths: string[]): Promise<SearchHit[]> {
  const args = ["-n", "-i", "-m", "8", "-e", pattern, ...searchPaths];
  let stdout = "";
  try {
    ({ stdout } = await runCommand("rg", args, 12_000));
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === 1
    ) {
      return [];
    }
    throw error;
  }

  const lines = stdout.split("\n").map((line) => line.trim()).filter(Boolean);
  return lines.slice(0, 6).map((line): SearchHit => {
    const match = line.match(/^(.*?):(\d+):(.*)$/);
    if (!match) {
      return { path: line, preview: line };
    }

    const matchedPath = match[1];
    const matchedLine = match[2];
    const matchedPreview = match[3];
    if (!matchedPath || !matchedLine || matchedPreview === undefined) {
      return { path: line, preview: line };
    }

    return {
      path: matchedPath,
      line: Number(matchedLine),
      preview: matchedPreview.trim(),
    };
  });
}

export async function searchBrain(brainRoot: string, query: string): Promise<SearchHit[]> {
  const searchPaths = SEARCH_PATHS.map((part) => `${brainRoot}/${part}`);
  const exact = await runBrainSearch(query, searchPaths);
  if (exact.length > 0) return exact;

  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];

  const fallbackPattern = tokens.map(escapeRegex).join("|");
  return runBrainSearch(fallbackPattern, searchPaths);
}

export async function answerBrainQuery(brainRoot: string, query: string): Promise<string> {
  if (isRepoOverviewQuery(query)) {
    return getRepoOverview(brainRoot);
  }

  if (isDecisionQuery(query)) {
    const decisionPath = path.join(brainRoot, "operations", "decision-log.md");
    const decisionHits = await runBrainSearch(
      tokenizeQuery(query).map(escapeRegex).join("|") || "Decision|Context|Impact",
      [decisionPath],
    );

    if (decisionHits.length > 0) {
      return [
        "Relevant decision-log matches:",
        ...decisionHits.map((hit) => `${hit.path}:${hit.line ?? "?"}\n${hit.preview}`),
      ].join("\n\n");
    }
  }

  const hits = await searchBrain(brainRoot, query);
  if (hits.length === 0) {
    return "I could not find a solid Brain match for that yet. Try a more specific repo, project, or decision keyword.";
  }

  return [
    "Top Brain matches:",
    ...hits.map((hit) => `${hit.path}${hit.line ? `:${hit.line}` : ""}\n${hit.preview}`),
  ].join("\n\n");
}
