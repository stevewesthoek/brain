import type Database from "better-sqlite3";
import type { Config } from "../config.js";
import type { ApprovalStore } from "../store/db.js";

export interface AppContext {
  config: Config;
  db: Database.Database;
  approvals: ApprovalStore;
}

export interface SessionSummary {
  tool: "claude" | "codex";
  id: string;
  projectLabel: string;
  cwd: string;
  age: string;
  updatedAt: string;
  headline: string;
  activeInTmux: boolean;
}

export interface SearchHit {
  path: string;
  line?: number;
  preview: string;
}

export interface FileHit {
  path: string;
  sizeBytes: number;
  modifiedAt: string;
  matchType: "name" | "content";
  preview: string;
}
