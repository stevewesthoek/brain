import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { MlxWhisperError, FileMlxResourceAdmission, MlxWhisperSpeechToTextProvider, MAX_STT_AUDIO_BYTES } from '../../../../../../brain-core/src/agent-mode/mlx-whisper-speech-to-text';
import type { VoiceInputRequestV1 } from '../../../../../../brain-core/src/agent-mode/jarvis-voice-gateway';
import { admitOperatorMutation } from '@/lib/operator-control-server';

export const dynamic = 'force-dynamic';
const MAX_UPLOAD_BYTES = MAX_STT_AUDIO_BYTES;
const voiceRequestIdSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u);

function errorResponse(code: string, status = 400): NextResponse {
  return NextResponse.json({ ok: false, error: { code, message: 'Local speech transcription is unavailable.' } }, { status, headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
}

function mapError(error: unknown): { code: string; status: number } {
  if (error instanceof MlxWhisperError) return { code: error.reasonCode, status: error.reasonCode === 'STT_UNAVAILABLE' ? 503 : 422 };
  return { code: 'STT_FAILED', status: 503 };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const admission = admitOperatorMutation(request);
  if (!admission.ok) return admission.response;
  const contentLength = request.headers.get('content-length');
  if (contentLength && (!/^\d+$/u.test(contentLength) || Number(contentLength) > MAX_UPLOAD_BYTES + 4_096)) return errorResponse('AUDIO_TOO_LARGE', 413);
  let form: FormData;
  try { form = await request.formData(); } catch { return errorResponse('AUDIO_UNSUPPORTED'); }
  const file = form.get('audio');
  const voiceRequestId = voiceRequestIdSchema.safeParse(form.get('voiceRequestId'));
  if (!(file instanceof File) || !voiceRequestId.success || file.size <= 0 || file.size > MAX_UPLOAD_BYTES || file.type !== 'audio/wav') return errorResponse('AUDIO_UNSUPPORTED', 422);
  const executablePath = process.env.BRAIN_MLX_WHISPER_EXECUTABLE;
  const modelPath = process.env.BRAIN_MLX_WHISPER_MODEL;
  const lockPath = process.env.BRAIN_MLX_WHISPER_RESOURCE_LOCK;
  if (!executablePath || !modelPath || !lockPath) return errorResponse('STT_UNAVAILABLE', 503);
  const dir = mkdtempSync(path.join(tmpdir(), 'brain-jarvis-voice-'));
  const audioPath = path.join(dir, `${randomUUID()}.wav`);
  try {
    writeFileSync(audioPath, Buffer.from(await file.arrayBuffer()), { mode: 0o600, flag: 'wx' });
    const input: VoiceInputRequestV1 = { schemaVersion: 1, voiceRequestId: voiceRequestId.data, sessionId: `operator:${admission.session.operatorId}`, inputMode: 'push_to_talk', audioRef: `voice-upload://${voiceRequestId.data}`, capturedAt: new Date().toISOString() };
    const provider = new MlxWhisperSpeechToTextProvider({ executablePath, modelPath, resourceAdmission: new FileMlxResourceAdmission(lockPath) });
    const transcript = await provider.transcribeFile(input, audioPath);
    return NextResponse.json({ ok: true, voiceRequestId: transcript.voiceRequestId, transcript: transcript.text, providerId: transcript.providerId }, { headers: { 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' } });
  } catch (error) {
    const mapped = mapError(error);
    return errorResponse(mapped.code, mapped.status);
  } finally { rmSync(dir, { recursive: true, force: true }); }
}
