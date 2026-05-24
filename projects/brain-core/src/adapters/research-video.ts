/**
 * research-video.ts
 * Adapter for the /research/video-analyze Brain Core route.
 * Brain Core spawns the Python analyze.py subprocess and streams back JSON.
 */

export interface VideoAnalysisResult {
  ok: boolean;
  video_id?: string;
  title?: string;
  duration_seconds?: number;
  transcript?: string;
  frame_count?: number;
  frames_analyzed?: number;
  frames_escalated?: number;
  human_summary?: string;
  ai_summary?: string;
  chapters?: Array<{ title: string; start_time: number; end_time?: number }>;
  frame_analyses?: Array<{
    timestamp: number;
    frame_type: string;
    description: string;
    escalated: boolean;
    error?: string;
  }>;
  error?: string;
  step?: string;
}

export async function analyzeYouTubeVideo(
  baseUrl: string,
  url: string,
  focus?: string,
): Promise<VideoAnalysisResult> {
  const endpoint = `${baseUrl.replace(/\/+$/, '')}/research/video-analyze`;
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, ...(focus ? { focus } : {}) }),
  });
  return response.json() as Promise<VideoAnalysisResult>;
}
