import type { ApprovalStore } from "../store/db.js";
import type { Config } from "../config.js";
import type { SessionSummary } from "../types/app.js";
import { listRepoHandoffs, readCurrentHandoff, resolveRepoPath } from "./handoff.js";
import { buildSessionOverview } from "./sessions.js";
import { buildResumeGuide, buildSessionResumeGuide, buildSshGuide, readSchedulerSummary } from "./operations.js";

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

interface RepoSignal {
  freshness: "fresh" | "stale" | "old" | "none";
  hasHandoff: boolean;
  goal: string | null;
}

interface RankedSession {
  session: SessionSummary;
  score: number;
  signal: RepoSignal;
  intent: string;
}

export interface ContinuationCard {
  selection: number;
  tool: SessionSummary["tool"];
  projectLabel: string;
  cwd: string;
  age: string;
  headline: string;
  activeInTmux: boolean;
  intentLabel: string;
  suggestedActionLabel: string;
  suggestedCommand: string;
}

function matchRepoPath(session: SessionSummary, repoPath: string): boolean {
  return session.cwd === repoPath || session.cwd.startsWith(`${repoPath}/`);
}

function deriveRepoSignal(session: SessionSummary, config: Config): RepoSignal {
  for (const repo of listRepoHandoffs(config.repoAliases)) {
    if (!matchRepoPath(session, repo.path)) continue;
    return {
      freshness: freshnessLabel(repo.updatedAt) as RepoSignal["freshness"],
      hasHandoff: repo.exists,
      goal: repo.goal,
    };
  }
  return { freshness: "none", hasHandoff: false, goal: null };
}

function recencyScore(updatedAt: string): number {
  const ageMs = Date.now() - new Date(updatedAt).getTime();
  if (!Number.isFinite(ageMs) || ageMs < 0) return 0;
  const ageMinutes = ageMs / 60_000;
  if (ageMinutes <= 30) return 80;
  if (ageMinutes <= 120) return 60;
  if (ageMinutes <= 12 * 60) return 40;
  if (ageMinutes <= 24 * 60) return 25;
  if (ageMinutes <= 3 * 24 * 60) return 10;
  return 0;
}

function scoreSession(session: SessionSummary, signal: RepoSignal): number {
  let score = recencyScore(session.updatedAt);
  if (session.activeInTmux) score += 120;
  if (signal.freshness === "fresh") score += 70;
  else if (signal.freshness === "stale") score += 35;
  else if (signal.freshness === "old") score += 10;
  if (signal.hasHandoff) score += 10;
  if (session.headline === "(unnamed)" || session.headline === "(no summary)") score -= 5;
  return score;
}

function inferIntentLabel(session: SessionSummary, signal: RepoSignal): string {
  const haystack = `${session.headline} ${signal.goal ?? ""}`.toLowerCase();
  const rules: Array<{ label: string; keywords: string[] }> = [
    { label: "deploy", keywords: ["deploy", "release", "ship", "prod", "production", "vercel", "dokploy"] },
    { label: "ops", keywords: ["monitor", "uptime", "alert", "new relic", "infra", "server", "ssh", "tmux", "scheduler"] },
    { label: "analytics", keywords: ["analytics", "tracking", "umami", "new relic", "telemetry", "metrics"] },
    { label: "bugfix", keywords: ["bug", "fix", "broken", "error", "failing", "issue", "debug", "investigate"] },
    { label: "review", keywords: ["review", "pr", "pull request", "diff", "comments", "second opinion"] },
    { label: "docs", keywords: ["docs", "readme", "spec", "documentation", "handoff"] },
    { label: "design", keywords: ["design", "ui", "ux", "visual", "layout", "polish"] },
    { label: "auth", keywords: ["auth", "oauth", "token", "login", "slack", "telegram"] },
    { label: "data", keywords: ["migration", "database", "sql", "schema", "supabase", "postgres"] },
    { label: "research", keywords: ["research", "notebooklm", "investigate", "analyze", "strategy"] },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((keyword) => haystack.includes(keyword))) return rule.label;
  }
  return "general";
}

function shortRepoName(projectLabel: string): string {
  const parts = projectLabel.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? projectLabel;
}

