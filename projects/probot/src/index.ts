import fs from "node:fs";
import process from "node:process";
import { config } from "./config.js";
import { createTelegramBot } from "./bot/telegram.js";
import { createApprovalStore, openDatabase } from "./store/db.js";
import { startInactivityMonitor } from "./services/inactivity.js";
import { createSlackBot } from "./bot/slack.js";
import { createDashboardServer } from "./bot/dashboard.js";
import { startCodexUsageMonitor } from "./services/codex-usage.js";
import type { AppContext } from "./types/app.js";

async function main(): Promise<void> {
  // Set process title to "ProBot" so it appears clearly in macOS system dialogs,
  // Activity Monitor, and Accessibility permissions (instead of generic "node")
  process.title = "ProBot";

  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.notesDir, { recursive: true });

  const db = openDatabase(config.dataDir);
  const approvals = createApprovalStore(db);

  const app: AppContext = {
    config,
    db,
    approvals,
  };

  startCodexUsageMonitor({
    codexSessionsDir: config.codexSessionsDir,
    dataDir: config.dataDir,
  });

  const bot = createTelegramBot(app);

  const stop = async (): Promise<void> => {
    await bot.stop();
    db.close();
  };

  process.once("SIGINT", () => void stop().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void stop().finally(() => process.exit(0)));

  if (config.dashboardPort > 0) {
    const dashboard = createDashboardServer(app);
    dashboard.listen(config.dashboardPort, "0.0.0.0", () => {
      const url = config.dashboardUrl || `http://${config.hostname}:${config.dashboardPort}`;
      console.log(`Dashboard running at ${url}`);
    });
  }

  if (config.slackBotToken && config.slackAppToken) {
    const slackBot = createSlackBot(app);
    await slackBot.start();
    console.log("Slack Socket Mode started.");
  }

  console.log(`ProBot starting on ${config.hostname}`);
  await bot.start({
    onStart: () => {
      console.log("Telegram polling started.");
      startInactivityMonitor(config, async (message) => {
        for (const userId of config.telegramAllowedUserIds) {
          await bot.api.sendMessage(userId, message);
        }
      });
    },
  });
}

main().catch((error) => {
  console.error("ProBot failed to start.", error);
  process.exit(1);
});
