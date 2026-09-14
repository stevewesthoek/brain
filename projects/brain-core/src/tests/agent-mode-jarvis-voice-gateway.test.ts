import assert from 'node:assert/strict';
import test from 'node:test';
import {
  denyVoiceControlIntent,
  denyWorkerVoiceOutput,
  deriveVoiceIntakeId,
  deriveVoiceOutputId,
  deriveVoiceRequestId,
  DeterministicFixtureJarvisTextIntake,
  DeterministicFixtureJarvisTextToSpeech,
  FixtureSpeechToTextProvider,
  InMemoryFixtureVoiceReceiptStore,
  JARVIS_VOICE_CAPABILITIES,
  JarvisVoiceGateway,
  type VoiceInputRequestV1,
} from '../agent-mode/jarvis-voice-gateway.js';

const CAPTURED_AT = '2026-09-14T10:00:00.000Z';

function input(overrides: Partial<VoiceInputRequestV1> = {}): VoiceInputRequestV1 {
  return {
    schemaVersion: 1,
    voiceRequestId: 'voice-request:test-1',
    sessionId: 'voice-session:test-1',
    inputMode: 'fixture',
    audioRef: 'fixture://voice/hello-jarvis',
    capturedAt: CAPTURED_AT,
    ...overrides,
  };
}

function fixture(options: { stt?: FixtureSpeechToTextProvider; tts?: DeterministicFixtureJarvisTextToSpeech; ttsProviderId?: string } = {}) {
  const receipts = new InMemoryFixtureVoiceReceiptStore();
  const stt = options.stt ?? new FixtureSpeechToTextProvider();
  const intake = new DeterministicFixtureJarvisTextIntake(receipts);
  const tts = options.tts ?? new DeterministicFixtureJarvisTextToSpeech(receipts, options.ttsProviderId ?? 'fixture-tts-v1');
  const gateway = new JarvisVoiceGateway({ stt, intake, tts, clock: () => CAPTURED_AT });
  return { gateway, stt, intake, tts, receipts };
}

test('V0-A contracts keep transport identity provider-neutral and deterministic', () => {
  const request = input();
  assert.equal(deriveVoiceRequestId(request), deriveVoiceRequestId(request));
  assert.notEqual(deriveVoiceRequestId(request), deriveVoiceRequestId({ ...request, audioRef: 'fixture://voice/other' }));
  assert.equal(deriveVoiceIntakeId(request.voiceRequestId, request.sessionId), deriveVoiceIntakeId(request.voiceRequestId, request.sessionId));
  assert.equal(deriveVoiceOutputId(request.voiceRequestId, request.sessionId, 'The current task is ready.'), deriveVoiceOutputId(request.voiceRequestId, request.sessionId, 'The current task is ready.'));
  const session: { schemaVersion: 1; sessionId: string } = { schemaVersion: 1, sessionId: request.sessionId };
  assert.deepEqual(session, { schemaVersion: 1, sessionId: 'voice-session:test-1' });
  const output = { schemaVersion: 1, outputId: 'voice-output:test', voiceRequestId: request.voiceRequestId, sessionId: request.sessionId, speakerRole: 'jarvis' as const, text: 'bounded' };
  assert.equal('modelRef' in output, false);
  assert.equal('runtimeRef' in output, false);
  assert.equal('capabilityGrant' in output, false);
  assert.deepEqual(JARVIS_VOICE_CAPABILITIES, { input: 'voice.input', output: 'voice.output', stt: 'speech.stt', tts: 'speech.tts' });
});

test('fixture gateway follows STT -> canonical text-intake seam -> Jarvis TTS', async () => {
  const state = fixture();
  const result = await state.gateway.handleInput(input());
  assert.equal(result.outcome, 'SUCCEEDED');
  assert.equal(result.reasonCode, 'VOICE_ACCEPTED');
  assert.equal(result.transcript?.text, 'Jarvis, summarize the current task.');
  assert.equal(result.intake?.status, 'accepted');
  assert.equal(result.intake?.rootGoalId, null);
  assert.equal(result.intake?.taskId, null);
  assert.equal(result.outputRequest?.speakerRole, 'jarvis');
  assert.equal(result.output?.status, 'succeeded');
  assert.equal(result.output?.audioRef, 'fixture://voice/jarvis-response');
  assert.equal(state.stt.invocationCount, 1);
  assert.equal(state.intake.acceptedCount, 1);
  assert.equal(state.tts.invocationCount, 1);
});

test('replaying the same request is a duplicate logical intake and does not replay TTS', async () => {
  const state = fixture();
  const first = await state.gateway.handleInput(input());
  const second = await state.gateway.handleInput(input());
  assert.equal(first.turnId, second.turnId);
  assert.equal(second.outcome, 'DUPLICATE');
  assert.equal(second.intake?.status, 'duplicate');
  assert.equal(state.intake.acceptedCount, 1);
  assert.equal(state.tts.invocationCount, 1);
});

test('same voice identity with conflicting transcript material fails closed', async () => {
  const state = fixture();
  const first = await state.gateway.handleInput(input());
  assert.equal(first.outcome, 'SUCCEEDED');
  const conflictingGateway = new JarvisVoiceGateway({
    stt: new FixtureSpeechToTextProvider('fixture-stt-v2', { text: 'Jarvis, use a different request.' }),
    intake: state.intake,
    tts: state.tts,
    clock: () => CAPTURED_AT,
  });
  const conflicting = await conflictingGateway.handleInput(input());
  assert.equal(conflicting.outcome, 'FAILED');
  assert.equal(conflicting.reasonCode, 'INTAKE_FAILED');
  assert.equal(state.intake.acceptedCount, 1);
  assert.equal(state.tts.invocationCount, 1);
});

