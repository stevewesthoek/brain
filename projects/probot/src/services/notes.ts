import fs from "node:fs";
import path from "node:path";

export function appendNote(notesRoot: string, text: string, source = "telegram"): string {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const date = now.toISOString().slice(0, 10);
  const dir = path.join(notesRoot, year);
  const filePath = path.join(dir, `${date}.md`);

  fs.mkdirSync(dir, { recursive: true });
  const entry = `- ${now.toISOString()} [${source}] ${text.trim()}\n`;
  fs.appendFileSync(filePath, entry, "utf8");

  return filePath;
}
