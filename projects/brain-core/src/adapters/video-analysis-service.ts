import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import path from 'node:path';
import { execFileSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import type { VideoAnalysisRequest, VideoAnalysisResult, VideoSource, VideoSourceKind } from './video-analysis-types.js';
import { prepareVideoAnalysisApplyOnePreview } from './infinite-brain-writers/video-analysis-writer.js';

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url));
const PACKAGE_ROOT = path.resolve(MODULE_DIR, '..', '..');
const ANALYZER_PATH = path.join(PACKAGE_ROOT, 'services', 'video-analyzer', 'analyze.py');
const BRAIN_ROOT = path.resolve(PACKAGE_ROOT, '..', '..');

export interface VideoAnalysisServiceOptions {
  analyzerPath?: string;
  pythonPath?: string;
  timeoutMs?: number;
  spawnProcess?: typeof spawn;
  mindRoot?: string;
  sourceCommit?: string;
}

export function inferVideoSource(value: string): VideoSource {
  const trimmed = value.trim();
  if (!trimmed) throw new Error('source_uri_required');
  if (/^https?:\/\//i.test(trimmed)) {
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new Error('remote_video_url_invalid');
    }
    if (!['http:', 'https:'].includes(url.protocol) || !url.hostname) throw new Error('remote_video_url_invalid');
    const hostname = url.hostname.toLowerCase().replace(/^www\./, '');
    const kind: VideoSourceKind = hostname === 'youtube.com' || hostname === 'm.youtube.com' || hostname === 'youtu.be' || hostname.endsWith('.youtube.com')
      ? 'youtube-url'
      : 'remote-video-url';
    return { kind, uri: trimmed, provider: kind === 'youtube-url' ? 'youtube' : null, original_capture_reference: null };
  }
  return { kind: 'local-file', uri: path.resolve(trimmed), provider: null, original_capture_reference: null };
}

export type VideoAnalysisInput = Omit<Partial<VideoAnalysisRequest>, 'source' | 'caller'> & {
  source?: VideoSource | string;
  url?: string;
  path?: string;
  caller?: VideoAnalysisRequest['caller'];
};

export function normalizeVideoAnalysisRequest(input: VideoAnalysisInput): VideoAnalysisRequest {
  const rawSource = input.source ?? input.url ?? input.path;
  if (!rawSource) throw new Error('source_uri_required');
  const source = typeof rawSource === 'string' ? inferVideoSource(rawSource) : (() => {
    const inferred = inferVideoSource(rawSource.uri);
    if (rawSource.kind !== undefined && rawSource.kind !== inferred.kind) {
      throw new Error('source_kind_mismatch');
    }
    return { ...inferred, ...rawSource, kind: inferred.kind };
  })();
  return {
    schema_version: '1.0.0',
    source,
    ...(input.focus?.trim() ? { focus: input.focus.trim() } : {}),
    persist_to_mind: input.persist_to_mind === true,
    caller: input.caller ?? 'api',
    ...(input.correlation_id ? { correlation_id: input.correlation_id } : {}),
    ...(input.idempotency_key ? { idempotency_key: input.idempotency_key } : {}),
    ...(input.frame_budget !== undefined ? { frame_budget: input.frame_budget } : {}),
    ...(input.paid_vision_frame_budget !== undefined ? { paid_vision_frame_budget: input.paid_vision_frame_budget } : {}),
    ...(input.transcript_provider ? { transcript_provider: input.transcript_provider } : {}),
    ...(input.allow_external_transcription === true ? { allow_external_transcription: true } : {}),
    ...(input.allow_local_file === true ? { allow_local_file: true } : {}),
  };
}

function resolvePythonPath(explicit?: string): string {
  if (explicit) return explicit;
  const preferred = path.join(homedir(), '.local', 'video-orchestrator', 'venv', 'bin', 'python3');
  return existsSync(preferred) ? preferred : 'python3';
}