function humanIntentLabel(intent: string, session: SessionSummary): string {
  return `${intent} · ${shortRepoName(session.projectLabel)}`;
}

function repoAliasForSession(session: SessionSummary, config: Config): string {
  for (const [alias, repoPath] of config.repoAliases) {
    if (matchRepoPath(session, repoPath)) return alias;
  }
  return shortRepoName(session.projectLabel);
}

function suggestedNextAction(ranked: RankedSession, config: Config, selection?: number): string {
  if (selection !== undefined) {
    return `Suggested next action: continue ${selection}`;
  }
  const repoRef = repoAliasForSession(ranked.session, config);
  return `Suggested next action: resume ${repoRef}`;
}

function suggestedCommand(ranked: RankedSession, config: Config, selection?: number): string {
  if (selection !== undefined) {
    return `continue ${selection}`;
  }
  return `resume ${repoAliasForSession(ranked.session, config)}`;
}

function rankSessionsForContinuation(sessions: SessionSummary[], config: Config): RankedSession[] {
  return sessions
    .map((session) => {
      const signal = deriveRepoSignal(session, config);
      const intent = inferIntentLabel(session, signal);
      return {
        session,
        signal,
        score: scoreSession(session, signal),
        intent,
      };
    })
    .sort((a, b) => b.score - a.score || b.session.updatedAt.localeCompare(a.session.updatedAt));
}

function compactSessionLine(index: number, ranked: RankedSession, config: Config): string {
  const { session, signal, intent } = ranked;
  const toolLabel = session.tool === "claude" ? "Claude" : session.tool === "codex" ? "Codex" : "Gemini";
  const tags = [];
  if (session.activeInTmux) tags.push("live");
  if (signal.freshness === "fresh") tags.push("fresh handoff");
  else if (signal.freshness === "stale") tags.push("stale handoff");
  else if (signal.freshness === "old") tags.push("old handoff");
  tags.push(humanIntentLabel(intent, session));
  const tagText = tags.length > 0 ? ` · ${tags.join(" · ")}` : "";
  return `${index}. ${toolLabel} · ${session.projectLabel} · ${session.age}${tagText}\n   ${summarizeLine(session.headline, 54)}\n   ${suggestedNextAction(ranked, config, index)}`;
}

export async function buildHomeOverview(config: Config, approvals: ApprovalStore): Promise<string> {
  const sessions = await buildSessionOverview(
    config.claudeProjectsDir,
    config.codexSessionsDir,
    config.codexSessionIndex,
  );
  const rankedSessions = rankSessionsForContinuation(sessions, config);
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

  lines.push("", "Best continuation candidates:");

  if (sessions.length === 0) {
    lines.push("- none detected");
  } else {
    for (const [index, ranked] of rankedSessions.slice(0, 5).entries()) {
      lines.push(`- ${sessionLine(ranked.session)} · ${humanIntentLabel(ranked.intent, ranked.session)}`);
      lines.push(`  ${suggestedNextAction(ranked, config, index + 1)}`);
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
    "Recent picks:",
    ...rankedSessions.slice(0, 5).map((ranked, index) => compactSessionLine(index + 1, ranked, config)),
    "",
    "Fast path:",
    "- recent",
    "- focus <repo>",
    "- continue <1-5>",
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
      const signal = deriveRepoSignal(session, config);
      const ranked = {
        session,
        signal,
        intent: inferIntentLabel(session, signal),
        score: scoreSession(session, signal),
      };
      lines.push(`- ${sessionLine(session)} · ${humanIntentLabel(ranked.intent, session)}`);
      lines.push(`  ${suggestedNextAction(ranked, config)}`);
      if (session.activeInTmux) {
        lines.push(`  attach: tmux attach -t ${session.id}`);
      }
    }
  }

  lines.push("", "SSH path:", sshGuide, "", "Resume path:", resumeGuide);
  return lines.join("\n");
}

