import { spawn } from 'node:child_process';
import { chmodSync, closeSync, existsSync, mkdirSync, openSync, readSync, statSync, unlinkSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import type { SpeechToTextProvider, VoiceInputRequestV1, VoiceTranscriptV1 } from './jarvis-voice-gateway.js';

export const MLX_WHISPER_PROVIDER_ID = 'mlx-whisper-local.v1' as const;
export const MAX_STT_AUDIO_BYTES = 8 * 1024 * 1024;
export const MAX_STT_DURATION_SECONDS = 30;
export const MAX_STT_OUTPUT_BYTES = 16 * 1024;
export const DEFAULT_STT_TIMEOUT_MS = 45_000;

export type MlxWhisperProcessInput = {
  executablePath: string;
  args: readonly string[];
  cwd: string;
  timeoutMs: number;
  maxOutputBytes: number;
};

export type MlxWhisperProcessResult = { exitCode: number | null; stdout: string; stderr: string; timedOut: boolean; outputOverflow: boolean };
export type MlxWhisperProcessRunner = (input: MlxWhisperProcessInput) => Promise<MlxWhisperProcessResult>;
export type MlxResourceAdmission = { acquire(): Promise<(() => void) | undefined> };

export type MlxWhisperSpeechToTextOptions = {
  executablePath: string;
  modelPath: string;
  cwd?: string;
  timeoutMs?: number;
  maxOutputBytes?: number;
  resolveAudioPath?: (audioRef: string) => string | undefined;
  resourceAdmission?: MlxResourceAdmission;
  runner?: MlxWhisperProcessRunner;
  now?: () => string;
};

export class MlxWhisperError extends Error {
  constructor(readonly reasonCode: 'STT_UNAVAILABLE' | 'STT_TIMEOUT' | 'STT_OUTPUT_INVALID' | 'AUDIO_UNSUPPORTED' | 'AUDIO_TOO_LARGE' | 'AUDIO_TOO_LONG' | 'STT_FAILED') {
    super(reasonCode);
    this.name = 'MlxWhisperError';
  }
}

export function validateWavFile(filePath: string): { bytes: number; durationSeconds: number } {
  let stat;
  try { stat = statSync(filePath); } catch { throw new MlxWhisperError('STT_UNAVAILABLE'); }
  if (!stat.isFile() || stat.size > MAX_STT_AUDIO_BYTES) throw new MlxWhisperError('AUDIO_TOO_LARGE');
  const fd = openSync(filePath, 'r');
  const header = Buffer.alloc(Math.min(stat.size, 1024));
  try { readSync(fd, header, 0, header.length, 0); } finally { closeSync(fd); }
  if (header.length < 44 || header.toString('ascii', 0, 4) !== 'RIFF' || header.toString('ascii', 8, 12) !== 'WAVE' || header.toString('ascii', 12, 16) !== 'fmt ') throw new MlxWhisperError('AUDIO_UNSUPPORTED');
  const channels = header.readUInt16LE(22);
  const sampleRate = header.readUInt32LE(24);
  const bitsPerSample = header.readUInt16LE(34);
  if (!channels || !sampleRate || ![8, 16, 24, 32].includes(bitsPerSample)) throw new MlxWhisperError('AUDIO_UNSUPPORTED');
  const dataOffset = header.indexOf(Buffer.from('data'));
  const dataBytes = dataOffset >= 0 && dataOffset + 8 <= header.length ? Math.min(header.readUInt32LE(dataOffset + 4), Math.max(0, stat.size - dataOffset - 8)) : Math.max(0, stat.size - 44);
  const durationSeconds = dataBytes / (sampleRate * channels * (bitsPerSample / 8));
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) throw new MlxWhisperError('AUDIO_UNSUPPORTED');
  if (durationSeconds > MAX_STT_DURATION_SECONDS) throw new MlxWhisperError('AUDIO_TOO_LONG');
  return { bytes: stat.size, durationSeconds };
}

