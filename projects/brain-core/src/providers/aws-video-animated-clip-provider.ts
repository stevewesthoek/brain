import { execFile } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import type { AnimatedClipProvider, AnimatedClipProviderInput } from './aws-video-generation-types.js';

const execFileAsync = promisify(execFile);

export class LocalFfmpegAnimatedClipProvider implements AnimatedClipProvider {
  readonly name = 'local-ffmpeg-animated-placeholder';

  async generateClip(input: AnimatedClipProviderInput): Promise<{ clipPath: string }> {
    const ffmpegPath = await this.requireExecutable('ffmpeg', 'animated_clip_generation_not_available');
    await mkdir(dirname(input.outputClipPath), { recursive: true });

    const safeDuration = Math.max(2, Math.round(input.durationSeconds));
    const frames = Math.max(60, safeDuration * 30);
    const zoomTarget = 1.10 + (input.sceneIndex % 4) * 0.01;
    const centerX = '(iw-iw/zoom)/2';
    const centerY = '(ih-ih/zoom)/2';
    const filter = `zoompan=z='1.0+(${zoomTarget - 1.0})*on/${frames}':x='${centerX}':y='${centerY}':d=${frames}:s=${input.width}x${input.height}:fps=30,format=yuv420p`;

    await execFileAsync(ffmpegPath, [
      '-y',
      '-loop', '1',
      '-i', input.imagePath,
      '-t', String(safeDuration),
      '-vf', filter,
      '-an',
      input.outputClipPath,
    ], { timeout: 120_000 });

    return { clipPath: input.outputClipPath };
  }

  private async requireExecutable(name: string, code: string): Promise<string> {
    try {
      const resolved = (await execFileAsync('bash', ['-lc', `command -v ${name}`], { timeout: 10_000 })).stdout.trim();
      if (!resolved) throw new Error('not found');
      return resolved;
    } catch {
      throw new Error(code);
    }
  }
}
