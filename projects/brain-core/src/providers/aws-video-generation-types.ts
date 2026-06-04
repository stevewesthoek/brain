export type GenerationMode = 'fixture' | 'hybrid' | 'ai';
export type MediaSource = 'fixture' | 'hybrid' | 'ai';

export interface ScenePlanScene {
  index: number;
  durationSeconds: number;
  visualPrompt: string;
  narrationText: string;
  onScreenText?: string;
}

export interface ScenePlan {
  jobId: string;
  prompt: string;
  title: string;
  targetDurationSeconds: number;
  scenes: ScenePlanScene[];
  createdAt: string;
  providerName: string;
  deterministic: boolean;
}

export interface GenerationManifest {
  jobId: string;
  generationMode: 'fixture_assembly' | 'hybrid_scene_plan_fixture_media' | 'ai_generation';
  mediaSource: 'fixture' | 'hybrid' | 'ai';
  aiGenerated: boolean;
  scenePlanKey?: string;
  narrationScriptKey?: string;
  narrationAudioKey?: string;
  sourceVideoKey?: string;
  finalVideoKey?: string;
  thumbnailKey?: string;
  providers: {
    scenePlan?: string;
    narrationScript?: string;
    narrationAudio?: string;
    video?: string;
  };
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}