export function spawnMlxWhisperProcess(input: MlxWhisperProcessInput): Promise<MlxWhisperProcessResult> {
  return new Promise((resolve) => {
    const child = spawn(input.executablePath, [...input.args], { cwd: input.cwd, shell: false, detached: false, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let outputOverflow = false;
    let settled = false;
    let forceKillTimer: NodeJS.Timeout | undefined;
    const append = (target: 'stdout' | 'stderr', chunk: Buffer): void => {
      const remaining = input.maxOutputBytes - Buffer.byteLength(target === 'stdout' ? stdout : stderr, 'utf8');
      if (remaining <= 0) { outputOverflow = true; return; }
      const text = chunk.subarray(0, remaining).toString('utf8');
      if (target === 'stdout') stdout += text; else stderr += text;
      if (text.length < chunk.length) outputOverflow = true;
    };
    child.stdout?.on('data', (chunk: Buffer) => append('stdout', chunk));
    child.stderr?.on('data', (chunk: Buffer) => append('stderr', chunk));
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => child.kill('SIGKILL'), 250);
      settled = true;
      resolve({ exitCode: null, stdout, stderr, timedOut: true, outputOverflow });
    }, input.timeoutMs);
    child.on('error', () => {
      if (settled) return;
      clearTimeout(timer); if (forceKillTimer) clearTimeout(forceKillTimer); settled = true; resolve({ exitCode: null, stdout, stderr, timedOut: false, outputOverflow });
    });
    child.on('close', (exitCode) => {
      if (settled) return;
      clearTimeout(timer); if (forceKillTimer) clearTimeout(forceKillTimer); settled = true; resolve({ exitCode, stdout, stderr, timedOut: false, outputOverflow });
    });
  });
}

export class FileMlxResourceAdmission implements MlxResourceAdmission {
  constructor(private readonly lockPath: string = path.join(homedir(), '.local', 'state', 'brain', 'mlx-whisper.lock')) {}

  async acquire(): Promise<(() => void) | undefined> {
    try {
      mkdirSync(path.dirname(this.lockPath), { recursive: true });
      chmodSync(path.dirname(this.lockPath), 0o700);
      const fd = openSync(this.lockPath, 'wx', 0o600);
      const release = (): void => { try { closeSync(fd); unlinkSync(this.lockPath); } catch { /* best-effort cleanup; no replacement execution */ } };
      return release;
    } catch { return undefined; }
  }
}

export class MlxWhisperSpeechToTextProvider implements SpeechToTextProvider {
  readonly providerId = MLX_WHISPER_PROVIDER_ID;
  private readonly runner: MlxWhisperProcessRunner;
  private readonly now: () => string;

  constructor(private readonly options: MlxWhisperSpeechToTextOptions) {
    if (!options.executablePath || !options.modelPath || !path.isAbsolute(options.executablePath) || !path.isAbsolute(options.modelPath)) throw new MlxWhisperError('STT_UNAVAILABLE');
    this.runner = options.runner ?? spawnMlxWhisperProcess;
    this.now = options.now ?? (() => new Date().toISOString());
  }

  async transcribe(input: VoiceInputRequestV1): Promise<VoiceTranscriptV1> {
    const audioPath = this.options.resolveAudioPath?.(input.audioRef);
    if (!audioPath) throw new MlxWhisperError('STT_UNAVAILABLE');
    return this.transcribeFile(input, audioPath);
  }

  async transcribeFile(input: VoiceInputRequestV1, audioPath: string): Promise<VoiceTranscriptV1> {
    if (input.inputMode !== 'push_to_talk' || ((!this.options.runner) && (!existsSync(this.options.executablePath) || !existsSync(this.options.modelPath)))) throw new MlxWhisperError('STT_UNAVAILABLE');
    validateWavFile(audioPath);
    const release = await this.options.resourceAdmission?.acquire();
    if (!release) throw new MlxWhisperError('STT_UNAVAILABLE');
    try {
      const cwd = this.options.cwd ?? tmpdir();
      const result = await this.runner({ executablePath: this.options.executablePath, args: [audioPath, '--model', this.options.modelPath, '--output-format', 'json'], cwd, timeoutMs: this.options.timeoutMs ?? DEFAULT_STT_TIMEOUT_MS, maxOutputBytes: this.options.maxOutputBytes ?? MAX_STT_OUTPUT_BYTES });
      if (result.timedOut) throw new MlxWhisperError('STT_TIMEOUT');
      if (result.exitCode !== 0 || result.outputOverflow) throw new MlxWhisperError('STT_FAILED');
      let parsed: unknown;
      try { parsed = JSON.parse(result.stdout); } catch { throw new MlxWhisperError('STT_OUTPUT_INVALID'); }
      const text = parsed && typeof parsed === 'object' && typeof (parsed as { text?: unknown }).text === 'string' ? (parsed as { text: string }).text.trim().replace(/\s+/gu, ' ') : '';
      if (!text || text.length > 2_000) throw new MlxWhisperError('STT_OUTPUT_INVALID');
      return { schemaVersion: 1, voiceRequestId: input.voiceRequestId, sessionId: input.sessionId, providerId: this.providerId, text, transcribedAt: this.now(), ...(input.locale ? { locale: input.locale } : {}) };
    } finally { release(); }
  }
}
