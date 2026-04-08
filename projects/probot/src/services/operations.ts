import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import type { Config } from "../config.js";
import type { SessionSummary } from "../types/app.js";
import { buildResumePrompt, resolveRepoPath } from "./handoff.js";
import { buildSessionOverview } from "./sessions.js";

export interface RunPreset {
  key: string;
  description: string;
}

const RUN_PRESETS: RunPreset[] = [
  {
    key: "restart-probot",
    description: "Restart the local ProBot launchd agent on this Mac.",
  },
];

const BRAIN_ROOT = path.resolve(import.meta.dirname, "..", "..", "..");
const OFFICE_LOG_DIR = path.join(os.homedir(), "Library", "Logs", "office-scheduler");
const SCHEDULER_REPORT_PATH = path.join(BRAIN_ROOT, "runtime", "local", "office-scheduler", "latest-run.md");
const CONTINUE_HELPER_PATH = path.join(BRAIN_ROOT, "tools", "scripts", "probot-continue.sh");

const TAIL_TARGETS = new Map<string, { label: string; filePath: (config: Config) => string }>([
  [
    "probot",
    {
      label: "ProBot stderr",
      filePath: (config) => path.join(config.projectRoot, "logs", "stderr.log"),
    },
  ],
  [
    "probot-stderr",
    {
      label: "ProBot stderr",
      filePath: (config) => path.join(config.projectRoot, "logs", "stderr.log"),
    },
  ],
  [
    "probot-stdout",
    {
      label: "ProBot stdout",
      filePath: (config) => path.join(config.projectRoot, "logs", "stdout.log"),
    },
  ],
  [
    "scheduler",
    {
      label: "Office scheduler nightly log",
      filePath: () => path.join(OFFICE_LOG_DIR, "nightly.log"),
    },
  ],
  [
    "scheduler-error",
    {
      label: "Office scheduler error log",
      filePath: () => path.join(OFFICE_LOG_DIR, "nightly.error.log"),
    },
  ],
  [
    "n8n-backup",
    {
      label: "Office scheduler n8n-backup log",
      filePath: () => path.join(OFFICE_LOG_DIR, "n8n-backup.log"),
    },
  ],
  [
    "dance-of-life",
    {
      label: "Office scheduler dance-of-life log",
      filePath: () => path.join(OFFICE_LOG_DIR, "dance-of-life.log"),
    },
  ],
  [
    "dance-of-life-sync",
    {
      label: "Office scheduler dance-of-life-sync log",
      filePath: () => path.join(OFFICE_LOG_DIR, "dance-of-life-sync.log"),
    },
  ],
  [
    "claude-cleanup",
    {
      label: "Office scheduler claude cleanup log",
      filePath: () => path.join(OFFICE_LOG_DIR, "claude-cleanup.log"),
    },
  ],
]);

function tailLines(filePath: string, count = 40): string[] {
  if (!fs.existsSync(filePath)) {
    return ["Log file not found."];
  }

  const content = fs.readFileSync(filePath, "utf8");
  const lines = content
    .split("\n")
    .map((line) => line.trimEnd())
    .filter(Boolean);

  if (lines.length === 0) {
    return ["Log file is empty."];
  }

  return lines.slice(-count);
}

function matchRepoSessions(sessions: SessionSummary[], repoPath: string): SessionSummary[] {
  return sessions
    .filter((session) => session.cwd === repoPath || session.cwd.startsWith(`${repoPath}${path.sep}`))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 3);
}

function repoSessionName(repo: string): string {
  return repo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24) || "work";
}

function buildContinueCommand(repoPath: string, preferredTool = "auto"): string {
  return `${CONTINUE_HELPER_PATH} ${JSON.stringify(repoPath)} ${preferredTool}`;
}

export function listRunPresets(): RunPreset[] {
  return RUN_PRESETS;
}

export function describeRunPresets(): string {
  return RUN_PRESETS.map((preset) => `- ${preset.key} — ${preset.description}`).join("\n");
}

export function isValidRunPreset(preset: string): boolean {
  return RUN_PRESETS.some((item) => item.key === preset);
}

export function describeTailTargets(): string {
  return [...new Set(TAIL_TARGETS.keys())].sort().join(", ");
}

export function describeReportTargets(): string {
  return "scheduler";
}

export function readTailTarget(config: Config, rawTarget: string, lines = 40): string {
  const target = rawTarget.trim().toLowerCase() || "probot";
  const spec = TAIL_TARGETS.get(target);
  if (!spec) {
    return `Unknown tail target: ${rawTarget || "(empty)"}\nAvailable targets: ${describeTailTargets()}`;
  }

  const filePath = spec.filePath(config);
  const content = tailLines(filePath, lines).join("\n");
  return `${spec.label}\n${filePath}\n\n${content}`;
}

