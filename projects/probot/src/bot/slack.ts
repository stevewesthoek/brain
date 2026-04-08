import { App, LogLevel } from "@slack/bolt";
import type { AppContext } from "../types/app.js";
import { getStatusSummary } from "../services/status.js";
import { buildSessionOverview, formatSessionOverview } from "../services/sessions.js";
import { formatPendingApprovals, handleApprovalDecision } from "../services/approvals.js";
import {
  buildHomeOverview,
  buildRecentContinuations,
  buildRepoFocus,
  buildSelectedRecentContinuation,
  filterSessionsByRepoName,
} from "../services/control-plane.js";
import {
  buildResumePrompt,
  formatHandoffSummary,
  listRepoHandoffs,
  readCurrentHandoff,
  resolveRepoPath,
} from "../services/handoff.js";
import {
  buildResumeGuide,
  buildSshGuide,
  describeReportTargets,
  describeRunPresets,
  describeTailTargets,
  isValidRunPreset,
  readReportTarget,
  readTailTarget,
} from "../services/operations.js";
import { buildTimeSummary } from "../services/sessions.js";

const HELP_TEXT = `ProBot commands:
• \`home\` — unified remote-control overview
• \`recent\` — last 5 resumable sessions for a small screen
• \`focus <repo>\` — fast continuation context for one repo
• \`status\` — machine and session overview
• \`summary [today|week]\` — compact work digest
• \`sessions [repo]\` — recent sessions, optionally filtered by repo
• \`repos\` — list repos and handoff status
• \`handoff <repo>\` — read current handoff
• \`resume <repo>\` / \`continue <repo|1-5>\` — guided continuation by repo or recent-session number
• \`ssh [repo]\` — SSH + tmux continuation instructions
• \`tail [target]\` — recent local logs (${describeTailTargets()})
• \`report [target]\` — read a local runtime report (${describeReportTargets()})
• \`jobs\` — list pending approvals
• \`run <preset>\` — request a bounded operational action
• \`approve <id>\` / \`reject <id>\` — handle a pending approval
• \`help\` — this message`;

function parseCommand(text: string): { command: string; arg: string } {
  const parts = text.trim().split(/\s+/);
  return {
    command: (parts[0] ?? "").toLowerCase(),
    arg: parts.slice(1).join(" ").trim(),
  };
}

function slackBlock(text: string): { type: "section"; text: { type: "mrkdwn"; text: string } } {
  return { type: "section", text: { type: "mrkdwn", text: text.slice(0, 3000) } };
}

