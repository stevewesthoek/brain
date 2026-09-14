import { createHash } from 'node:crypto';

/**
 * V0-A is a transport contract only.  It deliberately stops at the existing
 * text-intake boundary: no Agent Mode row, K4 admission, runtime dispatch, or
 * provider call is owned by this module.
 *
 *   input -> STT -> bounded text -> JarvisTextIntake -> bounded response -> TTS
 *              \________________ same text/intake semantics _______________/
 */

export const JARVIS_VOICE_SCHEMA_VERSION = 1 as const;
export const JARVIS_VOICE_GATEWAY_VERSION = 'agent-mode.jarvis-voice-gateway.v1' as const;
export const MAX_VOICE_AUDIO_REF_LENGTH = 256;
export const MAX_VOICE_TRANSCRIPT_LENGTH = 2_000;
export const MAX_VOICE_RESPONSE_LENGTH = 2_000;
export const MAX_VOICE_LOCALE_LENGTH = 32;
export const JARVIS_VOICE_CAPABILITIES = Object.freeze({
  input: 'voice.input',
  output: 'voice.output',
  stt: 'speech.stt',
  tts: 'speech.tts',
} as const);

export type VoiceSessionRef = {
  schemaVersion: typeof JARVIS_VOICE_SCHEMA_VERSION;
  sessionId: string;
};

export type VoiceInputMode = 'fixture' | 'push_to_talk';

export type VoiceInputRequestV1 = {
  schemaVersion: typeof JARVIS_VOICE_SCHEMA_VERSION;
  voiceRequestId: string;
  sessionId: string;
  inputMode: VoiceInputMode;
  audioRef: string;
  capturedAt: string;
  locale?: string;
};

export type VoiceTranscriptV1 = {
  schemaVersion: typeof JARVIS_VOICE_SCHEMA_VERSION;
  voiceRequestId: string;
  sessionId: string;
  providerId: string;
  text: string;
  transcribedAt: string;
  locale?: string;
};

export type JarvisTextIntakeRequestV1 = {
  schemaVersion: typeof JARVIS_VOICE_SCHEMA_VERSION;
  intakeId: string;
  voiceRequestId: string;
  sessionId: string;
  text: string;
  receivedAt: string;
  source: 'voice';
};

export type JarvisTextIntakeReceiptV1 = {
  schemaVersion: typeof JARVIS_VOICE_SCHEMA_VERSION;
  intakeId: string;
  voiceRequestId: string;
  status: 'accepted' | 'duplicate';
  canonicalTextHash: string;
  responseText: string;
  idempotency: 'fixture-only' | 'durable';
  rootGoalId: string | null;
  taskId: string | null;
};

export type VoiceOutputRequestV1 = {
  schemaVersion: typeof JARVIS_VOICE_SCHEMA_VERSION;
  outputId: string;
  voiceRequestId: string;
  sessionId: string;
  speakerRole: 'jarvis';
  text: string;
};

export type VoiceOutputReceiptV1 = {
  schemaVersion: typeof JARVIS_VOICE_SCHEMA_VERSION;
  outputId: string;
  voiceRequestId: string;
  sessionId: string;
  providerId: string;
  status: 'succeeded' | 'failed' | 'interrupted' | 'uncertain';
  audioRef: string | null;
  reasonCode: string | null;
};

export type VoiceInterruptRequestV1 = {
  schemaVersion: typeof JARVIS_VOICE_SCHEMA_VERSION;
  voiceRequestId: string;
  sessionId: string;
  outputId: string;
  operation: 'interrupt_output';
  requestedAt: string;
};

export type VoiceGatewayOutcome = 'SUCCEEDED' | 'DUPLICATE' | 'FAILED' | 'DENIED' | 'INTERRUPTED';