export async function buildRecentContinuations(config: Config, limit = 5): Promise<string> {
  const sessions = await buildSessionOverview(
    config.claudeProjectsDir,
    config.codexSessionsDir,
    config.codexSessionIndex,
  );
  const rankedSessions = rankSessionsForContinuation(sessions, config);

  const lines = ["Recent continuations", ""];
  const selected = rankedSessions.slice(0, limit);
  if (selected.length === 0) {
    lines.push("No recent sessions found.");
    return lines.join("\n");
  }

  selected.forEach((ranked, index) => lines.push(compactSessionLine(index + 1, ranked, config)));
  lines.push("", "Use `continue <1-5>` or `resume <repo>`.");
  return lines.join("\n");
}

type SlackBlock =
  | { type: "section"; text: { type: "mrkdwn"; text: string } }
  | { type: "divider" }
  | { type: "context"; elements: Array<{ type: "mrkdwn"; text: string }> };

export async function buildHomeSlackBlocks(
  config: Config,
  approvals: ApprovalStore,
): Promise<SlackBlock[]> {
  const sessions = await buildSessionOverview(
    config.claudeProjectsDir,
    config.codexSessionsDir,
    config.codexSessionIndex,
  );
  const rankedSessions = rankSessionsForContinuation(sessions, config);
  const pendingCount = approvals.list("pending", 20).length;
  const top5 = rankedSessions.slice(0, 5);

  const headerParts = [`*ProBot · ${config.hostname}*`];
  if (pendingCount > 0) headerParts.push(`:warning: ${pendingCount} pending approval${pendingCount > 1 ? "s" : ""}`);

  const blocks: SlackBlock[] = [
    { type: "section", text: { type: "mrkdwn", text: headerParts.join("  ·  ") } },
  ];

  if (top5.length === 0) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: "_No recent sessions._" } });
  } else {
    blocks.push({ type: "divider" });
    for (const [i, ranked] of top5.entries()) {
      const s = ranked.session;
      const toolLabel = s.tool === "claude" ? "Claude" : s.tool === "codex" ? "Codex" : "Gemini";
      const hl = summarizeLine(s.headline, 72);
      const cmd = suggestedCommand(ranked, config, i + 1);
      const line = `*${i + 1}. ${toolLabel}* · \`${s.projectLabel}\` · _${humanIntentLabel(ranked.intent, s)}_ · ${s.age}\n${hl}\n→ \`${cmd}\``;
      blocks.push({ type: "section", text: { type: "mrkdwn", text: line } });
    }
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "context",
    elements: [{ type: "mrkdwn", text: "`continue <1-5>` · `focus <repo>` · `recent` · `repos` · `help`" }],
  });

  return blocks;
}

export async function buildRecentContinuationCards(config: Config, limit = 5): Promise<ContinuationCard[]> {
  const sessions = await buildSessionOverview(
    config.claudeProjectsDir,
    config.codexSessionsDir,
    config.codexSessionIndex,
  );
  return rankSessionsForContinuation(sessions, config)
    .slice(0, limit)
    .map((ranked, index) => ({
      selection: index + 1,
      tool: ranked.session.tool,
      projectLabel: ranked.session.projectLabel,
      cwd: ranked.session.cwd,
      age: ranked.session.age,
      headline: ranked.session.headline,
      activeInTmux: ranked.session.activeInTmux,
      intentLabel: humanIntentLabel(ranked.intent, ranked.session),
      suggestedActionLabel: suggestedNextAction(ranked, config, index + 1),
      suggestedCommand: suggestedCommand(ranked, config, index + 1),
    }));
}

export async function resolveRecentSessionSelection(
  config: Config,
  selection: number,
): Promise<SessionSummary | null> {
  if (!Number.isInteger(selection) || selection < 1) return null;
  const sessions = await buildSessionOverview(
    config.claudeProjectsDir,
    config.codexSessionsDir,
    config.codexSessionIndex,
  );
  return rankSessionsForContinuation(sessions, config)[selection - 1]?.session ?? null;
}

export async function buildSelectedRecentContinuation(config: Config, selection: number): Promise<string> {
  const session = await resolveRecentSessionSelection(config, selection);
  if (!session) {
    return `No recent session found for selection ${selection}. Run \`recent\` or \`home\` first.`;
  }
  return buildSessionResumeGuide(session);
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
