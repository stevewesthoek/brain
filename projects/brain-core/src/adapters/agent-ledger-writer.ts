import * as fs from 'node:fs';
import * as path from 'node:path';
import * as crypto from 'node:crypto';
import type { AgentLedgerEntry, AgentLedgerEventType, ActorModel, EventSeverity } from '../types/agent-ledger.js';

const DEFAULT_LEDGER_PATH = path.resolve(
  process.env.HOME || '/root',
  '.local/brain-ledger/ledger.jsonl',
);

export interface WriteEventOptions {
  type: AgentLedgerEventType;
  sessionId: string;
  agent: 'claude-code' | 'codex-cli' | 'gemini-cli';
  actor: ActorModel;
  severity?: EventSeverity;
  metadata?: Partial<{ model: ActorModel; cost?: number; tokens?: { input: number; output: number }; duration_ms?: number; tags?: string[] }>;
  payload: Record<string, unknown>;
}

function generateEventId(): string {
  const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
  const sequence = Math.random().toString(36).slice(2, 8);
  return `evt_${timestamp}_${sequence}`;
}

function generateSignature(entry: Omit<AgentLedgerEntry, 'signature'>): string {
  const data = JSON.stringify({
    id: entry.id,
    timestamp: entry.timestamp,
    type: entry.type,
    payload: entry.payload,
  });
  return crypto.createHash('sha256').update(data).digest('hex');
}

function validateEntry(entry: AgentLedgerEntry): boolean {
  if (!entry.id || !entry.timestamp || !entry.type || !entry.sessionId) {
    return false;
  }
  if (!entry.timestamp.match(/^\d{4}-\d{2}-\d{2}T/)) {
    return false;
  }
  return true;
}

export async function writeEventToLedger(options: WriteEventOptions): Promise<boolean> {
  try {
    fs.mkdirSync(path.dirname(DEFAULT_LEDGER_PATH), { recursive: true });

    const entry: AgentLedgerEntry = {
      id: generateEventId(),
      version: '1.0',
      timestamp: new Date().toISOString(),
      sessionId: options.sessionId,
      agent: options.agent,
      type: options.type,
      actor: options.actor,
      severity: options.severity || 'info',
      status: 'completed',
      metadata: options.metadata ? { model: options.actor, ...options.metadata } : { model: options.actor },
      payload: options.payload,
    };

    if (!validateEntry(entry)) {
      console.error('Invalid ledger entry:', entry);
      return false;
    }

    entry.signature = generateSignature(entry);

    const line = `${JSON.stringify(entry)}\n`;
    fs.appendFileSync(DEFAULT_LEDGER_PATH, line, { flag: 'a' });

    return true;
  } catch (error) {
    console.error('Failed to write ledger entry:', error);
    return false;
  }
}

export function getLedgerPath(): string {
  return DEFAULT_LEDGER_PATH;
}
