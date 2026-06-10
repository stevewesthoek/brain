export interface SlideshowSceneInput {
  index: number;
  /**
   * Local media source for this scene. This can be a still image or a pre-rendered video clip.
   */
  mediaPath?: string;
  /**
   * Backward-compatible alias for older slideshow/image callers.
   */
  imagePath?: string;
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
