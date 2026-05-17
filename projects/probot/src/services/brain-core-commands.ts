import {
  readBrainCoreApprovals,
  readBrainCoreCapabilities,
  readBrainCoreExecutionPlans,
  readBrainCoreExecutionReadiness,
  readBrainCoreMindPreviewPolicy,
  readBrainCoreRuntimeReports,
  readBrainCoreSchedulerJobs,
  readBrainCoreSessions,
  readBrainCoreStatus,
} from "./brain-core-client.js";

export interface ParsedBrainCoreCommand {
  handled: boolean;
  command: string;
  subcommand: string;
}

export function parseBrainCoreCommand(text: string): ParsedBrainCoreCommand {
  const normalized = text.trim();
  const lower = normalized.toLowerCase();

  if (!/^brain(\s|$)/.test(lower)) {
    return { handled: false, command: "", subcommand: "" };
  }

  const rest = normalized.slice(5).trim();
  return {
    handled: true,
    command: "brain",
    subcommand: rest.toLowerCase(),
  };
}

export async function handleBrainCoreCommand(text: string, brainCoreUrl: string): Promise<string | null> {
  const parsed = parseBrainCoreCommand(text);
  if (!parsed.handled) {
    return null;
  }

  const subcommand = parsed.subcommand || "status";

  if (subcommand === "help") {
    return [
      "Brain Core aliases:",
      "brain",
      "brain status",
      "brain reports",
      "brain sessions",
      "brain approvals",
      "brain scheduler",
      "brain help",
    ].join("\n");
  }

  if (subcommand !== "status" && subcommand !== "reports" && subcommand !== "sessions" && subcommand !== "approvals" && subcommand !== "scheduler") {
    return [
      "Brain Core aliases:",
      "brain",
      "brain status",
      "brain reports",
      "brain sessions",
      "brain approvals",
      "brain scheduler",
      "brain help",
    ].join("\n");
  }

  const [status, capabilities, reports, sessions, schedulerJobs, approvals] = await Promise.all([
    readBrainCoreStatus(brainCoreUrl),
    readBrainCoreCapabilities(brainCoreUrl),
    readBrainCoreRuntimeReports(brainCoreUrl),
    readBrainCoreSessions(brainCoreUrl),
    readBrainCoreSchedulerJobs(brainCoreUrl),
    readBrainCoreApprovals(brainCoreUrl),
  ]);
  const executionPlans = await readBrainCoreExecutionPlans(brainCoreUrl);
  const executionReadiness = await readBrainCoreExecutionReadiness(brainCoreUrl);
  const mindPreviewPolicy = await readBrainCoreMindPreviewPolicy(brainCoreUrl);

  if (subcommand === "status") {
    return [status.line, capabilities.line].join("\n");
  }

  if (subcommand === "reports") {
    return reports.line;
  }

  if (subcommand === "sessions") {
    return [
      sessions.line,
      sessions.available ? "Top sessions: unavailable from the current read-only summary." : "Brain Core sessions unavailable.",
    ].join("\n");
  }

  if (subcommand === "approvals") {
    return [
      approvals.line,
      executionReadiness.line,
      mindPreviewPolicy.line,
      `Execution gate: ${executionReadiness.executionEnabled ? "enabled" : "disabled"} · first candidate: ${executionPlans.firstCandidate}`,
      `Model-router execution flag: ${executionReadiness.modelRouterDryRunExecutionFlagEnabled ? "enabled (still gated)" : "disabled"} · ${executionReadiness.modelRouterDryRunExecutionFlagName}`,
      `Mind preview policy: ${mindPreviewPolicy.status} · apply route: ${mindPreviewPolicy.applyRouteEnabled ? "enabled" : "disabled"}`,
      `Executable actions: ${capabilities.executableActionsEnabled ? "enabled" : "disabled"}`,
    ].join("\n");
  }

  return [
    schedulerJobs.line,
    reports.line,
    executionReadiness.line,
    mindPreviewPolicy.line,
    `Model-router execution flag: ${executionReadiness.modelRouterDryRunExecutionFlagEnabled ? "enabled (still gated)" : "disabled"} · ${executionReadiness.modelRouterDryRunExecutionFlagName}`,
    `Mind preview policy: ${mindPreviewPolicy.status} · apply route: ${mindPreviewPolicy.applyRouteEnabled ? "enabled" : "disabled"}`,
    `Executable actions: ${capabilities.executableActionsEnabled ? "enabled" : "disabled"}`,
  ].join("\n");
}
