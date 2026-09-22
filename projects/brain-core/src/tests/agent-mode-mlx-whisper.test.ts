import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { MlxWhisperError, MlxWhisperSpeechToTextProvider } from '../agent-mode/mlx-whisper-speech-to-text.js';

function wav(): Buffer {
  const sampleRate = 16_000; const samples = sampleRate; const buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF', 0); buffer.writeUInt32LE(36 + samples * 2, 4); buffer.write('WAVE', 8); buffer.write('fmt ', 12); buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22); buffer.writeUInt32LE(sampleRate, 24); buffer.writeUInt32LE(sampleRate * 2, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34); buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40); return buffer;
}

function input() { return { schemaVersion: 1 as const, voiceRequestId: 'voice:one', sessionId: 'operator:one', inputMode: 'push_to_talk' as const, audioRef: 'voice-upload://voice:one', capturedAt: '2026-09-15T10:00:00.000Z' }; }

test('MLX adapter uses bounded structured argv and parses deterministic fixture output', async () => {
  const dir = mkdtempSync(`${tmpdir()}/brain-mlx-`); const audio = `${dir}/audio.wav`; const executable = `${dir}/mlx_whisper`; const model = `${dir}/model`; writeFileSync(audio, wav() as unknown as string); writeFileSync(executable, 'fixture'); writeFileSync(model, 'fixture');
  const calls: unknown[] = []; let released = 0;
  try {
    const provider = new MlxWhisperSpeechToTextProvider({ executablePath: executable, modelPath: model, resourceAdmission: { acquire: async () => () => { released += 1; } }, runner: async (request) => { calls.push(request); return { exitCode: 0, stdout: '{"text":"  Hello   Jarvis. "}', stderr: '', timedOut: false, outputOverflow: false }; }, now: () => '2026-09-15T10:01:00.000Z' });
    const transcript = await provider.transcribeFile(input(), audio);
    assert.equal(transcript.text, 'Hello Jarvis.'); assert.equal(transcript.providerId, 'mlx-whisper-local.v1'); assert.equal(released, 1); assert.equal(calls.length, 1);
    assert.deepEqual((calls[0] as { args: string[] }).args, [audio, '--model', model, '--output-format', 'json']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('MLX adapter fails closed on unavailable resources, malformed output, and timeout', async () => {
  const dir = mkdtempSync(`${tmpdir()}/brain-mlx-fail-`); const audio = `${dir}/audio.wav`; writeFileSync(audio, wav() as unknown as string);
  try {
    const unavailable = new MlxWhisperSpeechToTextProvider({ executablePath: '/missing/mlx_whisper', modelPath: '/missing/model', resourceAdmission: { acquire: async () => undefined }, runner: async () => ({ exitCode: 0, stdout: '{"text":"x"}', stderr: '', timedOut: false, outputOverflow: false }) });
    await assert.rejects(unavailable.transcribeFile(input(), audio), (error: unknown) => error instanceof MlxWhisperError && error.reasonCode === 'STT_UNAVAILABLE');
    const malformed = new MlxWhisperSpeechToTextProvider({ executablePath: '/fixture/mlx_whisper', modelPath: '/fixture/model', resourceAdmission: { acquire: async () => () => undefined }, runner: async () => ({ exitCode: 0, stdout: 'not-json', stderr: '', timedOut: false, outputOverflow: false }) });
    await assert.rejects(malformed.transcribeFile(input(), audio), (error: unknown) => error instanceof MlxWhisperError && error.reasonCode === 'STT_OUTPUT_INVALID');
    const timeout = new MlxWhisperSpeechToTextProvider({ executablePath: '/fixture/mlx_whisper', modelPath: '/fixture/model', resourceAdmission: { acquire: async () => () => undefined }, runner: async () => ({ exitCode: null, stdout: '', stderr: '', timedOut: true, outputOverflow: false }) });
    await assert.rejects(timeout.transcribeFile(input(), audio), (error: unknown) => error instanceof MlxWhisperError && error.reasonCode === 'STT_TIMEOUT');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
