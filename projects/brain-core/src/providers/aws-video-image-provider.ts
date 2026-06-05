import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import type {
  AwsVideoImageProviderName,
  SceneImageProvider,
  SceneImageProviderInput,
  SceneImageProviderOutput,
} from './aws-video-storyboard-types.js';

export const DEFAULT_NOVA_CANVAS_MODEL_ID = 'amazon.nova-canvas-v1:0';
export const DEFAULT_TITAN_IMAGE_MODEL_ID = 'amazon.titan-image-generator-v2:0';

export type ImageProviderFailureCode = 'image_provider_not_configured' | 'image_generation_failed';

const execFileAsync = promisify(execFile);

export class ImageProviderError extends Error {
  readonly code: ImageProviderFailureCode;
  readonly details: Record<string, unknown>;

  constructor(code: ImageProviderFailureCode, message: string, details: Record<string, unknown> = {}) {
    super(message);
    this.name = 'ImageProviderError';
    this.code = code;
    this.details = details;
  }
}

export function getConfiguredImageProvider(): AwsVideoImageProviderName | null {
  const provider = process.env.AWS_VIDEO_IMAGE_PROVIDER;
  if (
    provider === 'deterministic-placeholder'
    || provider === 'aws-bedrock-nova-canvas'
    || provider === 'aws-bedrock-titan-image'
  ) {
    return provider;
  }
  return null;
}

export function getDefaultImageModelId(provider: AwsVideoImageProviderName): string | undefined {
  if (provider === 'aws-bedrock-nova-canvas') return DEFAULT_NOVA_CANVAS_MODEL_ID;
  if (provider === 'aws-bedrock-titan-image') return DEFAULT_TITAN_IMAGE_MODEL_ID;
  return undefined;
}

export function promptHash(input: Pick<SceneImageProviderInput, 'visualPrompt' | 'narrationText' | 'onScreenText'>): string {
  return createHash('sha256')
    .update(input.visualPrompt)
    .update('\n')
    .update(input.narrationText)
    .update('\n')
    .update(input.onScreenText ?? '')
    .digest('hex')
    .slice(0, 16);
}

export class AwsBedrockImageProvider implements SceneImageProvider {
  readonly name: AwsVideoImageProviderName;
  readonly modelId: string;
  readonly bedrockRegion: string;

  constructor(providerName: Exclude<AwsVideoImageProviderName, 'deterministic-placeholder'>) {
    this.name = providerName;
    this.modelId = process.env.AWS_VIDEO_IMAGE_MODEL_ID || getDefaultImageModelId(providerName) || '';
    this.bedrockRegion = process.env.AWS_VIDEO_IMAGE_REGION || process.env.AWS_REGION || 'us-east-1';
  }

  async generateSceneImage(input: SceneImageProviderInput): Promise<SceneImageProviderOutput> {
    if (this.name !== 'aws-bedrock-nova-canvas') {
      throw new ImageProviderError(
        'image_generation_failed',
        `AWS Bedrock image provider ${this.name} is not enabled. Verified runtime support is currently limited to aws-bedrock-nova-canvas in us-east-1.`,
        {
          provider: this.name,
          modelId: this.modelId,
          bedrockRegion: this.bedrockRegion,
          outputKey: input.outputKey,
        },
      );
    }

    const required = [
      ['AWS_VIDEO_IMAGE_PROVIDER', process.env.AWS_VIDEO_IMAGE_PROVIDER],
      ['AWS_VIDEO_IMAGE_MODEL_ID', process.env.AWS_VIDEO_IMAGE_MODEL_ID],
      ['AWS_VIDEO_IMAGE_REGION', process.env.AWS_VIDEO_IMAGE_REGION],
    ].filter(([, value]) => !value).map(([name]) => name);

    if (required.length > 0) {
      throw new ImageProviderError(
        'image_provider_not_configured',
        `AWS Bedrock image generation is not configured for ${this.name}. Missing env: ${required.join(', ')}.`,
        {
          provider: this.name,
          modelId: this.modelId,
          bedrockRegion: this.bedrockRegion,
          missingEnv: required,
          outputKey: input.outputKey,
        },
      );
    }

    if (this.modelId !== DEFAULT_NOVA_CANVAS_MODEL_ID) {
      throw new ImageProviderError(
        'image_provider_not_configured',
        `Unsupported Nova Canvas model ID: ${this.modelId}. Verified model ID is ${DEFAULT_NOVA_CANVAS_MODEL_ID}.`,
        {
          provider: this.name,
          modelId: this.modelId,
          bedrockRegion: this.bedrockRegion,
          outputKey: input.outputKey,
        },
      );
    }

    if (this.bedrockRegion !== 'us-east-1') {
      throw new ImageProviderError(
        'image_provider_not_configured',
        `Unsupported Nova Canvas region: ${this.bedrockRegion}. Verified Bedrock image generation region is us-east-1.`,
        {
          provider: this.name,
          modelId: this.modelId,
          bedrockRegion: this.bedrockRegion,
          outputKey: input.outputKey,
        },
      );
    }

    const tempDir = await mkdtemp(join(tmpdir(), 'brain-bedrock-image-'));
    const requestPath = join(tempDir, 'request.json');
    const responsePath = join(tempDir, 'response.json');
    const imagePath = join(tempDir, 'scene.png');
    const hash = promptHash(input);

    try {
      const body = {
        taskType: 'TEXT_IMAGE',
        textToImageParams: {
          text: input.visualPrompt,
        },
        imageGenerationConfig: {
          numberOfImages: 1,
          height: input.height,
          width: input.width,
          cfgScale: 6.5,
          seed: parseInt(hash.slice(0, 8), 16) % 2_147_483_647,
        },
      };

      await writeFile(requestPath, JSON.stringify(body), 'utf-8');
      await execFileAsync('aws', [
        'bedrock-runtime',
        'invoke-model',
        '--region', this.bedrockRegion,
        '--model-id', this.modelId,
        '--content-type', 'application/json',
        '--accept', 'application/json',
        '--body', `fileb://${requestPath}`,
        responsePath,
        '--cli-binary-format', 'raw-in-base64-out',
        '--no-cli-pager',
      ], { timeout: 180_000 });

      const response = JSON.parse(await readFile(responsePath, 'utf-8')) as { images?: string[] };
      const imageBase64 = response.images?.[0];
      if (!imageBase64) {
        throw new ImageProviderError(
          'image_generation_failed',
          'Nova Canvas response did not include images[0].',
          {
            provider: this.name,
            modelId: this.modelId,
            bedrockRegion: this.bedrockRegion,
            outputKey: input.outputKey,
          },
        );
      }

      await writeFile(imagePath, Buffer.from(imageBase64, 'base64'));
      await execFileAsync('aws', [
        's3',
        'cp',
        imagePath,
        `s3://${input.bucket}/${input.outputKey}`,
        '--region', input.region,
        '--no-cli-pager',
        '--content-type', 'image/png',
      ], { timeout: 60_000 });

      return {
        imageKey: input.outputKey,
        providerName: this.name,
        modelId: this.modelId,
        generatedAt: new Date().toISOString(),
        promptHash: hash,
      };
    } catch (error) {
      if (error instanceof ImageProviderError) throw error;
      throw new ImageProviderError(
        'image_generation_failed',
        `Nova Canvas image generation failed: ${error instanceof Error ? error.message : String(error)}`,
        {
          provider: this.name,
          modelId: this.modelId,
          bedrockRegion: this.bedrockRegion,
          outputKey: input.outputKey,
          promptHash: hash,
        },
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
