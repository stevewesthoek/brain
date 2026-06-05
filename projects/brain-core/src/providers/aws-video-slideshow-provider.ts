import { execFile } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import type { SlideshowAssemblyInput, SlideshowAssemblyOutput } from './aws-video-slideshow-types.js';

const execFileAsync = promisify(execFile);

export class LocalFfmpegSlideshowProvider {
  readonly name = 'local-ffmpeg-slideshow';

  async assembleSlideshow(input: SlideshowAssemblyInput): Promise<SlideshowAssemblyOutput> {
    const ffmpegPath = await this.requireExecutable('ffmpeg', 'slideshow_assembly_not_available');

    const totalDurationSeconds = input.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
    const concatFilePath = `${input.outputVideoPath}.concat.txt`;
    const lines: string[] = [];

    for (const scene of input.scenes) {
      lines.push(`file '${scene.imagePath.replace(/'/g, "'\\''")}'`);
      lines.push(`duration ${Math.max(1, scene.durationSeconds)}`);
    }
    if (input.scenes.length > 0) {
      lines.push(`file '${input.scenes[input.scenes.length - 1]!.imagePath.replace(/'/g, "'\\''")}'`);
    }

    await writeFile(concatFilePath, `${lines.join('\n')}\n`, 'utf-8');

    try {
      await execFileAsync(ffmpegPath, [
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', concatFilePath,
        '-i', input.narrationPath,
        '-vsync', 'vfr',
        '-pix_fmt', 'yuv420p',
        '-shortest',
        input.outputVideoPath,
      ], { timeout: 120_000 });
    } catch (err) {
      throw new Error(`slideshow_assembly_failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return {
      provider: this.name,
      outputVideoPath: input.outputVideoPath,
      sceneCount: input.scenes.length,
      totalDurationSeconds,
      ffmpegPath,
    };
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
