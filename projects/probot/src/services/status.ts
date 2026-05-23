import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Config } from "../config.js";
import {
  readBrainCoreLocalApps,
  readBrainCoreApprovals,
  readBrainCoreApprovalStore,
  readBrainCoreExecutionPlans,
  readBrainCoreExecutionReadiness,
  readBrainCoreCapabilities,
  readBrainCoreRuntimeReports,
  readBrainCoreSchedulerJobs,
  readBrainCoreSessions,
  readBrainCoreVideo,
  readBrainCoreStatus,
  readBrainCoreMindPreviewPolicy,
  readBrainCoreMindPreviews,
  readBrainCoreMaintenancePreviews,
} from "./brain-core-client.js";
import { buildSessionOverview } from "./sessions.js";

function countTodayNotes(notesDir: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const year = today.slice(0, 4);
  const filePath = path.join(notesDir, year, `${today}.md`);
  if (!fs.existsSync(filePath)) return 0;
  return fs
    .readFileSync(filePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- ")).length;
}

export async function getStatusSummary(config: Config): Promise<string> {
  const uptimeMinutes = Math.floor(process.uptime() / 60);
  const load = os.loadavg().map((value) => value.toFixed(2)).join(", ");
  const freeGb = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);
  const totalGb = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const brainCoreStatus = await readBrainCoreStatus(config.brainCoreUrl);
  const brainCoreCapabilities = await readBrainCoreCapabilities(config.brainCoreUrl);
  const brainCoreRuntimeReports = await readBrainCoreRuntimeReports(config.brainCoreUrl);
  const brainCoreVideo = await readBrainCoreVideo(config.brainCoreUrl);
  const brainCoreLocalApps = await readBrainCoreLocalApps(config.brainCoreUrl);
  const brainCoreSessions = await readBrainCoreSessions(config.brainCoreUrl);
  const brainCoreSchedulerJobs = await readBrainCoreSchedulerJobs(config.brainCoreUrl);
  const brainCoreApprovals = await readBrainCoreApprovals(config.brainCoreUrl);
  const brainCoreApprovalStore = await readBrainCoreApprovalStore(config.brainCoreUrl);
  const brainCoreExecutionPlans = await readBrainCoreExecutionPlans(config.brainCoreUrl);
  const brainCoreExecutionReadiness = await readBrainCoreExecutionReadiness(config.brainCoreUrl);
  const brainCoreMindPreviewPolicy = await readBrainCoreMindPreviewPolicy(config.brainCoreUrl);
  const brainCoreMindPreviews = await readBrainCoreMindPreviews(config.brainCoreUrl);
  const brainCoreMaintenancePreviews = await readBrainCoreMaintenancePreviews(config.brainCoreUrl);
  const sessions = await buildSessionOverview(
    config.claudeProjectsDir,
    config.codexSessionsDir,
    config.codexSessionIndex,
  );
  const activeSessions = sessions.filter((session) => session.activeInTmux);
  const latest = sessions[0];
  const todayNotes = countTodayNotes(config.notesDir);

  return [
    `ProBot is live on ${config.hostname}.`,
    brainCoreStatus.line,
    brainCoreCapabilities.line,
    brainCoreRuntimeReports.line,
    brainCoreVideo.line,
    brainCoreLocalApps.line,
    `Telegram: local polling active, ${config.telegramAllowedUserIds.length} allowed user(s)`,
    config.slackBotToken && config.slackAppToken
      ? `Slack: Socket Mode configured, ${config.slackAllowedUserIds.length || "all"} allowed user(s)`
      : "Slack: disabled",
    `ProBot uptime: ${uptimeMinutes}m`,
    `Recent sessions: ${sessions.length} total, ${activeSessions.length} active in tmux`,
    brainCoreSessions.line,
    brainCoreSchedulerJobs.line,
    brainCoreApprovals.line,
    brainCoreApprovalStore.line,
    brainCoreExecutionPlans.line,
    brainCoreExecutionReadiness.line,
    brainCoreMindPreviewPolicy.line,
    brainCoreMindPreviews.line,
    brainCoreMaintenancePreviews.line,
    `Wiki health: ${describeWikiHealth(brainCoreRuntimeReports)}`,
    `Execution gate: ${brainCoreExecutionReadiness.executionEnabled ? 'enabled' : 'disabled'} · first candidate: ${brainCoreExecutionPlans.firstCandidate}`,
    `Mind Steward execution flag: ${brainCoreExecutionReadiness.mindStewardDryRunExecutionFlagEnabled ? 'enabled (still gated)' : 'disabled'} · ${brainCoreExecutionReadiness.mindStewardDryRunExecutionFlagName}`,
    `Mind preview policy: ${brainCoreMindPreviewPolicy.status} · apply route: ${brainCoreMindPreviewPolicy.applyRouteEnabled ? 'enabled' : 'disabled'}`,
    `Mind previews: ${brainCoreMindPreviews.count} · latest=${brainCoreMindPreviews.latest?.targetPath ?? 'none'}`,
    latest ? `Latest thread: ${latest.tool} · ${latest.projectLabel} · ${latest.headline}` : "Latest thread: none detected",
    `Notes captured today: ${todayNotes}`,
    `Allowed roots: ${config.allowedRoots.length}`,
    `Machine load: ${load}`,
    `Memory free: ${freeGb} GB / ${totalGb} GB`,
  ].join("\n");
}

function describeWikiHealth(reports: Awaited<ReturnType<typeof readBrainCoreRuntimeReports>>): string {
  const mindSteward = reports.reports.find((report) => report.id === 'mind-steward');
  if (!mindSteward?.wikiHealth) return 'unavailable';
  const { ok, errorCount, warningCount } = mindSteward.wikiHealth;
  return ok ? 'ok' : `warnings=${warningCount} errors=${errorCount}`;
}
