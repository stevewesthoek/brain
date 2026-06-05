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
export const DEFAULT_IMAGE_WIDTH = 1280;
export const DEFAULT_IMAGE_HEIGHT = 720;
export const DEFAULT_IMAGE_CFG_SCALE = 6.5;
export const DEFAULT_IMAGE_SEED = 42;
export const DEFAULT_IMAGE_QUALITY = 'standard';

export type ImageProviderFailureCode = 'image_provider_not_configured' | 'image_provider_invalid_config' | 'image_generation_failed';

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

export function parseImageWidth(): number {
  return Number(process.env.AWS_VIDEO_IMAGE_WIDTH ?? DEFAULT_IMAGE_WIDTH);
}

export function parseImageHeight(): number {
  return Number(process.env.AWS_VIDEO_IMAGE_HEIGHT ?? DEFAULT_IMAGE_HEIGHT);
}

export function parseImageCfgScale(): number {
  return Number(process.env.AWS_VIDEO_IMAGE_CFG_SCALE ?? DEFAULT_IMAGE_CFG_SCALE);
}

export function parseImageQuality(): string {
  return process.env.AWS_VIDEO_IMAGE_QUALITY || DEFAULT_IMAGE_QUALITY;
}

export function parseImageSeed(): number {
  const configuredSeed = process.env.AWS_VIDEO_IMAGE_SEED;
  if (configuredSeed && configuredSeed !== 'deterministic') {
    const parsed = Number(configuredSeed);
    if (!Number.isNaN(parsed)) return parsed;
  }
  return DEFAULT_IMAGE_SEED;
}

function validateNovaCanvasDimensions(width: number, height: number): void {
  const supported = [
    [1024, 1024],
    [1280, 720],
    [1536, 1024],
    [1792, 1024],
    [2048, 2048],
    [2816, 1536],
  ];
  const matchesSupported = supported.some(([w, h]) => w === width && h === height);
  const pixelCount = width * height;
  if (!matchesSupported || width <= 0 || height <= 0 || width > 4096 || height > 4096 || pixelCount > 4_194_304) {
    throw new ImageProviderError(
      'image_provider_invalid_config',
      `Invalid Nova Canvas dimensions ${width}x${height}. Supported generation resolutions include 1280x720 and other documented Nova Canvas generation sizes up to 4.19M pixels.`,
      {
        width,
        height,
        supported,
      },
    );
  }
}

function buildFinalImagePrompt(input: SceneImageProviderInput): { finalImagePrompt: string; negativePrompt: string } {
  const rawBase = input.visualPrompt.trim();
  const base = /\b(bab(?:y|ies)|infant|toddler|child(?:ren)?|k(?:id|ids))\b/i.test(rawBase)
    ? `${rawBase}. Show a warm symbolic nursery or family-friendly environment with soft toys, blankets, sunlight, and gentle details. Do not show identifiable people, faces, or minors.`
    : rawBase;
  const onScreenText = input.onScreenText?.trim();
  const promptParts = [
    base,
    'cinematic, family-friendly, non-violent, high detail, 16:9 composition',
    onScreenText ? `Composition should support readable on-screen text: ${onScreenText}` : null,
  ].filter((part): part is string => Boolean(part));
  return {
    finalImagePrompt: promptParts.join('. ').replace(/\s+/g, ' ').trim(),
    negativePrompt: 'text, watermark, logo, distorted faces, extra limbs, identifiable faces, identifiable minors',
  };
}

export class AwsBedrockImageProvider implements SceneImageProvider {
  readonly name: AwsVideoImageProviderName;
  readonly modelId: string;
  readonly bedrockRegion: string;
  readonly width: number;
  readonly height: number;
  readonly cfgScale: number;
  readonly quality: string;
  readonly seed: number;

  constructor(providerName: Exclude<AwsVideoImageProviderName, 'deterministic-placeholder'>) {
    this.name = providerName;
    this.modelId = process.env.AWS_VIDEO_IMAGE_MODEL_ID || getDefaultImageModelId(providerName) || '';
    this.bedrockRegion = process.env.AWS_VIDEO_IMAGE_REGION || process.env.AWS_REGION || 'us-east-1';
    this.width = parseImageWidth();
    this.height = parseImageHeight();
    this.cfgScale = parseImageCfgScale();
    this.quality = parseImageQuality();
    this.seed = parseImageSeed();
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

    if (this.quality !== 'standard' && this.quality !== 'premium') {
      throw new ImageProviderError(
        'image_provider_invalid_config',
        `Invalid Nova Canvas quality: ${this.quality}. Supported values are standard or premium.`,
        {
          provider: this.name,
          modelId: this.modelId,
          bedrockRegion: this.bedrockRegion,
          quality: this.quality,
          outputKey: input.outputKey,
        },
      );
    }

    validateNovaCanvasDimensions(input.width ?? this.width, input.height ?? this.height);

    const tempDir = await mkdtemp(join(tmpdir(), 'brain-bedrock-image-'));
    const requestPath = join(tempDir, 'request.json');
    const responsePath = join(tempDir, 'response.json');
    const imagePath = join(tempDir, 'scene.png');
    const hash = promptHash(input);
    const { finalImagePrompt, negativePrompt } = buildFinalImagePrompt(input);
    const effectiveWidth = input.width || this.width;
    const effectiveHeight = input.height || this.height;
    const effectiveSeed = this.seed + input.sceneIndex - 1;

    try {
      const body = {
        taskType: 'TEXT_IMAGE',
        textToImageParams: {
          text: finalImagePrompt,
          negativeText: negativePrompt,
        },
        imageGenerationConfig: {
          numberOfImages: 1,
          height: effectiveHeight,
          width: effectiveWidth,
          cfgScale: this.cfgScale,
          quality: this.quality,
          seed: effectiveSeed,
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
        region: this.bedrockRegion,
        width: effectiveWidth,
        height: effectiveHeight,
        seed: effectiveSeed,
        quality: this.quality,
        finalImagePrompt,
        negativePrompt,
        generatedAt: new Date().toISOString(),
        promptHash: hash,
      };
    } catch (error) {
      if (error instanceof ImageProviderError) throw error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (errorMessage.includes('ValidationException') || errorMessage.includes('unsupported') || errorMessage.includes('resolution')) {
        throw new ImageProviderError(
          'image_provider_invalid_config',
          `Nova Canvas rejected the image configuration: ${errorMessage}`,
          {
            provider: this.name,
            modelId: this.modelId,
            bedrockRegion: this.bedrockRegion,
            width: effectiveWidth,
            height: effectiveHeight,
            quality: this.quality,
            outputKey: input.outputKey,
            promptHash: hash,
          },
        );
      }
      throw new ImageProviderError(
        'image_generation_failed',
        `Nova Canvas image generation failed: ${errorMessage}`,
        {
          provider: this.name,
          modelId: this.modelId,
          bedrockRegion: this.bedrockRegion,
          width: effectiveWidth,
          height: effectiveHeight,
          quality: this.quality,
          outputKey: input.outputKey,
          promptHash: hash,
        },
      );
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  }
}