export type VoiceGatewayReasonCode =
  | 'VOICE_ACCEPTED'
  | 'VOICE_DUPLICATE'
  | 'STT_FAILED'
  | 'TRANSCRIPT_EMPTY'
  | 'TRANSCRIPT_TOO_LONG'
  | 'INTAKE_FAILED'
  | 'TTS_FAILED'
  | 'TTS_UNCERTAIN'
  | 'INVALID_INPUT'
  | 'INVALID_INTERRUPT'
  | 'VOICE_CONTROL_REQUIRES_NON_VOICE_CONFIRMATION'
  | 'WORKER_VOICE_OUTPUT_DENIED';

export type VoiceGatewayTurnV1 = {
  schemaVersion: typeof JARVIS_VOICE_SCHEMA_VERSION;
  gatewayVersion: typeof JARVIS_VOICE_GATEWAY_VERSION;
  turnId: string;
  voiceRequestId: string;
  sessionId: string;
  outcome: VoiceGatewayOutcome;
  reasonCode: VoiceGatewayReasonCode;
  transcript: VoiceTranscriptV1 | null;
  intake: JarvisTextIntakeReceiptV1 | null;
  outputRequest: VoiceOutputRequestV1 | null;
  output: VoiceOutputReceiptV1 | null;
  idempotency: 'fixture-only' | 'durable' | 'unavailable';
};

export type VoiceInterruptResultV1 = {
  schemaVersion: typeof JARVIS_VOICE_SCHEMA_VERSION;
  voiceRequestId: string;
  sessionId: string;
  outputId: string;
  outcome: 'INTERRUPTED' | 'DENIED';
  reasonCode: 'VOICE_OUTPUT_INTERRUPTED' | 'INVALID_INTERRUPT';
  controlEffects: 0;
};

export type VoiceControlIntentV1 = {
  schemaVersion: typeof JARVIS_VOICE_SCHEMA_VERSION;
  voiceRequestId: string;
  sessionId: string;
  intent: 'approve' | 'reject' | 'cancel' | 'kill' | 'pause' | 'resume' | 'retry' | 'spawn';
  explicit: true;
};

export type VoiceControlDecisionV1 = {
  schemaVersion: typeof JARVIS_VOICE_SCHEMA_VERSION;
  voiceRequestId: string;
  intent: VoiceControlIntentV1['intent'];
  outcome: 'DENIED';
  reasonCode: 'VOICE_CONTROL_REQUIRES_NON_VOICE_CONFIRMATION';
  controlServiceCalls: 0;
};

export type VoiceWorkerOutputDecisionV1 = {
  outcome: 'DENIED';
  reasonCode: 'WORKER_VOICE_OUTPUT_DENIED';
  runtimeEffects: 0;
};

export interface SpeechToTextProvider {
  readonly providerId: string;
  transcribe(input: VoiceInputRequestV1): Promise<VoiceTranscriptV1>;
}

export interface JarvisTextIntake {
  readonly idempotency: 'fixture-only' | 'durable' | 'unavailable';
  accept(input: JarvisTextIntakeRequestV1): Promise<JarvisTextIntakeReceiptV1>;
}

export interface JarvisTextToSpeechProvider {
  readonly providerId: string;
  synthesize(input: VoiceOutputRequestV1): Promise<VoiceOutputReceiptV1>;
  interrupt(input: VoiceInterruptRequestV1): Promise<VoiceOutputReceiptV1>;
}

export type FixtureVoiceReceiptStore = {
  getIntake(intakeId: string): JarvisTextIntakeReceiptV1 | undefined;
  putIntakeIfAbsent(receipt: JarvisTextIntakeReceiptV1): 'created' | 'duplicate' | 'conflict';
  getOutput(outputId: string): VoiceOutputReceiptV1 | undefined;
  putOutputIfAbsent(receipt: VoiceOutputReceiptV1): 'created' | 'duplicate' | 'conflict';
  replaceOutput(receipt: VoiceOutputReceiptV1): void;
};

