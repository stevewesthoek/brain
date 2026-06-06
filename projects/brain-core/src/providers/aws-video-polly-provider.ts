import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TTSProvider, TTSProviderInput, TTSProviderOutput } from './aws-video-tts-types.js';

const execFileAsync = promisify(execFile);

type PollyEngine = 'neural' | 'standard';

function isUnsupportedEngineError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /selected engine is not supported|engine.*not supported|ValidationException/i.test(message);
}

export class PollyTTSProvider implements TTSProvider {
  readonly name = 'aws-polly';

  async synthesizeNarration(input: TTSProviderInput): Promise<TTSProviderOutput> {
    const {
      jobId,
      text,
      voiceId = process.env.AWS_VIDEO_TTS_VOICE_ID || 'Matthew',
      bucket,
      region,
      outputKey,
    } = input;
    const preferredEngine = (process.env.AWS_VIDEO_TTS_ENGINE || 'neural') as PollyEngine;

    if (!text || text.trim().length === 0) {
      throw new Error('Cannot synthesize narration: text is empty');
    }

    const tmpPath = join(tmpdir(), `polly-${jobId}-${Date.now()}.mp3`);
    const generatedAt = new Date().toISOString();

    try {
      const synthesize = async (engine: PollyEngine): Promise<void> => {
        await execFileAsync('aws', [
          'polly', 'synthesize-speech',
          '--text', text,
          '--output-format', 'mp3',
          '--voice-id', voiceId,
          '--engine', engine,
          '--region', region,
          '--no-cli-pager',
          tmpPath,
        ], { timeout: 30_000 });
      };

      let engineUsed: PollyEngine = preferredEngine;
      try {
        await synthesize(preferredEngine);
      } catch (error) {
        if (preferredEngine !== 'standard' && isUnsupportedEngineError(error)) {
          engineUsed = 'standard';
          await synthesize('standard');
        } else {
          throw error;
        }
      }

      await execFileAsync('aws', [
        's3', 'cp',
        tmpPath,
        `s3://${bucket}/${outputKey}`,
        '--region', region,
        '--no-cli-pager',
      ], { timeout: 30_000 });

      return {
        audioKey: outputKey,
        provider: this.name,
        voiceId,
        format: 'mp3',
        generatedAt,
      };
    } finally {
      try {
        await unlink(tmpPath);
      } catch {
        // Ignore cleanup errors.
      }
    }
  }
}
