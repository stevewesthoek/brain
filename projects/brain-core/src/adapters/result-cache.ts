import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';

const DEFAULT_CACHE_PATH = path.resolve(
  process.env.HOME || '/root',
  '.local/brain-queues/result-cache.jsonl',
);

const CACHE_TTL_MS = 60 * 60 * 1000;

export interface CacheEntry {
  id: string;
  prompt_hash: string;
  result: string;
  created_at: string;
  expires_at: string;
}

function hashPrompt(prompt: string): string {
  return crypto.createHash('sha256').update(prompt).digest('hex');
}

export async function getCachedResult(prompt: string): Promise<string | null> {
  if (!fs.existsSync(DEFAULT_CACHE_PATH)) {
    return null;
  }

  const promptHash = hashPrompt(prompt);
  const now = Date.now();
  const lines = fs.readFileSync(DEFAULT_CACHE_PATH, 'utf-8').split('\n').filter(Boolean);

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as CacheEntry;
      if (entry.prompt_hash === promptHash) {
        const expiresAt = new Date(entry.expires_at).getTime();
        if (expiresAt > now) {
          return entry.result;
        }
      }
    } catch {
      // Skip malformed lines
    }
  }

  return null;
}

export async function setCachedResult(prompt: string, result: string): Promise<void> {
  fs.mkdirSync(path.dirname(DEFAULT_CACHE_PATH), { recursive: true });

  const entry: CacheEntry = {
    id: `cache_${Date.now()}`,
    prompt_hash: hashPrompt(prompt),
    result,
    created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + CACHE_TTL_MS).toISOString(),
  };

  const line = `${JSON.stringify(entry)}\n`;
  fs.appendFileSync(DEFAULT_CACHE_PATH, line, { flag: 'a' });
}

export async function clearExpiredCache(): Promise<number> {
  if (!fs.existsSync(DEFAULT_CACHE_PATH)) {
    return 0;
  }

  const now = Date.now();
  const lines = fs.readFileSync(DEFAULT_CACHE_PATH, 'utf-8').split('\n').filter(Boolean);
  const valid: string[] = [];
  let removed = 0;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line) as CacheEntry;
      const expiresAt = new Date(entry.expires_at).getTime();
      if (expiresAt > now) {
        valid.push(line);
      } else {
        removed++;
      }
    } catch {
      valid.push(line);
    }
  }

  fs.writeFileSync(DEFAULT_CACHE_PATH, valid.join('\n') + '\n');
  return removed;
}
