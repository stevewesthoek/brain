import { App, LogLevel } from "@slack/bolt";
import type { AppContext } from "../types/app.js";
import { getStatusSummary } from "../services/status.js";
import { buildSessionOverview, formatSessionOverview } from "../services/sessions.js";
import {
  buildResumePrompt,
  formatHandoffSummary,
  listRepoHandoffs,
  readCurrentHandoff,
  resolveRepoPath,
} from "../services/handoff.js";

const HELP_TEXT = `ProBot commands:
• \`status\` — machine and session overview
• \`repos\` — list repos and handoff status
• \`handoff <repo>\` — read current handoff
• \`resume <repo>\` — get resume prompt
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
        case "status": {
          const result = await getStatusSummary(app.config);
          await say({ blocks: [slackBlock(`\`\`\`${result}\`\`\``)] });
          break;
        }

        case "sessions": {
          const sessions = await buildSessionOverview(
            app.config.claudeProjectsDir,
            app.config.codexSessionsDir,
            app.config.codexSessionIndex,
          );
          await say({ blocks: [slackBlock(`\`\`\`${formatSessionOverview(sessions, 8)}\`\`\``)] });
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

        case "resume": {
          if (!arg) {
            await say("Usage: `resume <repo>`. Use `repos` to list known repos.");
            break;
          }
          const repoPath = resolveRepoPath(arg, app.config.repoAliases);
          if (!repoPath) {
            await say(`Unknown repo: \`${arg}\`. Use \`repos\` to list known repos.`);
            break;
          }
          const prompt = buildResumePrompt(repoPath);
          await say({
            blocks: [
              slackBlock(`*Resume prompt for \`${arg}\`:*\n\`\`\`${prompt}\`\`\``),
              slackBlock("_Paste this into your Claude session to resume._"),
            ],
          });
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
