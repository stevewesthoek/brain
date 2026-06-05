export interface StoryboardProviderInput {
  jobId: string;
  index: number;
  visualPrompt: string;
  narrationText: string;
  onScreenText: string | undefined;
  durationSeconds: number;
}

export interface StoryboardProviderOutput {
  imageKey: string;
  imageUrl?: string;
  providerName: string;
}

export type AwsVideoImageProviderName =
  | 'deterministic-placeholder'
  | 'aws-bedrock-nova-canvas'
  | 'aws-bedrock-titan-image';

export interface SceneImageProviderInput {
  jobId: string;
  sceneIndex: number;
  visualPrompt: string;
  narrationText: string;
  onScreenText?: string;
  width: number;
  height: number;
  outputKey: string;
  bucket: string;
  region: string;
}

export interface SceneImageProviderOutput {
  imageKey: string;
  providerName: AwsVideoImageProviderName;
  modelId?: string;
  generatedAt: string;
  promptHash?: string;
}

export interface SceneImageProvider {
  name: AwsVideoImageProviderName;
  generateSceneImage(input: SceneImageProviderInput): Promise<SceneImageProviderOutput>;
}
