import fs from "node:fs";
import { Bot, InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import type { AppContext } from "../types/app.js";
import { HELP_TEXT } from "./commands.js";
import { truncate } from "./format.js";
import { getStatusSummary } from "../services/status.js";
import { buildSessionOverview, buildTimeSummary, formatSessionOverview } from "../services/sessions.js";
import { formatPendingApprovals, handleApprovalDecision } from "../services/approvals.js";
import {
  buildHomeOverview,
  buildRecentContinuations,
  buildRepoFocus,
  buildSelectedRecentContinuation,
  filterSessionsByRepoName,
} from "../services/control-plane.js";
import { appendNote } from "../services/notes.js";
import { answerBrainQuery } from "../services/brain.js";
import { assertSafeFilePath, formatFileHit, searchFiles } from "../services/files.js";
import { routeNaturalLanguage } from "../services/intents.js";
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
  describeRunPresets,
  isValidRunPreset,
  readReportTarget,
  readTailTarget,
} from "../services/operations.js";

function isAuthorized(ctx: Context, app: AppContext): boolean {
  const userId = ctx.from?.id;
  return typeof userId === "number" && app.config.telegramAllowedUserIds.includes(userId);
}

function parseArgument(text: string | undefined): string {
  if (!text) return "";
  const parts = text.trim().split(/\s+/);
  return parts.slice(1).join(" ").trim();
}

function buildApprovalKeyboard(approvalId: string): InlineKeyboard {
  return new InlineKeyboard()
    .text("Approve", `approve:${approvalId}`)
    .text("Reject", `reject:${approvalId}`);
}

