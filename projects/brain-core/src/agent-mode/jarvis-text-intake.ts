import { createHash } from 'node:crypto';
import type { AgentModeJarvisIntakeRecord, AgentModeSqliteStateStore } from './sqlite-state-store.js';

export const JARVIS_TEXT_INTAKE_SCHEMA_VERSION = 'agent-mode.jarvis-text-intake.v1' as const;
export const JARVIS_AGENT_ID = 'agent:jarvis' as const;
export const MAX_JARVIS_INTAKE_ID_LENGTH = 128;
export const MAX_JARVIS_OPERATOR_ID_LENGTH = 128;
export const MAX_JARVIS_TEXT_LENGTH = 4_000;

export type JarvisTextIntakeCommandV1 = {
  schemaVersion: typeof JARVIS_TEXT_INTAKE_SCHEMA_VERSION;
  intakeId: string;
  source: 'typed' | 'voice';
  operatorId: string;
  text: string;
  receivedAt: string;
};

export type JarvisTextIntakeReceiptV1 = {
  schemaVersion: typeof JARVIS_TEXT_INTAKE_SCHEMA_VERSION;
  intakeId: string;
  status: 'accepted' | 'duplicate';
  canonicalTextHash: string;
  rootGoalId: string;
  taskId: string;
  jarvisAgentId: string;
  createdAt: string;
};

export type JarvisTextIntakeResult =
  | { outcome: 'accepted' | 'duplicate'; receipt: JarvisTextIntakeReceiptV1 }
  | { outcome: 'conflict' | 'denied'; reasonCode: 'JARVIS_INTAKE_CONFLICT' | 'JARVIS_INTAKE_INVALID' | 'JARVIS_INTAKE_UNAVAILABLE' };

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}

function digest(value: unknown): string {
  return createHash('sha256').update(canonical(value), 'utf8').digest('hex');
}

function validId(value: unknown, max: number): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
}

export function canonicalJarvisText(text: string): string {
  return text.trim().replace(/\s+/gu, ' ');
}

export function deriveJarvisRootGoalId(intakeId: string): string {
  return `root:jarvis:sha256:${digest({ domain: 'agent-mode.jarvis-root-goal.v1', intakeId })}`;
}

export function deriveJarvisIntakeMaterialHash(command: JarvisTextIntakeCommandV1): string {
  return digest({ schemaVersion: command.schemaVersion, intakeId: command.intakeId, source: command.source, operatorId: command.operatorId, canonicalTextHash: digest(canonicalJarvisText(command.text)) });
}

export function validateJarvisTextIntakeCommand(command: JarvisTextIntakeCommandV1): void {
  if (command.schemaVersion !== JARVIS_TEXT_INTAKE_SCHEMA_VERSION || !validId(command.intakeId, MAX_JARVIS_INTAKE_ID_LENGTH) || !validId(command.operatorId, MAX_JARVIS_OPERATOR_ID_LENGTH) || !['typed', 'voice'].includes(command.source) || typeof command.text !== 'string' || canonicalJarvisText(command.text).length === 0 || canonicalJarvisText(command.text).length > MAX_JARVIS_TEXT_LENGTH || !Number.isFinite(Date.parse(command.receivedAt))) throw new Error('invalid Jarvis text intake command');
}

function receipt(record: AgentModeJarvisIntakeRecord, status: 'accepted' | 'duplicate'): JarvisTextIntakeReceiptV1 {
  return { schemaVersion: JARVIS_TEXT_INTAKE_SCHEMA_VERSION, intakeId: record.intakeId, status, canonicalTextHash: record.canonicalTextHash, rootGoalId: record.rootGoalId, taskId: record.taskId, jarvisAgentId: record.jarvisAgentId, createdAt: record.createdAt };
}

/** Typed and voice submissions share this one durable domain path. */
export class JarvisTextIntakeService {
  constructor(private readonly store: AgentModeSqliteStateStore, private readonly now: () => string = () => new Date().toISOString()) {}

  acceptCommand(command: JarvisTextIntakeCommandV1): JarvisTextIntakeResult {
    try {
      validateJarvisTextIntakeCommand(command);
      const canonicalTextHash = digest(canonicalJarvisText(command.text));
      const record: AgentModeJarvisIntakeRecord = {
        intakeId: command.intakeId,
        materialHash: deriveJarvisIntakeMaterialHash(command),
        schemaVersion: 1,
        source: command.source,
        operatorId: command.operatorId,
        canonicalTextHash,
        rootGoalId: deriveJarvisRootGoalId(command.intakeId),
        taskId: deriveJarvisRootGoalId(command.intakeId),
        jarvisAgentId: JARVIS_AGENT_ID,
        receivedAt: command.receivedAt,
        createdAt: this.now(),
      };
      const persisted = this.store.recordJarvisIntake(record);
      if (persisted.result === 'conflict') return { outcome: 'conflict', reasonCode: persisted.reasonCode };
      return { outcome: persisted.result === 'created' ? 'accepted' : 'duplicate', receipt: receipt(persisted.record, persisted.result === 'created' ? 'accepted' : 'duplicate') };
    } catch (error) {
      if (error instanceof Error && error.message === 'Jarvis intake root task identity is already claimed') return { outcome: 'conflict', reasonCode: 'JARVIS_INTAKE_CONFLICT' };
      if (error instanceof Error && error.message === 'invalid Jarvis text intake command') return { outcome: 'denied', reasonCode: 'JARVIS_INTAKE_INVALID' };
      return { outcome: 'denied', reasonCode: 'JARVIS_INTAKE_UNAVAILABLE' };
    }
  }
}

export function deriveJarvisIntakeId(requestId: string, source: 'typed' | 'voice'): string {
  return `intake:jarvis:sha256:${digest({ domain: 'agent-mode.jarvis-intake-request.v1', requestId, source })}`;
}
