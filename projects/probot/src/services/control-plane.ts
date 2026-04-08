import type { ApprovalStore } from "../store/db.js";
import type { Config } from "../config.js";
import type { SessionSummary } from "../types/app.js";
import { listRepoHandoffs, readCurrentHandoff, resolveRepoPath } from "./handoff.js";
import { buildSessionOverview } from "./sessions.js";
import { buildResumeGuide, buildSshGuide, readSchedulerSummary } from "./operations.js";

function freshnessLabel(updatedAt: string | null): string {
  if (!updatedAt) return "no handoff";
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  if (ageMs < 6 * 60 * 60 * 1000) return "fresh";
  if (ageMs < 24 * 60 * 60 * 1000) return "stale";
  return "old";
}

function summarizeLine(text: string, limit = 90): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= limit) return compact;
  return `${compact.slice(0, limit - 1)}…`;
}

function repoSessions(sessions: SessionSummary[], repoPath: string): SessionSummary[] {
  return sessions.filter((session) => session.cwd === repoPath || session.cwd.startsWith(`${repoPath}/`));
}

function sessionLine(session: SessionSummary): string {
  return `${session.tool} · ${session.projectLabel} · ${session.age}${session.activeInTmux ? " · tmux" : ""} · ${summarizeLine(session.headline, 70)}`;
}

export async function buildHomeOverview(config: Config, approvals: ApprovalStore): Promise<string> {
  const sessions = await buildSessionOverview(
    config.claudeProjectsDir,
    config.codexSessionsDir,
    config.codexSessionIndex,
  );
  const pendingCount = approvals.list("pending", 20).length;
  const repoRows = listRepoHandoffs(config.repoAliases)
    .map((repo) => {
      const matching = repoSessions(sessions, repo.path);
      const active = matching.filter((session) => session.activeInTmux).length;
      return {
        repo,
        matchingCount: matching.length,
        activeCount: active,
        line: `${repo.name} · ${freshnessLabel(repo.updatedAt)} · ${repo.goal ? summarizeLine(repo.goal, 52) : "no goal"}${matching.length ? ` · ${matching.length} session(s)` : ""}${active ? ` · ${active} active` : ""}`,
      };
    })
    .slice(0, 8);

  const lines = [
    "ProBot home",
    "",
    `Host: ${config.hostname}`,
    `Slack: ${config.slackBotToken && config.slackAppToken ? "on" : "off"}`,
    `Telegram: on (${config.telegramAllowedUserIds.length} user(s))`,
    `Pending approvals: ${pendingCount}`,
  ];

  const schedulerSummary = readSchedulerSummary();
  if (schedulerSummary) {
    lines.push(`Scheduler: ${schedulerSummary}`);
  }

  lines.push("", "Recent sessions:");

  if (sessions.length === 0) {
    lines.push("- none detected");
  } else {
    for (const session of sessions.slice(0, 5)) {
      lines.push(`- ${sessionLine(session)}`);
    }
  }

  lines.push("", "Repos:");
  if (repoRows.length === 0) {
    lines.push("- no repo aliases configured");
  } else {
    for (const row of repoRows) lines.push(`- ${row.line}`);
  }

  lines.push(
    "",
    "Fast path:",
    "- focus <repo>",
    "- resume <repo>",
    "- sessions <repo>",
    "- ssh <repo>",
    "- tail probot",
    "- report scheduler",
  );

  return lines.join("\n");
}

export async function buildRepoFocus(config: Config, repoName: string): Promise<string> {
  const repoPath = resolveRepoPath(repoName, config.repoAliases);
  if (!repoPath) {
    return `Unknown repo: ${repoName}\nUse \`repos\` to list known repos.`;
  }

  const sessions = await buildSessionOverview(
    config.claudeProjectsDir,
    config.codexSessionsDir,
    config.codexSessionIndex,
  );
  const matching = repoSessions(sessions, repoPath).slice(0, 5);
  const handoff = readCurrentHandoff(repoPath);
  const sshGuide = buildSshGuide(config, repoName);
  const resumeGuide = await buildResumeGuide(config, repoName);

  const lines = [
    `Focus: ${repoName}`,
    "",
    `Path: ${repoPath}`,
  ];

  if (handoff.exists) {
    const handoffPreview = summarizeLine(handoff.content.replace(/^#.*$/m, "").trim(), 220);
    lines.push(`Handoff: ${handoffPreview}`);
  } else {
    lines.push("Handoff: none found");
  }

  lines.push("", "Matching sessions:");
  if (matching.length === 0) {
    lines.push("- none detected");
  } else {
    for (const session of matching) {
      lines.push(`- ${sessionLine(session)}`);
      if (session.activeInTmux) {
        lines.push(`  attach: tmux attach -t ${session.id}`);
      }
    }
  }

  lines.push("", "SSH path:", sshGuide, "", "Resume path:", resumeGuide);
  return lines.join("\n");
}

export function filterSessionsByRepoName(
  sessions: SessionSummary[],
  config: Config,
  repoName: string,
): SessionSummary[] | null {
  const repoPath = resolveRepoPath(repoName, config.repoAliases);
  if (!repoPath) return null;
  return repoSessions(sessions, repoPath);
}
