import { appendNote } from "./notes.js";
import { answerBrainQuery } from "./brain.js";
import { assertSafeFilePath, formatFileHit, searchFiles } from "./files.js";
import { buildSessionOverview, buildTimeSummary, formatSessionOverview } from "./sessions.js";
import { getStatusSummary } from "./status.js";
import type { AppContext } from "../types/app.js";

function startsWithAny(text: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => text.startsWith(prefix));
}

function extractNoteText(text: string): string | null {
  const normalized = text.trim();
  const prefixes = [
    "remember that ",
    "remember ",
    "note that ",
    "note ",
    "save this note ",
  ];

  for (const prefix of prefixes) {
    if (normalized.toLowerCase().startsWith(prefix)) {
      return normalized.slice(prefix.length).trim();
    }
  }

  return null;
}

function isSessionSummaryIntent(text: string): "today" | "week" | null {
  const normalized = text.toLowerCase();
  if (normalized.includes("last week") || normalized.includes("this week")) return "week";
  if (
    normalized.includes("what did i do today") ||
    normalized.includes("today summary") ||
    normalized.includes("what did i work on today")
  ) {
    return "today";
  }
  return null;
}

export async function routeNaturalLanguage(app: AppContext, rawText: string): Promise<string> {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  if (/^(hi|hello|hey)\b/.test(lower)) {
    return "I’m live. You can talk naturally now. Try: “what is in this repo”, “what did I work on today”, “remember that…”, “find the ProBot files”, or “status”.";
  }

  if (lower === "status" || lower.includes("are you working") || lower.includes("what is your status")) {
    return getStatusSummary(app.config);
  }

  const period = isSessionSummaryIntent(lower);
  if (period) {
    return buildTimeSummary(
      period,
      app.config.claudeProjectsDir,
      app.config.codexSessionsDir,
      app.config.codexSessionIndex,
    );
  }

  if (
    lower.includes("what am i working on") ||
    lower.includes("where am i") ||
    lower.includes("show my sessions")
  ) {
    const sessions = await buildSessionOverview(
      app.config.claudeProjectsDir,
      app.config.codexSessionsDir,
      app.config.codexSessionIndex,
    );
    return formatSessionOverview(sessions, 6);
  }

  const noteText = extractNoteText(text);
  if (noteText) {
    const notePath = appendNote(app.config.notesDir, noteText);
    return `Saved note to:\n${notePath}`;
  }

  if (
    startsWithAny(lower, ["find ", "find file ", "look for ", "where is "]) ||
    lower.includes("looking for file")
  ) {
    const query = text
      .replace(/^find file\s+/i, "")
      .replace(/^find\s+/i, "")
      .replace(/^look for\s+/i, "")
      .replace(/^where is\s+/i, "")
      .trim();

    const hits = await searchFiles(app.config.allowedRoots, query);
    if (hits.length === 0) {
      return "I could not find a matching file in the allowed roots.";
    }

    return hits.map(formatFileHit).join("\n\n");
  }

  if (startsWithAny(lower, ["send me ", "send file "])) {
    const candidatePath = text.replace(/^send me\s+/i, "").replace(/^send file\s+/i, "").trim();
    try {
      const safePath = assertSafeFilePath(candidatePath, app.config.allowedRoots);
      return `Use /send ${safePath} to request a file send with approval.`;
    } catch {
      return "I can only send files from allowed local roots, and I still require /send for the approval step.";
    }
  }

  return answerBrainQuery(app.config.brainRoot, text);
}