export class InMemoryFixtureVoiceReceiptStore implements FixtureVoiceReceiptStore {
  private readonly intakes = new Map<string, JarvisTextIntakeReceiptV1>();
  private readonly outputs = new Map<string, VoiceOutputReceiptV1>();

  getIntake(intakeId: string): JarvisTextIntakeReceiptV1 | undefined { return this.intakes.get(intakeId); }

  putIntakeIfAbsent(receipt: JarvisTextIntakeReceiptV1): 'created' | 'duplicate' | 'conflict' {
    const existing = this.intakes.get(receipt.intakeId);
    if (!existing) {
      this.intakes.set(receipt.intakeId, receipt);
      return 'created';
    }
    if (existing.canonicalTextHash !== receipt.canonicalTextHash || existing.voiceRequestId !== receipt.voiceRequestId) return 'conflict';
    return 'duplicate';
  }

  getOutput(outputId: string): VoiceOutputReceiptV1 | undefined { return this.outputs.get(outputId); }

  putOutputIfAbsent(receipt: VoiceOutputReceiptV1): 'created' | 'duplicate' | 'conflict' {
    const existing = this.outputs.get(receipt.outputId);
    if (!existing) {
      this.outputs.set(receipt.outputId, receipt);
      return 'created';
    }
    if (existing.voiceRequestId !== receipt.voiceRequestId || existing.sessionId !== receipt.sessionId) return 'conflict';
    return 'duplicate';
  }

  replaceOutput(receipt: VoiceOutputReceiptV1): void { this.outputs.set(receipt.outputId, receipt); }
}

export class VoiceContractError extends Error {
  constructor(readonly reasonCode: VoiceGatewayReasonCode) {
    super(reasonCode);
    this.name = 'VoiceContractError';
  }
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hash(value: unknown): string { return createHash('sha256').update(canonical(value)).digest('hex'); }

function validId(value: unknown, max = 128): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(value);
}

function validTimestamp(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }

function exactKeys(value: object, allowed: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  const required = expected.filter((key) => key !== 'locale');
  if (actual.some((key) => !expected.includes(key)) || required.some((key) => !actual.includes(key))) throw new VoiceContractError('INVALID_INPUT');
  void label;
}

export function deriveVoiceRequestId(input: Pick<VoiceInputRequestV1, 'sessionId' | 'inputMode' | 'audioRef' | 'capturedAt' | 'locale'>): string {
  return `voice-request:sha256:${hash({ sessionId: input.sessionId, inputMode: input.inputMode, audioRef: input.audioRef, capturedAt: input.capturedAt, locale: input.locale ?? null })}`;
}

export function deriveVoiceIntakeId(voiceRequestId: string, sessionId: string): string {
  // Text is intentionally excluded: a replay with the same transport identity
  // must collide and fail closed if its transcript material differs.
  return `voice-intake:sha256:${hash({ voiceRequestId, sessionId })}`;
}

export function deriveVoiceOutputId(voiceRequestId: string, sessionId: string, text: string): string {
  return `voice-output:sha256:${hash({ voiceRequestId, sessionId, speakerRole: 'jarvis', text })}`;
}

export function validateVoiceInputRequest(input: VoiceInputRequestV1): void {
  exactKeys(input, ['schemaVersion', 'voiceRequestId', 'sessionId', 'inputMode', 'audioRef', 'capturedAt', 'locale'], 'voice input');
  if (input.schemaVersion !== 1 || !validId(input.voiceRequestId) || !validId(input.sessionId)
    || !['fixture', 'push_to_talk'].includes(input.inputMode) || typeof input.audioRef !== 'string'
    || input.audioRef.length === 0 || input.audioRef.length > MAX_VOICE_AUDIO_REF_LENGTH
    || input.audioRef.includes('://') && !input.audioRef.startsWith('fixture://')
    || /^(?:[A-Za-z]:[\\/]|[\\/]{1,2})/.test(input.audioRef)
    || !validTimestamp(input.capturedAt) || (input.locale !== undefined && (typeof input.locale !== 'string' || input.locale.length === 0 || input.locale.length > MAX_VOICE_LOCALE_LENGTH))) {
    throw new VoiceContractError('INVALID_INPUT');
  }
}

