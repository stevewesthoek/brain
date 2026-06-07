import { execFile } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type { ScenePlan } from './aws-video-generation-types.js';

const execFileAsync = promisify(execFile);

const INTERNAL_TERM_PATTERN = /\b(AWS|Bedrock|Nova|Polly|FFmpeg|pipeline|fixture)\b/i;
const PROMPT_COMMAND_PATTERN = /^\s*(please\s+)?(make|create|generate|produce)\s+(?:a\s+)?(?:short\s+)?video\s+(?:about|of|for|showing|where)\s+/i;

export type OverlayCardType = 'intro' | 'scene' | 'end';

export interface OverlayCard {
  type: OverlayCardType;
  text: string;
  durationSeconds: number;
  sceneIndex?: number;
  imageKey?: string;
}

export interface OverlayPlan {
  jobId: string;
  provider: 'deterministic-overlay';
  createdAt: string;
  mode: 'hybrid_image_slideshow';
  title: string;
  style: {
    position: 'lower-third';
    safeMargin: number;
    fontSize: number;
    titleFontSize: number;
  };
  cards: OverlayCard[];
  warnings: string[];
}

export interface OverlayRenderScene {
  index: number;
  imagePath: string;
  imageKey: string;
  durationSeconds: number;
}

export interface OverlayRenderResult {
  provider: 'deterministic-overlay';
  plan: OverlayPlan;
  overlayPlanKey: string;
  frameKeys: string[];
  framePaths: string[];
}

export function containsInternalOverlayTerms(value: unknown): boolean {
  if (typeof value === 'string') return INTERNAL_TERM_PATTERN.test(value);
  if (Array.isArray(value)) return value.some((item) => containsInternalOverlayTerms(item));
  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).some((item) => containsInternalOverlayTerms(item));
  }
  return false;
}

export function sanitizeOverlayText(input: string | null | undefined, fallback = 'A closer look'): string {
  const cleaned = (input ?? '')
    .replace(PROMPT_COMMAND_PATTERN, '')
    .replace(/\b(?:AWS|Bedrock|Nova|Polly|FFmpeg|pipeline|fixture)\b/gi, '')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.!?;:])/g, '$1')
    .trim()
    .replace(/^[.!,;:\-\s]+/, '')
    .replace(/[.!,;:\-\s]+$/, '');

  return cleaned.length > 0 ? cleaned : fallback;
}

export function wrapOverlayText(input: string, maxCharsPerLine = 30, maxLines = 3): string[] {
  const words = input.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = word.length > maxCharsPerLine ? `${word.slice(0, Math.max(1, maxCharsPerLine - 1))}…` : word;
    if (lines.length >= maxLines) break;
  }
  if (current && lines.length < maxLines) lines.push(current);

  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    const last = lines[maxLines - 1] ?? '';
    lines[maxLines - 1] = last.length >= maxCharsPerLine
      ? `${last.slice(0, Math.max(1, maxCharsPerLine - 1))}…`
      : `${last}…`;
  }

  return lines.length > 0 ? lines : [sanitizeOverlayText(null)];
}

export function buildOverlayPlan(input: {
  jobId: string;
  scenePlan: ScenePlan;
  sceneImageKeys: string[];
  title?: string | null;
  createdAt?: string;
}): OverlayPlan {
  const title = sanitizeOverlayText(input.title ?? input.scenePlan.title, 'Story highlights');
  const warnings: string[] = [];
  const cards: OverlayCard[] = [
    {
      type: 'intro',
      text: title,
      durationSeconds: 3,
    },
  ];

  input.scenePlan.scenes.forEach((scene, index) => {
    const rawText = scene.onScreenText || scene.narrationText || scene.visualPrompt;
    const text = sanitizeOverlayText(rawText, `Scene ${index + 1}`);
    cards.push({
      type: 'scene',
      sceneIndex: index + 1,
      text,
      imageKey: input.sceneImageKeys[index] ?? `jobs/${input.jobId}/images/scene-${String(index + 1).padStart(3, '0')}.png`,
      durationSeconds: Math.max(1, scene.durationSeconds),
    });
  });

  cards.push({
    type: 'end',
    text: 'Thanks for watching',
    durationSeconds: 3,
  });

  const plan: OverlayPlan = {
    jobId: input.jobId,
    provider: 'deterministic-overlay',
    createdAt: input.createdAt ?? new Date().toISOString(),
    mode: 'hybrid_image_slideshow',
    title,
    style: {
      position: 'lower-third',
      safeMargin: 64,
      fontSize: 44,
      titleFontSize: 58,
    },
    cards,
    warnings,
  };

  if (containsInternalOverlayTerms(plan)) {
    warnings.push('Overlay plan contains internal implementation terms and must be reviewed.');
  }

  return plan;
}

