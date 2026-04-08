import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { Config } from "../config.js";
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
    `Telegram: local polling active, ${config.telegramAllowedUserIds.length} allowed user(s)`,
    config.slackBotToken && config.slackAppToken
      ? `Slack: Socket Mode configured, ${config.slackAllowedUserIds.length || "all"} allowed user(s)`
      : "Slack: disabled",
    `ProBot uptime: ${uptimeMinutes}m`,
    `Recent sessions: ${sessions.length} total, ${activeSessions.length} active in tmux`,
    latest ? `Latest thread: ${latest.tool} · ${latest.projectLabel} · ${latest.headline}` : "Latest thread: none detected",
    `Notes captured today: ${todayNotes}`,
    `Allowed roots: ${config.allowedRoots.length}`,
    `Machine load: ${load}`,
    `Memory free: ${freeGb} GB / ${totalGb} GB`,
  ].join("\n");
}