function normalizeTranscript(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0) throw new VoiceContractError('TRANSCRIPT_EMPTY');
  if (normalized.length > MAX_VOICE_TRANSCRIPT_LENGTH) throw new VoiceContractError('TRANSCRIPT_TOO_LONG');
  return normalized;
}

function boundedResponse(text: string): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (normalized.length === 0 || normalized.length > MAX_VOICE_RESPONSE_LENGTH) throw new VoiceContractError('TTS_FAILED');
  return normalized;
}

function validateOutputReceipt(receipt: VoiceOutputReceiptV1, request: VoiceOutputRequestV1): void {
  const audioRefValid = receipt.audioRef === null || (typeof receipt.audioRef === 'string' && receipt.audioRef.length > 0
    && receipt.audioRef.length <= MAX_VOICE_AUDIO_REF_LENGTH && !/^(?:[A-Za-z]:[\\/]|[\\/]{1,2})/.test(receipt.audioRef));
  if (receipt.schemaVersion !== 1 || receipt.outputId !== request.outputId || receipt.voiceRequestId !== request.voiceRequestId
    || receipt.sessionId !== request.sessionId || !validId(receipt.providerId)
    || !['succeeded', 'failed', 'interrupted', 'uncertain'].includes(receipt.status)
    || (receipt.status === 'succeeded' ? !audioRefValid || receipt.audioRef === null : receipt.audioRef !== null)) {
    throw new VoiceContractError('TTS_FAILED');
  }
}

function failureTurn(input: VoiceInputRequestV1, reasonCode: VoiceGatewayReasonCode, transcript: VoiceTranscriptV1 | null = null, intake: JarvisTextIntakeReceiptV1 | null = null): VoiceGatewayTurnV1 {
  return {
    schemaVersion: 1, gatewayVersion: JARVIS_VOICE_GATEWAY_VERSION,
    turnId: `voice-turn:sha256:${hash({ voiceRequestId: input.voiceRequestId, sessionId: input.sessionId })}`,
    voiceRequestId: input.voiceRequestId, sessionId: input.sessionId, outcome: 'FAILED', reasonCode,
    transcript, intake, outputRequest: null, output: null, idempotency: 'unavailable',
  };
}

export class FixtureSpeechToTextProvider implements SpeechToTextProvider {
  public invocationCount = 0;

  constructor(
    public readonly providerId = 'fixture-stt-v1',
    private readonly options: { fail?: boolean; text?: string } = {},
  ) {}

  async transcribe(input: VoiceInputRequestV1): Promise<VoiceTranscriptV1> {
    this.invocationCount += 1;
    if (this.options.fail) throw new VoiceContractError('STT_FAILED');
    if (input.audioRef !== 'fixture://voice/hello-jarvis') throw new VoiceContractError('STT_FAILED');
    const text = this.options.text ?? 'Jarvis, summarize the current task.';
    return {
      schemaVersion: 1, voiceRequestId: input.voiceRequestId, sessionId: input.sessionId,
      providerId: this.providerId, text, transcribedAt: input.capturedAt, ...(input.locale ? { locale: input.locale } : {}),
    };
  }
}

export class DeterministicFixtureJarvisTextIntake implements JarvisTextIntake {
  public invocationCount = 0;
  public acceptedCount = 0;
  public readonly idempotency = 'fixture-only' as const;

  constructor(private readonly receipts: FixtureVoiceReceiptStore) {}

