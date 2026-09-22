import { createHash } from 'node:crypto';

export const JARVIS_CONVERSATION_SCHEMA_VERSION = 'agent-mode.jarvis-conversation.v1' as const;
export const JARVIS_CONVERSATION_TURN_SCHEMA_VERSION = 'agent-mode.jarvis-conversation-turn.v1' as const;
export const MAX_JARVIS_CONVERSATION_ID_LENGTH = 128;
export const MAX_JARVIS_CONVERSATION_TURNS = 64;
export const MAX_JARVIS_CONVERSATION_TEXT_LENGTH = 12_000;

export type JarvisConversationTurnV1 = {
  schemaVersion: typeof JARVIS_CONVERSATION_TURN_SCHEMA_VERSION;
  turnId: string;
  conversationId: string;
  sequence: number;
  speakerRole: 'user' | 'jarvis';
  text: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled' | 'uncertain';
  rootGoalId: string | null;
  taskId: string | null;
  sourceResultRef: string | null;
  createdAt: string;
};

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  return JSON.stringify(value);
}
function digest(value: unknown): string { return createHash('sha256').update(canonical(value), 'utf8').digest('hex'); }

export function canonicalJarvisConversationText(text: string): string { return text.trim().replace(/\s+/gu, ' '); }

export function deriveJarvisConversationTurnId(input: Pick<JarvisConversationTurnV1, 'conversationId' | 'sequence' | 'speakerRole' | 'rootGoalId' | 'text'>): string {
  return `jarvis-conversation-turn:sha256:${digest({ schemaVersion: JARVIS_CONVERSATION_TURN_SCHEMA_VERSION, conversationId: input.conversationId, sequence: input.sequence, speakerRole: input.speakerRole, rootGoalId: input.rootGoalId, text: canonicalJarvisConversationText(input.text) })}`;
}

export function jarvisConversationTurnMaterialHash(turn: JarvisConversationTurnV1): string {
  return digest({ schemaVersion: turn.schemaVersion, turnId: turn.turnId, conversationId: turn.conversationId, sequence: turn.sequence, speakerRole: turn.speakerRole, text: canonicalJarvisConversationText(turn.text), status: turn.status, rootGoalId: turn.rootGoalId, taskId: turn.taskId, sourceResultRef: turn.sourceResultRef });
}

export function validateJarvisConversationTurn(turn: JarvisConversationTurnV1): boolean {
  return turn.schemaVersion === JARVIS_CONVERSATION_TURN_SCHEMA_VERSION
    && typeof turn.turnId === 'string' && turn.turnId.length <= 256
    && typeof turn.conversationId === 'string' && turn.conversationId.length > 0 && turn.conversationId.length <= MAX_JARVIS_CONVERSATION_ID_LENGTH && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(turn.conversationId)
    && Number.isSafeInteger(turn.sequence) && turn.sequence > 0 && turn.sequence <= MAX_JARVIS_CONVERSATION_TURNS
    && (turn.speakerRole === 'user' || turn.speakerRole === 'jarvis')
    && typeof turn.text === 'string' && canonicalJarvisConversationText(turn.text).length > 0 && turn.text.length <= MAX_JARVIS_CONVERSATION_TEXT_LENGTH && !/[\u0000-\u001f\u007f]/u.test(turn.text)
    && ['pending', 'completed', 'failed', 'cancelled', 'uncertain'].includes(turn.status)
    && (turn.rootGoalId === null || /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(turn.rootGoalId))
    && (turn.taskId === null || /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u.test(turn.taskId))
    && (turn.sourceResultRef === null || (typeof turn.sourceResultRef === 'string' && turn.sourceResultRef.length <= 256))
    && Number.isFinite(Date.parse(turn.createdAt))
    && turn.turnId === deriveJarvisConversationTurnId(turn)
    && jarvisConversationTurnMaterialHash(turn).length === 64;
}
