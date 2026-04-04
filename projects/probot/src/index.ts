import fs from "node:fs";
import process from "node:process";
import { config } from "./config.js";
import { createTelegramBot } from "./bot/telegram.js";
import { createApprovalStore, openDatabase } from "./store/db.js";
import type { AppContext } from "./types/app.js";

async function main(): Promise<void> {
  fs.mkdirSync(config.dataDir, { recursive: true });
  fs.mkdirSync(config.notesDir, { recursive: true });

  const db = openDatabase(config.dataDir);
  const approvals = createApprovalStore(db);

  const app: AppContext = {
    config,
    db,
    approvals,
  };

  const bot = createTelegramBot(app);

  const stop = async (): Promise<void> => {
    await bot.stop();
    db.close();
  };

  process.once("SIGINT", () => void stop().finally(() => process.exit(0)));
  process.once("SIGTERM", () => void stop().finally(() => process.exit(0)));

  console.log(`ProBot starting on ${config.hostname}`);
  await bot.start({
    onStart: () => {
      console.log("Telegram polling started.");
    },
  });
}

main().catch((error) => {
  console.error("ProBot failed to start.", error);
  process.exit(1);
});