  async accept(input: JarvisTextIntakeRequestV1): Promise<JarvisTextIntakeReceiptV1> {
    this.invocationCount += 1;
    const existing = this.receipts.getIntake(input.intakeId);
    const receipt: JarvisTextIntakeReceiptV1 = {
      schemaVersion: 1, intakeId: input.intakeId, voiceRequestId: input.voiceRequestId,
      status: existing ? 'duplicate' : 'accepted', canonicalTextHash: hash(input.text),
      responseText: 'The current task is ready.', idempotency: this.idempotency,
      rootGoalId: null, taskId: null,
    };
    const result = this.receipts.putIntakeIfAbsent(receipt);
    if (result === 'conflict') throw new VoiceContractError('INTAKE_FAILED');
    if (result === 'created') this.acceptedCount += 1;
    return result === 'duplicate' && existing ? { ...existing, status: 'duplicate' } : receipt;
  }
}

export class DeterministicFixtureJarvisTextToSpeech implements JarvisTextToSpeechProvider {
  public invocationCount = 0;

  constructor(
    private readonly receipts: FixtureVoiceReceiptStore,
    public readonly providerId = 'fixture-tts-v1',
    private readonly options: { fail?: boolean; uncertain?: boolean } = {},
  ) {}

  async synthesize(input: VoiceOutputRequestV1): Promise<VoiceOutputReceiptV1> {
    const existing = this.receipts.getOutput(input.outputId);
    if (existing) return existing;
    this.invocationCount += 1;
    const status = this.options.uncertain ? 'uncertain' : this.options.fail ? 'failed' : 'succeeded';
    const receipt: VoiceOutputReceiptV1 = {
      schemaVersion: 1, outputId: input.outputId, voiceRequestId: input.voiceRequestId, sessionId: input.sessionId,
      providerId: this.providerId, status, audioRef: status === 'succeeded' ? 'fixture://voice/jarvis-response' : null,
      reasonCode: status === 'succeeded' ? null : status === 'uncertain' ? 'TTS_OUTCOME_UNCERTAIN' : 'TTS_PROVIDER_FAILED',
    };
    if (this.receipts.putOutputIfAbsent(receipt) === 'conflict') throw new VoiceContractError('TTS_FAILED');
    return receipt;
  }

  async interrupt(input: VoiceInterruptRequestV1): Promise<VoiceOutputReceiptV1> {
    const existing = this.receipts.getOutput(input.outputId);
    const receipt: VoiceOutputReceiptV1 = {
      schemaVersion: 1, outputId: input.outputId, voiceRequestId: input.voiceRequestId, sessionId: input.sessionId,
      providerId: this.providerId, status: 'interrupted', audioRef: null, reasonCode: 'VOICE_OUTPUT_INTERRUPTED',
    };
    this.receipts.replaceOutput(existing && existing.voiceRequestId === input.voiceRequestId ? { ...existing, ...receipt } : receipt);
    return receipt;
  }
}

export type JarvisVoiceGatewayOptions = {
  stt: SpeechToTextProvider;
  intake: JarvisTextIntake;
  tts: JarvisTextToSpeechProvider;
  clock?: () => string;
};

export class JarvisVoiceGateway {
  private readonly clock: () => string;

  constructor(private readonly options: JarvisVoiceGatewayOptions) {
    this.clock = options.clock ?? (() => new Date().toISOString());
  }

