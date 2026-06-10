export type GenerationMode = 'fixture' | 'hybrid' | 'hybrid_tts' | 'hybrid_storyboard' | 'hybrid_slideshow' | 'hybrid_image_slideshow' | 'hybrid_animated_video' | 'ai';
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

export interface Storyboard {
  jobId: string;
  provider: string;
  createdAt: string;
  scenes: Array<{
    index: number;
    visualPrompt: string;
    imageKey: string;
    durationSeconds: number;
    narrationText: string;
    onScreenText?: string;
  }>;
}

export interface GenerationManifest {
  jobId: string;
  generationMode: 'fixture_assembly' | 'hybrid_scene_plan_fixture_media' | 'hybrid_tts_fixture_video' | 'hybrid_storyboard_fixture_video' | 'hybrid_slideshow_video' | 'hybrid_image_slideshow_video' | 'hybrid_animated_video' | 'ai_generation';
  mediaSource: 'fixture' | 'hybrid' | 'ai';
  aiGenerated: boolean;
  partialAiGenerated?: boolean;
  ttsGenerated?: boolean;
  storyboardGenerated?: boolean;
  imageGenerated?: boolean;
  slideshowGenerated?: boolean;
  overlayGenerated?: boolean;
  scenePlanKey?: string;
  narrationScriptKey?: string;
  narrationAudioKey?: string;
  audioKey?: string;
  audioSourceKey?: string;
  audioProvider?: string;
  voiceId?: string;
  storyboardKey?: string;
  sceneImageKeys?: string[];
  imageProvider?: string;
  imageModelId?: string;
  overlayProvider?: string;
  overlayPlanKey?: string;
  overlayFrameKeys?: string[];
  sourceVideoKey?: string;
  videoSourceKey?: string;
  finalVideoKey?: string;
  thumbnailKey?: string;
  providers: {
    scenePlan?: string;
    narrationScript?: string;
    narrationAudio?: string;
    sceneImages?: string;
    video?: string;
  };
  warnings: string[];
  createdAt: string;
  updatedAt: string;
}