export function createSlackBot(app: AppContext): App {
  const slackApp = new App({
    token: app.config.slackBotToken!,
    appToken: app.config.slackAppToken!,
    socketMode: true,
    logLevel: app.config.debug ? LogLevel.DEBUG : LogLevel.ERROR,
  });

  const isAllowed = (userId: string): boolean => {
    if (app.config.slackAllowedUserIds.length === 0) return true; // open if not restricted
    return app.config.slackAllowedUserIds.includes(userId);
  };

  slackApp.event("message", async ({ event, say }) => {
    // Only handle DMs (channel_type: im) with actual text, from allowed users
    const msg = event as unknown as Record<string, unknown>;
    if (msg["channel_type"] !== "im") return;
    if (msg["bot_id"]) return; // ignore our own echoes
    const text = typeof msg["text"] === "string" ? msg["text"].trim() : "";
    if (!text) return;
    const userId = typeof msg["user"] === "string" ? msg["user"] : "";
    if (!isAllowed(userId)) return;

    const { command, arg } = parseCommand(text);

    try {
      switch (command) {
        case "home": {
          const result = await buildHomeOverview(app.config, app.approvals);
          await say({ blocks: [slackBlock(`\`\`\`${result}\`\`\``)] });
          break;
        }

        case "focus": {
          if (!arg) {
            await say("Usage: `focus <repo>`. Use `repos` to list known repos.");
            break;
          }
          const result = await buildRepoFocus(app.config, arg);
          await say({ blocks: [slackBlock(`\`\`\`${result}\`\`\``)] });
          break;
        }

        case "recent": {
          const result = await buildRecentContinuations(app.config, 5);
          await say({ blocks: [slackBlock(`\`\`\`${result}\`\`\``)] });
          break;
        }

        case "status": {
          const result = await getStatusSummary(app.config);
          await say({ blocks: [slackBlock(`\`\`\`${result}\`\`\``)] });
          break;
        }

        case "summary": {
          const period = arg.toLowerCase() === "week" ? "week" : "today";
          const result = await buildTimeSummary(
            period,
            app.config.claudeProjectsDir,
            app.config.codexSessionsDir,
            app.config.codexSessionIndex,
          );
          await say({ blocks: [slackBlock(`\`\`\`${result}\`\`\``)] });
          break;
        }

        case "sessions": {
          const allSessions = await buildSessionOverview(
            app.config.claudeProjectsDir,
            app.config.codexSessionsDir,
            app.config.codexSessionIndex,
          );
          if (!arg) {
            await say({ blocks: [slackBlock(`\`\`\`${formatSessionOverview(allSessions, 8)}\`\`\``)] });
            break;
          }
          const filtered = filterSessionsByRepoName(allSessions, app.config, arg);
          if (filtered === null) {
            await say(`Unknown repo: \`${arg}\`. Use \`repos\` to list known repos.`);
            break;
          }
          await say({
            blocks: [slackBlock(`\`\`\`${filtered.length === 0 ? `No sessions found for ${arg}.` : formatSessionOverview(filtered, 8)}\`\`\``)],
          });
          break;
        }

        case "repos": {
          const repos = listRepoHandoffs(app.config.repoAliases);
          if (repos.length === 0) {
            await say("No repo aliases configured. Set `PROBOT_REPO_ALIASES` in your `.env`.");
            break;
          }
          const lines = repos.map((r) => {
            const status = r.exists ? ":white_check_mark:" : ":x:";
            const goal = r.goal ? r.goal.slice(0, 60) : "no goal set";
            const updated = r.updatedAt ?? "never";
            return `${status} *${r.name}* — ${goal} — _${updated}_`;
          });
          await say({ blocks: [slackBlock(lines.join("\n"))] });
          break;
        }

        case "handoff": {
          if (!arg) {
            // No arg — same as repos
            const repos = listRepoHandoffs(app.config.repoAliases);
            if (repos.length === 0) {
              await say("No repo aliases configured.");
              break;
            }
            const lines = repos.map((r) => {
              const status = r.exists ? ":white_check_mark:" : ":x:";
              const goal = r.goal ? r.goal.slice(0, 60) : "no goal set";
              return `${status} *${r.name}* — ${goal}`;
            });
            await say({ blocks: [slackBlock(lines.join("\n"))] });
            break;
          }
          const repoPath = resolveRepoPath(arg, app.config.repoAliases);
          if (!repoPath) {
            await say(`Unknown repo: \`${arg}\`. Use \`repos\` to list known repos.`);
            break;
          }
          const { content } = readCurrentHandoff(repoPath);
          await say({ blocks: [slackBlock(formatHandoffSummary(arg, content))] });
          break;
        }

        case "resume":
        case "continue": {
          if (!arg) {
            await say(`Usage: \`${command} <repo>\`. Use \`repos\` to list known repos.`);
            break;
          }
          if (/^\d+$/.test(arg)) {
            const result = await buildSelectedRecentContinuation(app.config, Number(arg));
            await say({ blocks: [slackBlock(`\`\`\`${result}\`\`\``)] });
            break;
          }
          const repoPath = resolveRepoPath(arg, app.config.repoAliases);
          if (!repoPath) {
            await say(`Unknown repo: \`${arg}\`. Use \`repos\` to list known repos.`);
            break;
          }
          const prompt = buildResumePrompt(repoPath);
          const guide = await buildResumeGuide(app.config, arg);
          await say({
            blocks: [
              slackBlock(`*Resume prompt for \`${arg}\`:*\n\`\`\`${prompt}\`\`\``),
              slackBlock(`\`\`\`${guide}\`\`\``),
            ],
          });
          break;
        }

        case "ssh": {
          const result = buildSshGuide(app.config, arg || undefined);
          await say({ blocks: [slackBlock(`\`\`\`${result}\`\`\``)] });
          break;
        }

        case "tail": {
          const result = readTailTarget(app.config, arg || "probot");
          await say({ blocks: [slackBlock(`\`\`\`${result}\`\`\``)] });
          break;
        }

        case "report": {
          const result = readReportTarget(arg || "scheduler");
          await say({ blocks: [slackBlock(`\`\`\`${result}\`\`\``)] });
          break;
        }

        case "jobs": {
          const result = formatPendingApprovals(app, 6);
          await say({ blocks: [slackBlock(`\`\`\`${result}\`\`\``)] });
          break;
        }

        case "run": {
          if (!arg) {
            await say({ blocks: [slackBlock(`Available presets:\n${describeRunPresets()}`)] });
            break;
          }
          if (!isValidRunPreset(arg)) {
            await say({ blocks: [slackBlock(`Unknown preset: ${arg}\n\nAvailable presets:\n${describeRunPresets()}`)] });
            break;
          }
          const approvalId = app.approvals.create(
            "run_preset",
            { preset: arg },
            new Date(Date.now() + 10 * 60 * 1000).toISOString(),
          );
          await say(
            `Approval required for \`${arg}\`.\nApproval ID: \`${approvalId}\`\nReply with \`approve ${approvalId}\` or \`reject ${approvalId}\`.`,
          );
          break;
        }

        case "approve":
        case "reject": {
          if (!arg) {
            await say(`Usage: \`${command} <approval-id>\`.`);
            break;
          }
          const result = await handleApprovalDecision(
            app,
            arg,
            command === "approve" ? "approve" : "reject",
            "slack",
          );
          await say(result.messageText);
          break;
        }

        case "dashboard": {
          if (app.config.dashboardPort === 0) {
            await say("Dashboard is not enabled. Set `PROBOT_DASHBOARD_PORT` in your `.env`.");
            break;
          }
          const url = app.config.dashboardUrl || `http://${app.config.hostname}:${app.config.dashboardPort}`;
          await say(`Dashboard: ${url}`);
          break;
        }

        case "help":
        default: {
          await say({ blocks: [slackBlock(HELP_TEXT)] });
          break;
        }
      }
    } catch (error) {
      console.error("[slack] handler error", error);
      await say("Something went wrong. Check the ProBot logs.");
    }
  });

  return slackApp;
}
