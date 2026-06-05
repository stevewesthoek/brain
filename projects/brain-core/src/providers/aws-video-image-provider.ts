import { createHash } from 'node:crypto';
import type {
  AwsVideoImageProviderName,
  SceneImageProvider,
  SceneImageProviderInput,
  SceneImageProviderOutput,
} from './aws-video-storyboard-types.js';

export const DEFAULT_NOVA_CANVAS_MODEL_ID = 'amazon.nova-canvas-v1:0';
export const DEFAULT_TITAN_IMAGE_MODEL_ID = 'amazon.titan-image-generator-v2:0';

export type ImageProviderFailureCode = 'image_provider_not_configured' | 'image_generation_failed';

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

    throw new ImageProviderError(
      'image_generation_failed',
      `AWS Bedrock image generation provider ${this.name} is wired but disabled until the model request contract and account access are confirmed.`,
      {
        provider: this.name,
        modelId: this.modelId,
        bedrockRegion: this.bedrockRegion,
        bucket: input.bucket,
        outputKey: input.outputKey,
        promptHash: promptHash(input),
      },
    );
  }
}