export class DeterministicOverlayProvider {
  readonly name = 'deterministic-overlay';

  async renderOverlayFrames(input: {
    jobId: string;
    framesDir: string;
    scenePlan: ScenePlan;
    scenes: OverlayRenderScene[];
    title?: string | null;
  }): Promise<OverlayRenderResult> {
    const ffmpegPath = await this.requireExecutable('ffmpeg', 'overlay_render_not_available');
    const plan = buildOverlayPlan({
      jobId: input.jobId,
      scenePlan: input.scenePlan,
      sceneImageKeys: input.scenes.map((scene) => scene.imageKey),
      ...(input.title !== undefined ? { title: input.title } : {}),
    });
    const tempDir = await mkdtemp(join(tmpdir(), 'brain-core-overlay-'));
    const framePaths: string[] = [];
    const frameKeys: string[] = [];

    try {
      for (const scene of input.scenes) {
        const card = plan.cards.find((item) => item.type === 'scene' && item.sceneIndex === scene.index);
        const text = card?.text ?? `Scene ${scene.index}`;
        const lines = wrapOverlayText(text, 32, 3);
        const textPath = join(tempDir, `overlay-${String(scene.index).padStart(3, '0')}.txt`);
        await writeFile(textPath, lines.join('\n'), 'utf-8');

        const frameName = `frame-${String(scene.index).padStart(3, '0')}.png`;
        const outputPath = join(input.framesDir, frameName);
        const outputKey = `jobs/${input.jobId}/frames/${frameName}`;
        const lineCount = Math.max(1, lines.length);
        const fontSize = plan.style.fontSize;
        const lineHeight = Math.round(fontSize * 1.24);
        const boxHeight = lineCount * lineHeight + 44;
        const y = `h-${plan.style.safeMargin}-${boxHeight}`;
        const baseFrameFilter = 'scale=1280:720:force_original_aspect_ratio=increase,crop=1280:720';
        const drawTextFilter = [
          baseFrameFilter,
          `drawtext=textfile='${this.escapeFilterPath(textPath)}':fontcolor=white:fontsize=${fontSize}:line_spacing=8:x=${plan.style.safeMargin}:y=${y}:box=1:boxcolor=black@0.58:boxborderw=24:shadowcolor=black@0.85:shadowx=3:shadowy=3`,
        ].join(',');

        try {
          await execFileAsync(ffmpegPath, [
            '-y',
            '-i', scene.imagePath,
            '-vf', drawTextFilter,
            '-frames:v', '1',
            outputPath,
          ], { timeout: 30_000 });
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error ?? '');
          if (!/No such filter:\s*'drawtext'|Filter not found/i.test(message)) {
            throw error;
          }
          if (!plan.warnings.includes('FFmpeg drawtext filter unavailable; overlay frames use generated images without baked text.')) {
            plan.warnings.push('FFmpeg drawtext filter unavailable; overlay frames use generated images without baked text.');
          }
          await execFileAsync(ffmpegPath, [
            '-y',
            '-i', scene.imagePath,
            '-vf', baseFrameFilter,
            '-frames:v', '1',
            outputPath,
          ], { timeout: 30_000 });
        }

        framePaths.push(outputPath);
        frameKeys.push(outputKey);
      }
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }

    return {
      provider: this.name,
      plan,
      overlayPlanKey: `jobs/${input.jobId}/metadata/overlay-plan.json`,
      frameKeys,
      framePaths,
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

  private escapeFilterPath(path: string): string {
    return path.replace(/\\/g, '\\\\').replace(/:/g, '\\:').replace(/'/g, "\\'");
  }
}
