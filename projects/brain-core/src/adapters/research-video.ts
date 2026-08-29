/** Compatibility adapter for the canonical Brain video analysis operation. */

export type { VideoAnalysisRequest, VideoAnalysisResult, VideoSource } from './video-analysis-types.js';
import type { VideoAnalysisResult } from './video-analysis-types.js';

export async function analyzeYouTubeVideo(
  baseUrl: string,
  url: string,
  focus?: string,
): Promise<VideoAnalysisResult> {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/research/video-analysis`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source: url, caller: 'api', ...(focus ? { focus } : {}) }),
  });
  return response.json() as Promise<VideoAnalysisResult>;
}