test('STT failure and malformed transcript never reach intake or TTS', async () => {
  const failed = fixture({ stt: new FixtureSpeechToTextProvider('fixture-stt-failed', { fail: true }) });
  const failedResult = await failed.gateway.handleInput(input());
  assert.equal(failedResult.reasonCode, 'STT_FAILED');
  assert.equal(failed.intake.invocationCount, 0);
  assert.equal(failed.tts.invocationCount, 0);

  const empty = fixture({ stt: new FixtureSpeechToTextProvider('fixture-stt-empty', { text: '   ' }) });
  const emptyResult = await empty.gateway.handleInput(input());
  assert.equal(emptyResult.reasonCode, 'TRANSCRIPT_EMPTY');
  assert.equal(empty.intake.invocationCount, 0);
  assert.equal(empty.tts.invocationCount, 0);

  const oversized = fixture({ stt: new FixtureSpeechToTextProvider('fixture-stt-large', { text: 'x'.repeat(2_001) }) });
  const oversizedResult = await oversized.gateway.handleInput(input());
  assert.equal(oversizedResult.reasonCode, 'TRANSCRIPT_TOO_LONG');
  assert.equal(oversized.intake.invocationCount, 0);
  assert.equal(oversized.tts.invocationCount, 0);
});

test('TTS failure and uncertainty remain transport outcomes without replaying intake', async () => {
  const failed = fixture();
  const failedTts = new DeterministicFixtureJarvisTextToSpeech(failed.receipts, 'fixture-tts-failed', { fail: true });
  const failedGateway = new JarvisVoiceGateway({ stt: failed.stt, intake: failed.intake, tts: failedTts, clock: () => CAPTURED_AT });
  const failedResult = await failedGateway.handleInput(input());
  assert.equal(failedResult.reasonCode, 'TTS_FAILED');
  assert.equal(failed.intake.acceptedCount, 1);
  assert.equal(failedTts.invocationCount, 1);

  const uncertain = fixture();
  const uncertainTts = new DeterministicFixtureJarvisTextToSpeech(uncertain.receipts, 'fixture-tts-uncertain', { uncertain: true });
  const uncertainGateway = new JarvisVoiceGateway({ stt: uncertain.stt, intake: uncertain.intake, tts: uncertainTts, clock: () => CAPTURED_AT });
  const uncertainResult = await uncertainGateway.handleInput(input());
  assert.equal(uncertainResult.reasonCode, 'TTS_UNCERTAIN');
  assert.equal(uncertainResult.output?.status, 'uncertain');
});

test('provider replacement preserves normalized text/intake/output identity', async () => {
  const first = fixture({ stt: new FixtureSpeechToTextProvider('provider-a'), ttsProviderId: 'provider-a-tts' });
  const second = fixture({ stt: new FixtureSpeechToTextProvider('provider-b'), ttsProviderId: 'provider-b-tts' });
  const firstResult = await first.gateway.handleInput(input());
  const secondResult = await second.gateway.handleInput(input());
  assert.equal(firstResult.transcript?.text, secondResult.transcript?.text);
  assert.equal(firstResult.intake?.intakeId, secondResult.intake?.intakeId);
  assert.equal(firstResult.outputRequest?.outputId, secondResult.outputRequest?.outputId);
  assert.notEqual(firstResult.transcript?.providerId, secondResult.transcript?.providerId);
  assert.notEqual(firstResult.output?.providerId, secondResult.output?.providerId);
});

test('interrupt stops only the voice transport and never invokes control authority', async () => {
  const state = fixture();
  const turn = await state.gateway.handleInput(input());
  const interrupt = await state.gateway.interruptOutput({ schemaVersion: 1, voiceRequestId: turn.voiceRequestId, sessionId: turn.sessionId, outputId: turn.outputRequest!.outputId, operation: 'interrupt_output', requestedAt: CAPTURED_AT });
  assert.equal(interrupt.outcome, 'INTERRUPTED');
  assert.equal(interrupt.controlEffects, 0);
  const invalid = await state.gateway.interruptOutput({ schemaVersion: 1, voiceRequestId: turn.voiceRequestId, sessionId: turn.sessionId, outputId: turn.outputRequest!.outputId, operation: 'interrupt_output', requestedAt: 'not-a-time' });
  assert.equal(invalid.outcome, 'DENIED');
  assert.equal(invalid.controlEffects, 0);
  assert.equal(denyVoiceControlIntent({ schemaVersion: 1, voiceRequestId: turn.voiceRequestId, sessionId: turn.sessionId, intent: 'cancel', explicit: true }).controlServiceCalls, 0);
  assert.deepEqual(denyWorkerVoiceOutput(), { outcome: 'DENIED', reasonCode: 'WORKER_VOICE_OUTPUT_DENIED', runtimeEffects: 0 });
});

test('voice input has no wake-word or live-provider path', async () => {
  const state = fixture();
  const result = await state.gateway.handleInput(input({ inputMode: 'push_to_talk' }));
  assert.equal(result.outcome, 'SUCCEEDED');
  assert.equal(state.stt.providerId.startsWith('fixture-'), true);
  assert.equal(state.tts.providerId.startsWith('fixture-'), true);
});

test('filesystem audio references are rejected before provider dispatch', async () => {
  const state = fixture();
  const result = await state.gateway.handleInput(input({ audioRef: '/private/recording.wav' }));
  assert.equal(result.outcome, 'FAILED');
  assert.equal(result.reasonCode, 'INVALID_INPUT');
  assert.equal(state.stt.invocationCount, 0);
});
