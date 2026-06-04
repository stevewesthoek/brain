import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { TTSProvider, TTSProviderInput, TTSProviderOutput } from './aws-video-tts-types.js';

const execFileAsync = promisify(execFile);

export class PollyTTSProvider implements TTSProvider {
  readonly name = 'aws-polly';

  async synthesizeNarration(input: TTSProviderInput): Promise<TTSProviderOutput> {
    const {
      jobId,
      text,
      voiceId = 'Joanna',
      bucket,
      region,
      outputKey,
    } = input;

    if (!text || text.trim().length === 0) {
      throw new Error('Cannot synthesize narration: text is empty');
    }

    const tmpPath = join(tmpdir(), `polly-${jobId}-${Date.now()}.mp3`);
    const generatedAt = new Date().toISOString();

    try {
      // Synthesize audio using AWS Polly
      await execFileAsync('aws', [
        'polly', 'synthesize-speech',
        '--text', text,
        '--output-format', 'mp3',
        '--voice-id', voiceId,
        '--region', region,
        '--no-cli-pager',
        tmpPath,
      ], { timeout: 30_000 });

      // Upload to S3
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
      // Clean up temporary file
      try {
        await unlink(tmpPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  }
}
