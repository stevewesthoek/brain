import fs from 'node:fs';
import path from 'node:path';
import type { MindStewardInboxQueueItem } from './mind-steward-inbox-queue.js';
import { analyzeVideo, normalizeVideoAnalysisRequest } from './video-analysis-service.js';
import type { VideoAnalysisRequest, VideoSourceKind } from './video-analysis-types.js';

function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return !relative.startsWith('..') && !path.isAbsolute(relative);
}

const VIDEO_URL_PATTERN = /https?:\/\/[^\s<>()]+/gi;
const LOCAL_FILE_PATTERN = /(?:file:\/\/)?\/(?:[^\s`<>]|\\ )+/g;
const DIRECT_VIDEO_PATTERN = /\.(?:mp4|webm|mov|mkv|m4v|avi|flv|wmv)(?:[?#][^\s<>()]*)?$/i;

export interface DetectedMindVideoSource {
  kind: VideoSourceKind;
  uri: string;
}

/**
 * Analysis dimensions are deliberately separate from queue/caller metadata.
 * The canonical service normalizes these fields once before the Python
 * processor derives its semantic cache identity.
 */
export type MindStewardVideoAnalysisOptions = Pick<VideoAnalysisRequest,
  'focus' | 'frame_budget' | 'paid_vision_frame_budget' | 'transcript_provider' | 'allow_external_transcription'>;

export function detectVideoSourceFromCapture(capturePath: string, content?: string): DetectedMindVideoSource | null {
  if (DIRECT_VIDEO_PATTERN.test(capturePath)) return { kind: 'local-file', uri: path.resolve(capturePath) };
  const boundedContent = content ?? fs.readFileSync(capturePath, 'utf8').slice(0, 200_000);
  const urls = boundedContent.match(VIDEO_URL_PATTERN) ?? [];
  for (const raw of urls) {
    const uri = raw.replace(/[),.;]+$/, '');
    try {
      const host = new URL(uri).hostname.toLowerCase().replace(/^www\./, '');
      if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be' || host.endsWith('.youtube.com')) {
        return { kind: 'youtube-url', uri };
      }
      if (DIRECT_VIDEO_PATTERN.test(new URL(uri).pathname)) return { kind: 'remote-video-url', uri };
    } catch {
      // Continue scanning the capture for a valid source reference.
    }
  }
  const local = boundedContent.match(LOCAL_FILE_PATTERN)?.[0];
  if (local && /(?:mp4|webm|mov|mkv|m4v|avi|flv|wmv)$/i.test(local)) {
    return { kind: 'local-file', uri: path.resolve(local.replaceAll('\\ ', ' ')) };
  }
  return null;
}

export interface BuildMindStewardVideoAnalysisRequestOptions {
  mindRoot?: string;
  analysis?: MindStewardVideoAnalysisOptions;
}

export function buildMindStewardVideoAnalysisRequest(
  item: MindStewardInboxQueueItem,
  options: BuildMindStewardVideoAnalysisRequestOptions = {},
): VideoAnalysisRequest | null {
  const absoluteCapturePath = options.mindRoot ? path.resolve(options.mindRoot, item.path) : item.path;
  const source = detectVideoSourceFromCapture(absoluteCapturePath);
  if (!source) return null;

  const rawCaptureIsSafe = source.kind === 'local-file'
    && path.resolve(source.uri) === path.resolve(absoluteCapturePath)
    && (options.mindRoot ? isWithin(path.join(options.mindRoot, 'inbox', 'new'), source.uri) : false);

  return normalizeVideoAnalysisRequest({
    source: { ...source, original_capture_reference: item.path },
    caller: 'save-to-mind',
    persist_to_mind: true,
    ...(options.analysis ?? {}),
    ...(rawCaptureIsSafe ? { allow_local_file: true } : {}),
    correlation_id: item.id,
    idempotency_key: `mind-video-${item.contentSha256}`,
  });
}

export async function dispatchMindStewardVideoCapture(
  item: MindStewardInboxQueueItem,
  options: BuildMindStewardVideoAnalysisRequestOptions = {},
) {
  const request = buildMindStewardVideoAnalysisRequest(item, options);
  if (!request) return { kind: 'not-video' as const, result: null };
  const result = await analyzeVideo(request, options.mindRoot ? { mindRoot: options.mindRoot } : {});
  return { kind: 'video' as const, result };
}
