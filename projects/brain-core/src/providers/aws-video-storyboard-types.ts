export interface StoryboardProviderInput {
  jobId: string;
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
