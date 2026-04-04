import fs from "node:fs";
import path from "node:path";
import { runCommand } from "../connectors/process.js";
import type { FileHit } from "../types/app.js";

const SENSITIVE_SEGMENTS = [
  ".ssh",
  ".gnupg",
  ".aws",
  ".config",
  "Library/Keychains",
  "Application Support/Google/Chrome",
  "Application Support/Firefox",
];

function isWithinRoot(filePath: string, roots: string[]): boolean {
  const resolved = path.resolve(filePath);
  return roots.some((root) => resolved === root || resolved.startsWith(`${root}${path.sep}`));
}

function isSensitivePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, "/");
  return SENSITIVE_SEGMENTS.some((segment) => normalized.includes(segment)) || normalized.endsWith(".env");
}

export function assertSafeFilePath(filePath: string, roots: string[]): string {
  const resolved = path.resolve(filePath);

  if (!isWithinRoot(resolved, roots)) {
    throw new Error("Path is outside the allowed roots.");
  }

  if (isSensitivePath(resolved)) {
    throw new Error("Path is blocked by the sensitive-path denylist.");
  }

  return resolved;
}

export async function searchFiles(roots: string[], query: string): Promise<FileHit[]> {
  const { stdout: fileList } = await runCommand("rg", ["--files", ...roots], 15_000);
  const lower = query.toLowerCase();

  const nameMatches = fileList
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((entry) => entry.toLowerCase().includes(lower))
    .slice(0, 5);

  if (nameMatches.length > 0) {
    return nameMatches.map((entry) => {
      const stats = fs.statSync(entry);
      return {
        path: entry,
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        matchType: "name",
        preview: path.basename(entry),
      };
    });
  }

  let stdout = "";
  try {
    ({ stdout } = await runCommand("rg", ["-n", "-i", "-m", "10", query, ...roots], 15_000));
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

  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5)
    .map((line): FileHit => {
      const match = line.match(/^(.*?):(\d+):(.*)$/);
      if (!match) {
        return {
          path: line,
          sizeBytes: 0,
          modifiedAt: "",
          matchType: "content" as const,
          preview: line,
        };
      }

      const matchedPath = match[1];
      const matchedLine = match[2];
      const matchedPreview = match[3];
      if (!matchedPath || !matchedLine || matchedPreview === undefined) {
        return {
          path: line,
          sizeBytes: 0,
          modifiedAt: "",
          matchType: "content" as const,
          preview: line,
        };
      }

      const stats = fs.statSync(matchedPath);
      return {
        path: matchedPath,
        sizeBytes: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        matchType: "content" as const,
        preview: `L${matchedLine} ${matchedPreview.trim()}`,
      };
    });
}

export function formatFileHit(hit: FileHit): string {
  const sizeKb = (hit.sizeBytes / 1024).toFixed(1);
  return `${hit.path}\n${hit.matchType} match, ${sizeKb} KB, updated ${hit.modifiedAt}\n${hit.preview}`;
}
