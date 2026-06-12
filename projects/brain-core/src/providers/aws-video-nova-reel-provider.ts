import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { promisify } from 'node:util';
import type { ScenePlan } from './aws-video-generation-types.js';

const execFileAsync = promisify(execFile);

export interface BedrockNovaReelVideoProviderInput {
  jobId: string;
  scenePlan: ScenePlan;
  outputVideoPath: string;
  bucket: string;
  region: string;
  outputPrefix: string;
  prompt?: string;
}

export interface BedrockNovaReelVideoProviderOutput {
  provider: string;
  modelId: string;
  invocationArn: string;
  status: 'Completed';
  s3OutputUri: string;
  sourceVideoKey: string;
  videoPath: string;
  durationSeconds: number;
  fps: number;
  dimension: string;
  seed: number;
  prompt: string;
}

export class BedrockNovaReelVideoProvider {
  readonly name = 'aws-bedrock-nova-reel';

  async generateVideo(input: BedrockNovaReelVideoProviderInput): Promise<BedrockNovaReelVideoProviderOutput> {
    const awsPath = await this.requireExecutable('aws');
    const modelId = process.env.AWS_VIDEO_NOVA_REEL_MODEL_ID || 'amazon.nova-reel-v1:0';
    const region = process.env.AWS_VIDEO_BEDROCK_REGION || input.region;
    const durationSeconds = this.parseDurationSeconds();
    const fps = 24;
    const dimension = '1280x720';
    const seed = this.parseSeed(input.jobId);
    const prompt = input.prompt?.trim() || this.buildPrompt(input.scenePlan);
    const s3OutputUri = `s3://${input.bucket}/${input.outputPrefix.replace(/\/$/, '')}`;
    const sourceVideoKey = `${input.outputPrefix.replace(/\/$/, '')}/output.mp4`;

    await mkdir(dirname(input.outputVideoPath), { recursive: true });
    const tempDir = await mkdtemp(join(tmpdir(), `nova-reel-${input.jobId}-`));

    try {
      const modelInputPath = join(tempDir, 'model-input.json');
      const outputConfigPath = join(tempDir, 'output-config.json');
      await writeFile(modelInputPath, JSON.stringify({
        taskType: 'TEXT_VIDEO',
        textToVideoParams: { text: prompt },
        videoGenerationConfig: {
          fps,
          durationSeconds,
          dimension,
          seed,
        },
      }, null, 2), 'utf-8');
      await writeFile(outputConfigPath, JSON.stringify({
        s3OutputDataConfig: { s3Uri: s3OutputUri },
      }, null, 2), 'utf-8');

      const start = await execFileAsync(awsPath, [
        'bedrock-runtime', 'start-async-invoke',
        '--model-id', modelId,
        '--model-input', `file://${modelInputPath}`,
        '--output-data-config', `file://${outputConfigPath}`,
        '--region', region,
        '--query', 'invocationArn',
        '--output', 'text',
        '--no-cli-pager',
      ], { timeout: 30_000 });
      const invocationArn = start.stdout.trim();
      if (!invocationArn) throw new Error('nova_reel_missing_invocation_arn');

      const completed = await this.waitForCompletion(awsPath, invocationArn, region);
      const completedOutputUri = this.readS3OutputUri(completed) || s3OutputUri;
      const completedVideoKey = `${completedOutputUri.replace(/^s3:\/\/[^/]+\//, '').replace(/\/$/, '')}/output.mp4`;

      await execFileAsync(awsPath, [
        's3', 'cp',
        `s3://${input.bucket}/${completedVideoKey}`,
        input.outputVideoPath,
        '--region', input.region,
        '--no-cli-pager',
      ], { timeout: 120_000 });

      return {
        provider: this.name,
        modelId,
        invocationArn,
        status: 'Completed',
        s3OutputUri: completedOutputUri,
        sourceVideoKey: completedVideoKey || sourceVideoKey,
        videoPath: input.outputVideoPath,
        durationSeconds,
        fps,
        dimension,
        seed,
        prompt,
      };
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }

  private buildPrompt(scenePlan: ScenePlan): string {
    const title = scenePlan.title || scenePlan.prompt || 'Cinematic short video';
    const sceneBeats = scenePlan.scenes
      .map(scene => `Scene ${scene.index + 1}: ${scene.visualPrompt}. Narration intent: ${scene.narrationText}`)
      .join('\n');
    return [
      `Create a cinematic, realistic HD video titled: ${title}`,
      'Use real motion, camera movement, temporal continuity, natural lighting, and coherent subject identity across shots.',
      'Avoid text overlays, captions, watermarks, logos, or UI elements inside the video image.',
      sceneBeats,
    ].join('\n\n').slice(0, 4000);
  }

  private async waitForCompletion(awsPath: string, invocationArn: string, region: string): Promise<Record<string, unknown>> {
    const pollSeconds = Number(process.env.AWS_VIDEO_NOVA_REEL_POLL_SECONDS || 15);
    const timeoutSeconds = Number(process.env.AWS_VIDEO_NOVA_REEL_TIMEOUT_SECONDS || 1500);
    const startedAt = Date.now();

    while (Date.now() - startedAt < timeoutSeconds * 1000) {
      const statusResult = await execFileAsync(awsPath, [
        'bedrock-runtime', 'get-async-invoke',
        '--invocation-arn', invocationArn,
        '--region', region,
        '--output', 'json',
        '--no-cli-pager',
      ], { timeout: 30_000 });
      const parsed = JSON.parse(statusResult.stdout) as Record<string, unknown>;
      const status = String(parsed.status ?? parsed.Status ?? '');
      if (status === 'Completed') return parsed;
      if (status === 'Failed') {
        const failureMessage = String(parsed.failureMessage ?? parsed.FailureMessage ?? 'Nova Reel async invocation failed');
        throw new Error(`nova_reel_failed: ${failureMessage}`);
      }
      await new Promise(resolve => setTimeout(resolve, pollSeconds * 1000));
    }

    throw new Error(`nova_reel_timeout: ${invocationArn}`);
  }

  private readS3OutputUri(response: Record<string, unknown>): string | null {
    const outputDataConfig = response.outputDataConfig as Record<string, unknown> | undefined;
    const s3OutputDataConfig = outputDataConfig?.s3OutputDataConfig as Record<string, unknown> | undefined;
    const s3Uri = s3OutputDataConfig?.s3Uri;
    return typeof s3Uri === 'string' && s3Uri.length > 0 ? s3Uri : null;
  }

  private parseDurationSeconds(): number {
    const configured = Number(process.env.AWS_VIDEO_NOVA_REEL_DURATION_SECONDS || 6);
    return Number.isFinite(configured) ? Math.min(120, Math.max(6, Math.round(configured / 6) * 6)) : 6;
  }

  private parseSeed(jobId: string): number {
    const configured = Number(process.env.AWS_VIDEO_NOVA_REEL_SEED || '');
    if (Number.isFinite(configured) && configured >= 0) return Math.min(2147483646, Math.floor(configured));
    let hash = 0;
    for (const char of jobId) hash = ((hash * 31) + char.charCodeAt(0)) >>> 0;
    return hash % 2147483646;
  }

  private async requireExecutable(name: string): Promise<string> {
    try {
      const resolved = (await execFileAsync('bash', ['-lc', `command -v ${name}`], { timeout: 10_000 })).stdout.trim();
      if (!resolved) throw new Error('not found');
      return resolved;
    } catch {
      throw new Error(`${name}_not_available`);
    }
  }
}
