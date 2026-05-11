import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function resolveProjectDistributionFilePath(inputPath: string): string {
  // 1. Absolute path — return as-is if it exists
  if (path.isAbsolute(inputPath)) {
    if (fs.existsSync(inputPath)) {
      return inputPath;
    }
    throw new Error(`Absolute path not found: ${inputPath}`);
  }

  // Compute important paths
  // __dirname is /brain/projects/probot/src/scripts
  // repoRoot should be /brain (four levels up)
  // probotRoot should be /brain/projects/probot (two levels up)
  const repoRoot = path.resolve(__dirname, "../../../..");
  const probotRoot = path.resolve(__dirname, "../..");

  // 2. Path relative to current working directory
  const cwdPath = path.resolve(process.cwd(), inputPath);
  if (fs.existsSync(cwdPath)) {
    return cwdPath;
  }

  // 3. Path relative to repo root
  const repoPath = path.resolve(repoRoot, inputPath);
  if (fs.existsSync(repoPath)) {
    return repoPath;
  }

  // 4. Path relative to projects/probot
  const probotPath = path.resolve(probotRoot, inputPath);
  if (fs.existsSync(probotPath)) {
    return probotPath;
  }

  // Not found — throw error with attempted paths (safe: no env vars, no secrets)
  const attemptedPaths = [cwdPath, repoPath, probotPath];
  throw new Error(
    `File not found: ${inputPath}\n\nAttempted paths:\n${attemptedPaths.map((p) => `  - ${p}`).join("\n")}`
  );
}