  async handleInput(input: VoiceInputRequestV1): Promise<VoiceGatewayTurnV1> {
    try { validateVoiceInputRequest(input); } catch (error) {
      return failureTurn(input, error instanceof VoiceContractError ? error.reasonCode : 'INVALID_INPUT');
    }
    let transcript: VoiceTranscriptV1;
    try {
      transcript = await this.options.stt.transcribe(input);
      if (transcript.schemaVersion !== 1 || transcript.voiceRequestId !== input.voiceRequestId || transcript.sessionId !== input.sessionId || !validId(transcript.providerId)) throw new VoiceContractError('STT_FAILED');
      transcript = { ...transcript, text: normalizeTranscript(transcript.text) };
    } catch (error) {
      return failureTurn(input, error instanceof VoiceContractError && (error.reasonCode === 'TRANSCRIPT_EMPTY' || error.reasonCode === 'TRANSCRIPT_TOO_LONG') ? error.reasonCode : 'STT_FAILED');
    }
    const intakeRequest: JarvisTextIntakeRequestV1 = {
      schemaVersion: 1, intakeId: deriveVoiceIntakeId(input.voiceRequestId, input.sessionId),
      voiceRequestId: input.voiceRequestId, sessionId: input.sessionId, text: transcript.text,
      receivedAt: this.clock(), source: 'voice',
    };
    let intake: JarvisTextIntakeReceiptV1;
    try { intake = await this.options.intake.accept(intakeRequest); } catch {
      return failureTurn(input, 'INTAKE_FAILED', transcript);
    }
    let text: string;
    try { text = boundedResponse(intake.responseText); } catch {
      return failureTurn(input, 'TTS_FAILED', transcript, intake);
    }
    const outputRequest: VoiceOutputRequestV1 = {
      schemaVersion: 1, outputId: deriveVoiceOutputId(input.voiceRequestId, input.sessionId, text),
      voiceRequestId: input.voiceRequestId, sessionId: input.sessionId, speakerRole: 'jarvis', text,
    };
    let output: VoiceOutputReceiptV1;
    try {
      output = await this.options.tts.synthesize(outputRequest);
      validateOutputReceipt(output, outputRequest);
    } catch {
      return { ...failureTurn(input, 'TTS_FAILED', transcript, intake), outputRequest };
    }
    const outputReason = output.status === 'succeeded' ? 'VOICE_ACCEPTED' : output.status === 'uncertain' ? 'TTS_UNCERTAIN' : 'TTS_FAILED';
    return {
      schemaVersion: 1, gatewayVersion: JARVIS_VOICE_GATEWAY_VERSION,
      turnId: `voice-turn:sha256:${hash({ voiceRequestId: input.voiceRequestId, sessionId: input.sessionId })}`,
      voiceRequestId: input.voiceRequestId, sessionId: input.sessionId,
      outcome: output.status === 'succeeded' ? (intake.status === 'duplicate' ? 'DUPLICATE' : 'SUCCEEDED') : 'FAILED',
      reasonCode: outputReason, transcript, intake, outputRequest, output, idempotency: this.options.intake.idempotency,
    };
  }

  async interruptOutput(input: VoiceInterruptRequestV1): Promise<VoiceInterruptResultV1> {
    const keys = Object.keys(input).sort();
    if (keys.some((key) => !['operation', 'outputId', 'requestedAt', 'schemaVersion', 'sessionId', 'voiceRequestId'].includes(key))
      || input.schemaVersion !== 1 || !validId(input.voiceRequestId) || !validId(input.sessionId) || !validId(input.outputId) || input.operation !== 'interrupt_output' || !validTimestamp(input.requestedAt)) {
      return { schemaVersion: 1, voiceRequestId: input.voiceRequestId, sessionId: input.sessionId, outputId: input.outputId, outcome: 'DENIED', reasonCode: 'INVALID_INTERRUPT', controlEffects: 0 };
    }
    await this.options.tts.interrupt(input);
    return { schemaVersion: 1, voiceRequestId: input.voiceRequestId, sessionId: input.sessionId, outputId: input.outputId, outcome: 'INTERRUPTED', reasonCode: 'VOICE_OUTPUT_INTERRUPTED', controlEffects: 0 };
  }
}

export function denyVoiceControlIntent(input: VoiceControlIntentV1): VoiceControlDecisionV1 {
  return { schemaVersion: 1, voiceRequestId: input.voiceRequestId, intent: input.intent, outcome: 'DENIED', reasonCode: 'VOICE_CONTROL_REQUIRES_NON_VOICE_CONFIRMATION', controlServiceCalls: 0 };
}

export function denyWorkerVoiceOutput(): VoiceWorkerOutputDecisionV1 {
  return { outcome: 'DENIED', reasonCode: 'WORKER_VOICE_OUTPUT_DENIED', runtimeEffects: 0 };
}