function parseResult(stdout: string): VideoAnalysisResult {
  const candidates = [stdout.trim(), ...stdout.trim().split(/\r?\n/).reverse()];
  for (const candidate of candidates) {
    if (!candidate.startsWith('{')) continue;
    try {
      const parsed = JSON.parse(candidate) as Partial<VideoAnalysisResult>;
      if (parsed.schema_version === '1.0.0'
        && typeof parsed.job_id === 'string'
        && /^video-analysis-[a-f0-9]{20}$/.test(parsed.job_id)
        && typeof parsed.status === 'string'
        && typeof parsed.ok === 'boolean'
        && parsed.source !== undefined
        && parsed.metadata !== undefined
        && parsed.transcript !== undefined
        && Array.isArray(parsed.visual_observations)
        && parsed.processing !== undefined
        && parsed.provenance !== undefined
        && Array.isArray(parsed.warnings)) return parsed as VideoAnalysisResult;
    } catch {
      // Continue searching for the machine-readable final line.
    }
  }
  throw new Error('video_analyzer_invalid_json');
}

function resolveSourceCommit(explicit?: string): string {
  if (explicit?.trim()) return explicit.trim();
  if (process.env.BRAIN_VIDEO_SOURCE_COMMIT?.trim()) return process.env.BRAIN_VIDEO_SOURCE_COMMIT.trim();
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: BRAIN_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim() || 'unknown';
  } catch {
    return 'unknown';
  }
}

function addPersistencePreview(result: VideoAnalysisResult, request: VideoAnalysisRequest, options: VideoAnalysisServiceOptions): VideoAnalysisResult {
  if (request.persist_to_mind !== true) {
    return { ...result, persistence: { requested: false, status: 'not_requested' } };
  }
  const preview = prepareVideoAnalysisApplyOnePreview(result, {
    ...(options.mindRoot !== undefined ? { mindRoot: options.mindRoot } : {}),
    sourceCommit: resolveSourceCommit(options.sourceCommit),
  });
  return {
    ...result,
    persistence: {
      requested: true,
      status: preview.status === 'already_applied' ? 'already_applied' : preview.status === 'pending_approval' ? 'pending_approval' : 'blocked',
      target_path: preview.target_relative_path || null,
      preview_id: preview.preview_id,
      preview_hash: preview.preview_hash,
      after_hash: preview.after_hash,
      proposal_id: preview.proposal_id,
      approval_id: preview.approval_id,
      rollback_artifact: preview.rollback_artifact,
      receipt_path: preview.receipt_path,
      confirmation_token: preview.confirmation_token,
      blockers: preview.blockers,
    },
  };
}

export async function analyzeVideo(
  input: VideoAnalysisInput,
  options: VideoAnalysisServiceOptions = {},
): Promise<VideoAnalysisResult> {
  const request = normalizeVideoAnalysisRequest(input);
  const requestDir = mkdtempSync(path.join(tmpdir(), 'brain-video-analysis-request-'));
  const requestPath = path.join(requestDir, 'request.json');
  writeFileSync(requestPath, `${JSON.stringify(request)}\n`, { mode: 0o600 });
  const pythonPath = resolvePythonPath(options.pythonPath);
  const analyzerPath = options.analyzerPath ?? ANALYZER_PATH;
  const spawnProcess = options.spawnProcess ?? spawn;
  const timeoutMs = options.timeoutMs ?? 1_800_000;

  try {
    const result = await new Promise<VideoAnalysisResult>((resolve, reject) => {
      const child = spawnProcess(pythonPath, [analyzerPath, '--request-file', requestPath], {
        cwd: PACKAGE_ROOT,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let stdout = '';
      let stderr = '';
      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error('video_analyzer_timeout'));
      }, timeoutMs);
      child.stdout.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
      child.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });
      child.on('error', (error) => { clearTimeout(timer); reject(error); });
      child.on('close', (code) => {
        clearTimeout(timer);
        try {
          const parsed = parseResult(stdout);
          if (code !== 0 && parsed.ok !== false) reject(new Error(`video_analyzer_exited_${code ?? 'unknown'}`));
          else resolve(parsed);
        } catch (error) {
          reject(new Error(`${error instanceof Error ? error.message : 'video_analyzer_failed'}${stderr ? `: ${stderr.trim().slice(-300)}` : ''}`));
        }
      });
    });
    return addPersistencePreview(result, request, options);
  } finally {
    rmSync(requestDir, { recursive: true, force: true });
  }
}
