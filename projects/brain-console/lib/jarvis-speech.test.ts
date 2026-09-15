import assert from 'node:assert/strict';
import test from 'node:test';
import { jarvisUserResponseReadResponseSchema, type JarvisUserResponse } from './braincore-schemas';
import { BrowserJarvisSpeechTransport, deriveJarvisSpeechOutputId } from './jarvis-speech';

const RESPONSE: JarvisUserResponse = {
  schemaVersion: 'agent-mode.jarvis-user-response.v1',
  responseId: 'jarvis-user-response:sha256:response-one',
  rootGoalId: 'root:one',
  taskId: 'root:one',
  jarvisAgentId: 'agent:jarvis',
  speakerRole: 'jarvis',
  sourceResultRef: `organization-final-result:sha256:${'a'.repeat(64)}`,
  status: 'published',
  text: 'The bounded organization completed successfully.',
  textHash: 'b'.repeat(64),
  createdAt: '2026-09-15T10:00:00.000Z',
};

class FakeSpeechSynthesis {
  readonly utterances: Array<{ text: string; onstart: (() => void) | null; onend: (() => void) | null; onerror: ((event: unknown) => void) | null }> = [];
  cancelCount = 0;

  speak(utterance: (typeof this.utterances)[number]): void { this.utterances.push(utterance); }
  cancel(): void { this.cancelCount += 1; }
}

function transport(fake: FakeSpeechSynthesis, now = '2026-09-15T10:01:00.000Z'): BrowserJarvisSpeechTransport {
  return new BrowserJarvisSpeechTransport(fake, (text) => ({ text, onstart: null, onend: null, onerror: null }), () => now);
}

test('canonical response schema and speech identity are strict and deterministic', () => {
  const parsed = jarvisUserResponseReadResponseSchema.parse({ ok: true, response: RESPONSE });
  assert.equal(parsed.response.text, RESPONSE.text);
  assert.equal(deriveJarvisSpeechOutputId(RESPONSE.responseId), deriveJarvisSpeechOutputId(RESPONSE.responseId));
  assert.equal(jarvisUserResponseReadResponseSchema.safeParse({ ok: true, response: { ...RESPONSE, speakerRole: 'worker' } }).success, false);
  assert.equal(jarvisUserResponseReadResponseSchema.safeParse({ ok: true, response: { ...RESPONSE, status: 'succeeded' } }).success, false);
  assert.equal(jarvisUserResponseReadResponseSchema.safeParse({ ok: true, response: { ...RESPONSE, arbitraryText: 'caller authority' } }).success, false);
});

test('browser transport speaks exactly canonical Jarvis text and completes deterministically', () => {
  const fake = new FakeSpeechSynthesis();
  const state = transport(fake);
  assert.equal(state.speak(RESPONSE).state, 'starting');
  assert.equal(fake.utterances[0]?.text, RESPONSE.text);
  fake.utterances[0]!.onstart!();
  assert.equal(state.getSnapshot().state, 'speaking');
  fake.utterances[0]!.onend!();
  assert.equal(state.getSnapshot().state, 'completed');
  assert.equal(state.getSnapshot().receipt?.status, 'succeeded');
  assert.equal(state.getSnapshot().receipt?.outputId, deriveJarvisSpeechOutputId(RESPONSE.responseId));
});

test('interrupt wins a completion race and does not create domain effects', () => {
  const fake = new FakeSpeechSynthesis();
  const state = transport(fake);
  state.speak(RESPONSE);
  fake.utterances[0]!.onstart!();
  assert.equal(state.interrupt().state, 'interrupted');
  fake.utterances[0]!.onend!();
  fake.utterances[0]!.onerror!({ error: 'canceled' });
  assert.equal(state.getSnapshot().state, 'interrupted');
  assert.equal(state.getSnapshot().receipt?.status, 'interrupted');
  assert.equal(fake.cancelCount, 2);
});

test('speech failure affects only the local transport and explicit Speak reuses the response', () => {
  const fake = new FakeSpeechSynthesis();
  const state = transport(fake);
  state.speak(RESPONSE);
  fake.utterances[0]!.onerror!({ error: 'audio-failure' });
  assert.equal(state.getSnapshot().state, 'failed');
  assert.equal(state.getSnapshot().receipt?.status, 'failed');
  assert.equal(state.speak(RESPONSE).state, 'starting');
  assert.equal(fake.utterances[1]?.text, RESPONSE.text);
  assert.equal(state.getSnapshot().outputId, deriveJarvisSpeechOutputId(RESPONSE.responseId));
});

test('unavailable browser speech is explicit and cannot synthesize arbitrary text', () => {
  const unavailable = new BrowserJarvisSpeechTransport(undefined, undefined);
  assert.equal(unavailable.getSnapshot().state, 'unavailable');
  assert.equal(unavailable.speak(RESPONSE).state, 'unavailable');
  const fake = new FakeSpeechSynthesis();
  const state = transport(fake);
  assert.equal(state.speak({ text: 'Caller-authored speech' } as never).state, 'failed');
  assert.equal(fake.utterances.length, 0);
});
