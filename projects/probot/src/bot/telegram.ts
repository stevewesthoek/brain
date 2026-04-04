import fs from "node:fs";
import { Bot, InlineKeyboard } from "grammy";
import type { Context } from "grammy";
import type { AppContext } from "../types/app.js";
import { HELP_TEXT } from "./commands.js";
import { truncate } from "./format.js";
import { getStatusSummary } from "../services/status.js";
import { buildSessionOverview, buildTimeSummary, formatSessionOverview } from "../services/sessions.js";
import { appendNote } from "../services/notes.js";
import { answerBrainQuery } from "../services/brain.js";
import { assertSafeFilePath, formatFileHit, searchFiles } from "../services/files.js";
import { routeNaturalLanguage } from "../services/intents.js";

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

  bot.command("status", async (ctx) => {
    await ctx.reply(await getStatusSummary(app.config));
  });

  bot.command("sessions", async (ctx) => {
    const sessions = await buildSessionOverview(
      app.config.claudeProjectsDir,
      app.config.codexSessionsDir,
      app.config.codexSessionIndex,
    );

    await ctx.reply(truncate(formatSessionOverview(sessions, 8)));
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

    if (decision === "reject") {
      app.approvals.updateStatus(approvalId, "rejected");
      await ctx.editMessageText("Request rejected.");
      await ctx.answerCallbackQuery({ text: "Rejected." });
      return;
    }

    if (record.kind === "send_file") {
      const payload = JSON.parse(record.payloadJson) as { path: string };
      await ctx.replyWithDocument(payload.path);
      app.approvals.updateStatus(approvalId, "approved");
      await ctx.editMessageText(`Sent file:\n${payload.path}`);
      await ctx.answerCallbackQuery({ text: "Approved." });
      return;
    }

    await ctx.answerCallbackQuery({ text: "Unknown approval action." });
  });

  bot.on("message:text", async (ctx) => {
    const text = ctx.msg.text.trim();
    if (text.startsWith("/")) return;

    await ctx.reply(truncate(await routeNaturalLanguage(app, text)));
  });

  return bot;
}