export function createTelegramBot(app: AppContext): Bot {
  const bot = new Bot(app.config.telegramBotToken);

  bot.catch(async (error) => {
    console.error("Telegram handler error", error.error);
    try {
      await error.ctx.reply("That command failed. Try again, or use /help.");
    } catch (replyError) {
      console.error("Failed to send error reply", replyError);
    }
  });

  bot.use(async (ctx, next) => {
    if (!isAuthorized(ctx, app)) {
      return;
    }

    app.approvals.log("telegram_update", {
      updateId: ctx.update.update_id,
      messageText: ctx.msg?.text ?? null,
      callbackData: ctx.callbackQuery?.data ?? null,
      fromId: ctx.from?.id ?? null,
    });

    await next();
  });

  bot.command("start", async (ctx) => ctx.reply(HELP_TEXT));
  bot.command("help", async (ctx) => ctx.reply(HELP_TEXT));

  bot.command("home", async (ctx) => {
    await ctx.reply(truncate(await buildHomeOverview(app.config, app.approvals)));
  });

  bot.command("recent", async (ctx) => {
    await ctx.reply(truncate(await buildRecentContinuations(app.config, 5)));
  });

  bot.command("focus", async (ctx) => {
    const arg = parseArgument(ctx.msg?.text);
    if (!arg) {
      await ctx.reply("Usage: /focus <repo>\nUse /repos to list known repos.");
      return;
    }
    await ctx.reply(truncate(await buildRepoFocus(app.config, arg)));
  });

  bot.command("status", async (ctx) => {
    await ctx.reply(await getStatusSummary(app.config));
  });

  bot.command("sessions", async (ctx) => {
    const sessions = await buildSessionOverview(
      app.config.claudeProjectsDir,
      app.config.codexSessionsDir,
      app.config.codexSessionIndex,
    );
    const arg = parseArgument(ctx.msg?.text);
    if (!arg) {
      await ctx.reply(truncate(formatSessionOverview(sessions, 8)));
      return;
    }
    const filtered = filterSessionsByRepoName(sessions, app.config, arg);
    if (filtered === null) {
      await ctx.reply(`Unknown repo: ${arg}\nUse /repos to list known repos.`);
      return;
    }
    await ctx.reply(truncate(filtered.length === 0 ? `No sessions found for ${arg}.` : formatSessionOverview(filtered, 8)));
  });

  bot.command("summary", async (ctx) => {
    const arg = parseArgument(ctx.msg?.text);
    const period = arg === "week" ? "week" : "today";
    const summary = await buildTimeSummary(
      period,
      app.config.claudeProjectsDir,
      app.config.codexSessionsDir,
      app.config.codexSessionIndex,
    );

    await ctx.reply(truncate(summary));
  });

  bot.command("jobs", async (ctx) => {
    await ctx.reply(truncate(formatPendingApprovals(app, 6)));
  });

  bot.command("approve", async (ctx) => {
    const approvalId = parseArgument(ctx.msg?.text);
    if (!approvalId) {
      await ctx.reply("Usage: /approve <approval-id>");
      return;
    }
    const result = await handleApprovalDecision(app, approvalId, "approve", "telegram");
    if (result.filePath) {
      await ctx.replyWithDocument(result.filePath);
    }
    await ctx.reply(truncate(result.messageText));
  });

  bot.command("reject", async (ctx) => {
    const approvalId = parseArgument(ctx.msg?.text);
    if (!approvalId) {
      await ctx.reply("Usage: /reject <approval-id>");
      return;
    }
    const result = await handleApprovalDecision(app, approvalId, "reject", "telegram");
    await ctx.reply(truncate(result.messageText));
  });

  bot.command("note", async (ctx) => {
    const text = parseArgument(ctx.msg?.text);
    if (!text) {
      await ctx.reply("Usage: /note <text>");
      return;
    }

    const notePath = appendNote(app.config.notesDir, text);
    await ctx.reply(`Saved note to:\n${notePath}`);
  });

  bot.command("brain", async (ctx) => {
    const query = parseArgument(ctx.msg?.text);
    if (!query) {
      await ctx.reply("Usage: /brain <query>");
      return;
    }

    await ctx.reply(truncate(await answerBrainQuery(app.config.brainRoot, query)));
  });

  bot.command("find", async (ctx) => {
    const query = parseArgument(ctx.msg?.text);
    if (!query) {
      await ctx.reply("Usage: /find <query>");
      return;
    }

    const hits = await searchFiles(app.config.allowedRoots, query);
    if (hits.length === 0) {
      await ctx.reply("No matching files found.");
      return;
    }

    await ctx.reply(truncate(hits.map(formatFileHit).join("\n\n")));
  });

  bot.command("send", async (ctx) => {
    const rawPath = parseArgument(ctx.msg?.text);
    if (!rawPath) {
      await ctx.reply("Usage: /send <absolute-path>");
      return;
    }

    try {
      const safePath = assertSafeFilePath(rawPath, app.config.allowedRoots);
      const stat = fs.statSync(safePath);

      if (!stat.isFile()) {
        await ctx.reply("That path is not a regular file.");
        return;
      }

      if (stat.size > app.config.maxFileBytes) {
        await ctx.reply("That file is larger than the configured send limit.");
        return;
      }

      const approvalId = app.approvals.create(
        "send_file",
        { path: safePath },
        new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      );

      const preview = [
        "Approve sending this file to Telegram?",
        safePath,
        `${(stat.size / 1024).toFixed(1)} KB`,
      ].join("\n");

      await ctx.reply(preview, {
        reply_markup: buildApprovalKeyboard(approvalId),
      });
    } catch (error) {
      await ctx.reply(error instanceof Error ? error.message : "Failed to prepare file send.");
    }
  });

  bot.command("dashboard", async (ctx) => {
    if (app.config.dashboardPort === 0) {
      await ctx.reply("Dashboard is not enabled.\nSet PROBOT_DASHBOARD_PORT in your .env to activate it.");
      return;
    }
    const url = app.config.dashboardUrl || `http://${app.config.hostname}:${app.config.dashboardPort}`;
    await ctx.reply(`Dashboard: ${url}`);
  });

  bot.command("tail", async (ctx) => {
    const target = parseArgument(ctx.msg?.text) || "probot";
    await ctx.reply(truncate(readTailTarget(app.config, target)));
  });

  bot.command("report", async (ctx) => {
    const target = parseArgument(ctx.msg?.text) || "scheduler";
    await ctx.reply(truncate(readReportTarget(target)));
  });

  bot.command("run", async (ctx) => {
    const preset = parseArgument(ctx.msg?.text);
    if (!preset) {
      await ctx.reply(`Available presets:\n${describeRunPresets()}`);
      return;
    }
    if (!isValidRunPreset(preset)) {
      await ctx.reply(`Unknown preset: ${preset}\n\nAvailable presets:\n${describeRunPresets()}`);
      return;
    }

    const approvalId = app.approvals.create(
      "run_preset",
      { preset },
      new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    );

    await ctx.reply(
      `Approval required for ${preset}.\nApproval ID: ${approvalId}\nUse /approve ${approvalId} or /reject ${approvalId}.`,
    );
  });

  bot.command("repos", async (ctx) => {
    const repos = listRepoHandoffs(app.config.repoAliases);
    if (repos.length === 0) {
      await ctx.reply("No repo aliases configured.\nSet PROBOT_REPO_ALIASES in your .env:\n  name:/absolute/path,name2:/path2");
      return;
    }
    const lines = repos.map((r) => {
      const status = r.exists ? "handoff: yes" : "handoff: no";
      const goal = r.goal ? r.goal.slice(0, 60) : "no goal set";
      const updated = r.updatedAt ?? "never";
      return `${r.name} · ${goal} · ${updated} · [${status}]`;
    });
    await ctx.reply(truncate(lines.join("\n")));
  });

  bot.command("handoff", async (ctx) => {
    const arg = parseArgument(ctx.msg?.text);
    if (!arg) {
      const repos = listRepoHandoffs(app.config.repoAliases);
      if (repos.length === 0) {
        await ctx.reply("No repo aliases configured.\nSet PROBOT_REPO_ALIASES in your .env.");
        return;
      }
      const lines = repos.map((r) => {
        const status = r.exists ? "handoff: yes" : "handoff: no";
        const goal = r.goal ? r.goal.slice(0, 60) : "no goal set";
        const updated = r.updatedAt ?? "never";
        return `${r.name} · ${goal} · ${updated} · [${status}]`;
      });
      await ctx.reply(truncate(lines.join("\n")));
      return;
    }

    const repoPath = resolveRepoPath(arg, app.config.repoAliases);
    if (!repoPath) {
      await ctx.reply(`Unknown repo: ${arg}\nUse /repos to list known repos.`);
      return;
    }

    const { content } = readCurrentHandoff(repoPath);
    await ctx.reply(truncate(formatHandoffSummary(arg, content)));
  });

  bot.command("resume", async (ctx) => {
    const arg = parseArgument(ctx.msg?.text);
    if (!arg) {
      await ctx.reply("Usage: /resume <repo>\nUse /repos to list known repos.");
      return;
    }
    if (/^\d+$/.test(arg)) {
      await ctx.reply(truncate(await buildSelectedRecentContinuation(app.config, Number(arg))));
      return;
    }

    const repoPath = resolveRepoPath(arg, app.config.repoAliases);
    if (!repoPath) {
      await ctx.reply(`Unknown repo: ${arg}\nUse /repos to list known repos.`);
      return;
    }

    const prompt = buildResumePrompt(repoPath);
    const guide = await buildResumeGuide(app.config, arg);
    const message = `Resume prompt for ${arg}:\n\n${prompt}\n\n---\n${guide}`;
    await ctx.reply(truncate(message));
  });

  bot.command("continue", async (ctx) => {
    const arg = parseArgument(ctx.msg?.text);
    if (!arg) {
      await ctx.reply("Usage: /continue <repo|1-5>\nUse /recent or /repos to choose.");
      return;
    }
    if (/^\d+$/.test(arg)) {
      await ctx.reply(truncate(await buildSelectedRecentContinuation(app.config, Number(arg))));
      return;
    }

    const repoPath = resolveRepoPath(arg, app.config.repoAliases);
    if (!repoPath) {
      await ctx.reply(`Unknown repo: ${arg}\nUse /repos to list known repos.`);
      return;
    }

    const prompt = buildResumePrompt(repoPath);
    const guide = await buildResumeGuide(app.config, arg);
    const message = `Resume prompt for ${arg}:\n\n${prompt}\n\n---\n${guide}`;
    await ctx.reply(truncate(message));
  });

  bot.command("ssh", async (ctx) => {
    const arg = parseArgument(ctx.msg?.text);
    await ctx.reply(truncate(buildSshGuide(app.config, arg || undefined)));
  });

  bot.callbackQuery(/^(approve|reject):/, async (ctx) => {
    const [decision, approvalId] = (ctx.callbackQuery.data ?? "").split(":");
    if (!approvalId) {
      await ctx.answerCallbackQuery({ text: "Malformed approval token." });
      return;
    }

    const record = app.approvals.get(approvalId);

    if (!record) {
      await ctx.answerCallbackQuery({ text: "Approval not found." });
      return;
    }

    if (record.status !== "pending") {
      await ctx.answerCallbackQuery({ text: "Approval already handled." });
      return;
    }

    if (new Date(record.expiresAt).getTime() < Date.now()) {
      app.approvals.updateStatus(approvalId, "expired");
      await ctx.answerCallbackQuery({ text: "Approval expired." });
      return;
    }

    const result = await handleApprovalDecision(
      app,
      approvalId,
      decision === "approve" ? "approve" : "reject",
      "telegram",
    );
    if (result.filePath) {
      await ctx.replyWithDocument(result.filePath);
    }
    await ctx.editMessageText(result.messageText);
    await ctx.answerCallbackQuery({ text: result.statusText });
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.msg.text.trim();
    if (text.startsWith("/")) return;

    await ctx.reply(truncate(await routeNaturalLanguage(app, text)));
  });

  return bot;
}
