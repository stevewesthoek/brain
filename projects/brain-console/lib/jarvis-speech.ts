import type { JarvisUserResponse } from './braincore-schemas';

export const JARVIS_SPEECH_REQUEST_SCHEMA_VERSION = 'agent-mode.jarvis-speech-request.v1' as const;
export const JARVIS_BROWSER_SPEECH_TRANSPORT_VERSION = 'browser-speech-synthesis.v1' as const;
export const MAX_JARVIS_SPEECH_TEXT_LENGTH = 2_000;

export type JarvisSpeechRequestV1 = {
  schemaVersion: typeof JARVIS_SPEECH_REQUEST_SCHEMA_VERSION;
  outputId: string;
  responseId: string;
  rootGoalId: string;
  requestedAt: string;
};

export type JarvisSpeechReceiptV1 = {
  schemaVersion: typeof JARVIS_SPEECH_REQUEST_SCHEMA_VERSION;
  outputId: string;
  responseId: string;
  providerId: typeof JARVIS_BROWSER_SPEECH_TRANSPORT_VERSION;
  effect: 'CLIENT_LOCAL_EFFECT';
  status: 'succeeded' | 'failed' | 'interrupted' | 'uncertain';
  reasonCode: string | null;
};

export type JarvisSpeechPlaybackState = 'idle' | 'starting' | 'speaking' | 'interrupted' | 'completed' | 'failed' | 'unavailable';

export type JarvisSpeechSnapshot = {
  state: JarvisSpeechPlaybackState;
  outputId: string | null;
  responseId: string | null;
  receipt: JarvisSpeechReceiptV1 | null;
};

export type SpeechUtteranceLike = {
  text: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((event: unknown) => void) | null;
};

export type SpeechSynthesisLike = {
  speak(utterance: SpeechUtteranceLike): void;
  cancel(): void;
};

export type SpeechUtteranceFactory = (text: string) => SpeechUtteranceLike;

function canonicalResponseText(text: string): string {
  return text.trim().replace(/\s+/gu, ' ');
}

function validId(value: unknown, max = 256): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value);
}

