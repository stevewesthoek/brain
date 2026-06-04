export type GenerationMode = 'fixture' | 'hybrid' | 'hybrid_tts' | 'ai';
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
  generationMode: 'fixture_assembly' | 'hybrid_scene_plan_fixture_media' | 'hybrid_tts_fixture_video' | 'ai_generation';
  mediaSource: 'fixture' | 'hybrid' | 'ai';
  aiGenerated: boolean;
  ttsGenerated?: boolean;
  scenePlanKey?: string;
  narrationScriptKey?: string;
  narrationAudioKey?: string;
  audioKey?: string;
  audioSourceKey?: string;
  audioProvider?: string;
  voiceId?: string;
  sourceVideoKey?: string;
  videoSourceKey?: string;
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
