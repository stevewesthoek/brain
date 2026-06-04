export interface TTSProviderInput {
  jobId: string;
  text: string;
  voiceId?: string;
  bucket: string;
  region: string;
  outputKey: string;
}

export interface TTSProviderOutput {
  audioKey: string;
  provider: string;
  voiceId: string;
  format: string;
  generatedAt: string;
  durationSeconds?: number;
}

export interface TTSProvider {
  name: string;
  synthesizeNarration(input: TTSProviderInput): Promise<TTSProviderOutput>;
}
