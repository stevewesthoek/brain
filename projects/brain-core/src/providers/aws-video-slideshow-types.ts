export interface SlideshowSceneInput {
  index: number;
  imagePath: string;
  durationSeconds: number;
}

export interface SlideshowAssemblyInput {
  jobId: string;
  narrationPath: string;
  outputVideoPath: string;
  scenes: SlideshowSceneInput[];
}

export interface SlideshowAssemblyOutput {
  provider: string;
  outputVideoPath: string;
  sceneCount: number;
  totalDurationSeconds: number;
  ffmpegPath: string;
}