export function readReportTarget(rawTarget: string): string {
  const target = rawTarget.trim().toLowerCase() || "scheduler";
  if (target !== "scheduler") {
    return `Unknown report target: ${rawTarget || "(empty)"}\nAvailable reports: ${describeReportTargets()}`;
  }

  if (!fs.existsSync(SCHEDULER_REPORT_PATH)) {
    return `Report not found.\n${SCHEDULER_REPORT_PATH}`;
  }

  const content = fs.readFileSync(SCHEDULER_REPORT_PATH, "utf8").trim();
  return `Office scheduler report\n${SCHEDULER_REPORT_PATH}\n\n${content}`;
}

export function readSchedulerSummary(): string | null {
  if (!fs.existsSync(SCHEDULER_REPORT_PATH)) return null;
  try {
    const content = fs.readFileSync(SCHEDULER_REPORT_PATH, "utf8");
    const lines = content.split("\n").map((line) => line.trim()).filter(Boolean);
    const generated = lines.find((line) => line.startsWith("Generated at:"));
    const failures = lines.filter((line) => line.includes("| `failed` |"));
    if (generated && failures.length === 0) {
      return `${generated.replace("Generated at: ", "")} · no failed scheduler jobs`;
    }
    if (generated) {
      return `${generated.replace("Generated at: ", "")} · failures: ${failures.length}`;
    }
    return "scheduler report present";
  } catch {
    return "scheduler report unreadable";
  }
}

export async function buildResumeGuide(config: Config, repoName: string): Promise<string> {
  const repoPath = resolveRepoPath(repoName, config.repoAliases);
  if (!repoPath) {
    return `Unknown repo: ${repoName}\nUse \`repos\` to list known repos.`;
  }

  const prompt = buildResumePrompt(repoPath);
  const sessions = await buildSessionOverview(
    config.claudeProjectsDir,
    config.codexSessionsDir,
    config.codexSessionIndex,
  );
  const repoSessions = matchRepoSessions(sessions, repoPath);
  const suggestedTmux = repoSessionName(repoName);

  const lines = [
    `Resume for ${repoName}`,
    "",
    `Repo path: ${repoPath}`,
    "Remote entry from outside the office:",
    "1. ssh office",
    "2. tmux ls",
  ];

  if (repoSessions.length > 0) {
    lines.push("Likely matching tmux-backed sessions:");
    for (const session of repoSessions) {
      lines.push(
        `- ${session.tool} · ${session.id} · ${session.age}${session.activeInTmux ? " · active" : ""}`,
      );
      lines.push(`  attach: tmux attach -t ${session.id}`);
    }
  } else {
    lines.push(`No matching active session detected. Suggested new tmux session: ${suggestedTmux}`);
    lines.push(`Create or attach: tmux new -As ${suggestedTmux}`);
  }

  lines.push(`cd ${repoPath}`);
  lines.push(`One-command continuation after SSH: ${buildContinueCommand(repoPath)}`);
  lines.push("");
  lines.push("Resume prompt:");
  lines.push(prompt);

  return lines.join("\n");
}

export function buildSshGuide(config: Config, repoName?: string): string {
  const lines = [
    "SSH continuation",
    "",
    "From outside the office network:",
    "- Connect with Tailscale enabled.",
    "- Use your mobile SSH app against the existing alias: ssh office",
    "- This stays plain SSH + tmux, which is compatible with Moshi on iOS.",
    "",
    "After connecting:",
    "- tmux ls",
    "- tmux attach -t <session-id>",
  ];

  if (repoName) {
    const repoPath = resolveRepoPath(repoName, config.repoAliases);
    if (repoPath) {
      const suggestedTmux = repoSessionName(repoName);
      lines.push(`- cd ${repoPath}`);
      lines.push(`- tmux new -As ${suggestedTmux}`);
      lines.push(`- ${buildContinueCommand(repoPath)}`);
    }
  }

  return lines.join("\n");
}

export async function executeRunPreset(preset: string): Promise<string> {
  if (preset !== "restart-probot") {
    return `Unknown preset: ${preset}`;
  }

  const uid = typeof process.getuid === "function" ? process.getuid() : undefined;
  if (uid === undefined) {
    return "Cannot restart ProBot: user ID is unavailable on this platform.";
  }

  const command = `sleep 1; launchctl kickstart -k gui/${uid}/tools.prochat.probot`;
  const child = spawn("/bin/zsh", ["-lc", command], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  return "Scheduled ProBot restart via launchctl. Slack and Telegram may disconnect briefly while the agent restarts.";
}