function validTimestamp(value: unknown): boolean {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function exactKeys(value: object, allowed: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const expected = [...allowed].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

export function validateCanonicalJarvisResponse(response: unknown): response is JarvisUserResponse {
  if (!response || typeof response !== 'object') return false;
  const candidate = response as Record<string, unknown>;
  return exactKeys(candidate, ['schemaVersion', 'responseId', 'rootGoalId', 'taskId', 'jarvisAgentId', 'speakerRole', 'sourceResultRef', 'status', 'text', 'textHash', 'createdAt'])
    && candidate.schemaVersion === 'agent-mode.jarvis-user-response.v1'
    && validId(candidate.responseId)
    && validId(candidate.rootGoalId, 128)
    && validId(candidate.taskId, 128)
    && candidate.jarvisAgentId === 'agent:jarvis'
    && candidate.speakerRole === 'jarvis'
    && typeof candidate.sourceResultRef === 'string'
    && /^organization-final-result:sha256:[a-f0-9]{64}$/u.test(candidate.sourceResultRef)
    && candidate.status === 'published'
    && typeof candidate.text === 'string'
    && candidate.text.length > 0
    && candidate.text.length <= MAX_JARVIS_SPEECH_TEXT_LENGTH
    && canonicalResponseText(candidate.text) === candidate.text
    && !/[\u0000-\u001f\u007f]/u.test(candidate.text)
    && typeof candidate.textHash === 'string'
    && /^[a-f0-9]{64}$/u.test(candidate.textHash)
    && validTimestamp(candidate.createdAt);
}

export function deriveJarvisSpeechOutputId(responseId: string): string {
  return `jarvis-speech-output:${JARVIS_BROWSER_SPEECH_TRANSPORT_VERSION}:${responseId}`;
}

export function buildJarvisSpeechRequest(response: JarvisUserResponse, requestedAt: string): JarvisSpeechRequestV1 {
  return {
    schemaVersion: JARVIS_SPEECH_REQUEST_SCHEMA_VERSION,
    outputId: deriveJarvisSpeechOutputId(response.responseId),
    responseId: response.responseId,
    rootGoalId: response.rootGoalId,
    requestedAt,
  };
}

function receipt(request: JarvisSpeechRequestV1, status: JarvisSpeechReceiptV1['status'], reasonCode: string | null): JarvisSpeechReceiptV1 {
  return {
    schemaVersion: JARVIS_SPEECH_REQUEST_SCHEMA_VERSION,
    outputId: request.outputId,
    responseId: request.responseId,
    providerId: JARVIS_BROWSER_SPEECH_TRANSPORT_VERSION,
    effect: 'CLIENT_LOCAL_EFFECT',
    status,
    reasonCode,
  };
}

function unavailableSnapshot(): JarvisSpeechSnapshot {
  return { state: 'unavailable', outputId: null, responseId: null, receipt: null };
}

/**
 * Client-local speech transport. The only public speech input is a validated
 * canonical Jarvis response; text is never accepted as an independent API.
 */
export class BrowserJarvisSpeechTransport {
  private generation = 0;
  private current: { request: JarvisSpeechRequestV1; response: JarvisUserResponse } | null = null;
  private snapshot: JarvisSpeechSnapshot;
  private readonly listeners = new Set<(snapshot: JarvisSpeechSnapshot) => void>();

  constructor(
    private readonly synthesis: SpeechSynthesisLike | undefined,
    private readonly utteranceFactory: SpeechUtteranceFactory | undefined,
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    this.snapshot = synthesis && utteranceFactory ? { state: 'idle', outputId: null, responseId: null, receipt: null } : unavailableSnapshot();
  }

  getSnapshot(): JarvisSpeechSnapshot { return this.snapshot; }

  subscribe(listener: (snapshot: JarvisSpeechSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private update(snapshot: JarvisSpeechSnapshot): void {
    this.snapshot = snapshot;
    for (const listener of this.listeners) listener(snapshot);
  }

  speak(response: JarvisUserResponse): JarvisSpeechSnapshot {
    if (!validateCanonicalJarvisResponse(response)) {
      this.generation += 1;
      this.current = null;
      this.update({ state: 'failed', outputId: null, responseId: null, receipt: null });
      return this.snapshot;
    }
    if (!this.synthesis || !this.utteranceFactory) {
      this.update(unavailableSnapshot());
      return this.snapshot;
    }
    const request = buildJarvisSpeechRequest(response, this.now());
    const generation = ++this.generation;
    this.current = { request, response };
    this.synthesis.cancel();
    this.update({ state: 'starting', outputId: request.outputId, responseId: response.responseId, receipt: null });
    const utterance = this.utteranceFactory(response.text);
    utterance.onstart = () => {
      if (generation !== this.generation) return;
      this.update({ state: 'speaking', outputId: request.outputId, responseId: response.responseId, receipt: null });
    };
    utterance.onend = () => {
      if (generation !== this.generation) return;
      this.current = null;
      this.update({ state: 'completed', outputId: request.outputId, responseId: response.responseId, receipt: receipt(request, 'succeeded', null) });
    };
    utterance.onerror = (event) => {
      if (generation !== this.generation) return;
      this.current = null;
      const reasonCode = event && typeof event === 'object' && 'error' in event ? String((event as { error?: unknown }).error) : 'SPEECH_SYNTHESIS_FAILED';
      this.update({ state: 'failed', outputId: request.outputId, responseId: response.responseId, receipt: receipt(request, 'failed', reasonCode || 'SPEECH_SYNTHESIS_FAILED') });
    };
    try {
      this.synthesis.speak(utterance);
    } catch {
      if (generation === this.generation) {
        this.current = null;
        this.update({ state: 'failed', outputId: request.outputId, responseId: response.responseId, receipt: receipt(request, 'failed', 'SPEECH_SYNTHESIS_FAILED') });
      }
    }
    return this.snapshot;
  }

  interrupt(): JarvisSpeechSnapshot {
    if (!this.current || !['starting', 'speaking'].includes(this.snapshot.state)) return this.snapshot;
    const { request, response } = this.current;
    this.generation += 1;
    this.current = null;
    this.synthesis?.cancel();
    this.update({ state: 'interrupted', outputId: request.outputId, responseId: response.responseId, receipt: receipt(request, 'interrupted', 'VOICE_OUTPUT_INTERRUPTED') });
    return this.snapshot;
  }

  dispose(): void {
    this.generation += 1;
    this.current = null;
    this.synthesis?.cancel();
    this.listeners.clear();
  }
}

export function createBrowserJarvisSpeechTransport(now?: () => string): BrowserJarvisSpeechTransport {
  if (typeof window === 'undefined' || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return new BrowserJarvisSpeechTransport(undefined, undefined, now);
  const synthesis: SpeechSynthesisLike = {
    speak: (utterance) => {
      const nativeUtterance = new window.SpeechSynthesisUtterance(utterance.text);
      nativeUtterance.onstart = () => utterance.onstart?.();
      nativeUtterance.onend = () => utterance.onend?.();
      nativeUtterance.onerror = (event) => utterance.onerror?.(event);
      window.speechSynthesis.speak(nativeUtterance);
    },
    cancel: () => window.speechSynthesis.cancel(),
  };
  return new BrowserJarvisSpeechTransport(synthesis, (text) => ({ text, onstart: null, onend: null, onerror: null }), now);
}
