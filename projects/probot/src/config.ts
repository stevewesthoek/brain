import { config as loadDotEnv } from "dotenv";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultBrainRoot = path.resolve(projectRoot, "..", "..");
const defaultDataDir = path.join(projectRoot, "data");
const defaultNotesDir = path.join(projectRoot, "inbox");
const defaultEnvPath = path.join(os.homedir(), ".config", "probot", ".env");
const localEnvPath = path.join(projectRoot, ".env");

const envPath =
  process.env.PROBOT_ENV_FILE && fs.existsSync(process.env.PROBOT_ENV_FILE)
    ? process.env.PROBOT_ENV_FILE
    : fs.existsSync(defaultEnvPath)
      ? defaultEnvPath
      : localEnvPath;

loadDotEnv({ path: envPath });

const schema = z.object({
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_ALLOWED_USER_IDS: z.string().min(1),
  PROBOT_BRAIN_ROOT: z.string().default(defaultBrainRoot),
  PROBOT_DATA_DIR: z.string().default(defaultDataDir),
  PROBOT_NOTES_DIR: z.string().default(defaultNotesDir),
  PROBOT_ALLOWED_ROOTS: z.string().default(defaultBrainRoot),
  PROBOT_MAX_FILE_MB: z.coerce.number().int().positive().default(20),
  PROBOT_DEBUG: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  CLAUDE_PROJECTS_DIR: z.string().default(path.join(os.homedir(), ".claude", "projects")),
  CODEX_SESSIONS_DIR: z.string().default(path.join(os.homedir(), ".codex", "sessions")),
  CODEX_SESSION_INDEX: z.string().default(path.join(os.homedir(), ".codex", "session_index.jsonl")),
});

const parsed = schema.parse(process.env);

const splitCsv = (raw: string): string[] =>
  raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

export interface Config {
  telegramBotToken: string;
  telegramAllowedUserIds: number[];
  brainRoot: string;
  dataDir: string;
  notesDir: string;
  allowedRoots: string[];
  maxFileBytes: number;
  debug: boolean;
  claudeProjectsDir: string;
  codexSessionsDir: string;
  codexSessionIndex: string;
  projectRoot: string;
  hostname: string;
  envPath: string;
}

export const config: Config = {
  telegramBotToken: parsed.TELEGRAM_BOT_TOKEN,
  telegramAllowedUserIds: splitCsv(parsed.TELEGRAM_ALLOWED_USER_IDS).map((item) => Number(item)),
  brainRoot: path.resolve(parsed.PROBOT_BRAIN_ROOT),
  dataDir: path.resolve(parsed.PROBOT_DATA_DIR),
  notesDir: path.resolve(parsed.PROBOT_NOTES_DIR),
  allowedRoots: splitCsv(parsed.PROBOT_ALLOWED_ROOTS).map((item) => path.resolve(item)),
  maxFileBytes: parsed.PROBOT_MAX_FILE_MB * 1024 * 1024,
  debug: parsed.PROBOT_DEBUG,
  claudeProjectsDir: path.resolve(parsed.CLAUDE_PROJECTS_DIR),
  codexSessionsDir: path.resolve(parsed.CODEX_SESSIONS_DIR),
  codexSessionIndex: path.resolve(parsed.CODEX_SESSION_INDEX),
  projectRoot,
  hostname: os.hostname(),
  envPath,
};
