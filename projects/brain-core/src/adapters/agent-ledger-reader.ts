import * as fs from 'node:fs';
import * as path from 'node:path';
import * as readline from 'node:readline';
import type { AgentLedgerEntry, LedgerQuery, LedgerQueryResult } from '../types/agent-ledger.js';

const DEFAULT_LEDGER_PATH = path.resolve(
  process.env.HOME || '/root',
  '.local/brain-ledger/ledger.jsonl',
);

export function readLedgerPath(): string {
  return DEFAULT_LEDGER_PATH;
}

function matchesQuery(entry: AgentLedgerEntry, query: LedgerQuery): boolean {
  if (query.type && entry.type !== query.type) return false;
  if (query.agent && entry.agent !== query.agent) return false;
  if (query.actor && entry.actor !== query.actor) return false;
  if (query.sessionId && entry.sessionId !== query.sessionId) return false;
  if (query.severity && entry.severity !== query.severity) return false;

  if (query.timeRange) {
    const entryTime = new Date(entry.timestamp);
    const fromTime = new Date(query.timeRange.from);
    const toTime = new Date(query.timeRange.to);
    if (entryTime < fromTime || entryTime > toTime) return false;
  }

  return true;
}

export async function queryLedger(query: LedgerQuery): Promise<LedgerQueryResult> {
  const ledgerPath = DEFAULT_LEDGER_PATH;

  if (!fs.existsSync(ledgerPath)) {
    return {
      total_matched: 0,
      returned: 0,
      entries: [],
      query,
      executed_at: new Date().toISOString(),
    };
  }

  const entries: AgentLedgerEntry[] = [];
  let totalMatched = 0;

  const fileStream = fs.createReadStream(ledgerPath);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const entry = JSON.parse(line) as AgentLedgerEntry;

      if (matchesQuery(entry, query)) {
        totalMatched++;
        if (
          (query.offset ?? 0) < totalMatched &&
          entries.length < (query.limit ?? 1000)
        ) {
          entries.push(entry);
        }
      }
    } catch (e) {
      // Skip malformed lines
    }
  }

  return {
    total_matched: totalMatched,
    returned: entries.length,
    entries,
    query,
    executed_at: new Date().toISOString(),
  };
}

export async function queryRecentEntries(
  limit: number = 50,
  agent?: string,
): Promise<AgentLedgerEntry[]> {
  const result = await queryLedger({
    limit,
    agent: agent as any,
  });

  return result.entries.reverse();
}

export async function queryBySession(sessionId: string): Promise<AgentLedgerEntry[]> {
  const result = await queryLedger({ sessionId, limit: 10000 });
  return result.entries;
}
