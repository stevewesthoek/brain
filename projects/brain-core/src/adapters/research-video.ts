/**
 * research-video.ts
 * Adapter for the /research/video-analyze Brain Core route.
 * Brain Core spawns the Python analyze.py subprocess and streams back JSON.
 */

export interface VideoAnalysisResult {
  ok: boolean;
  title?: string;
  channel?: string;
  transcript?: string;
  human_summary?: string;
  ai_summary?: {
    topic?: string;
    speaker?: string | null;
    key_claims?: string[];
    evidence_type?: string;
    confidence?: string;
    research_hooks?: string[];
  };
  mind_path?: string;
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
