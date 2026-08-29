export type VideoSourceKind = 'youtube-url' | 'remote-video-url' | 'local-file';
export type VideoAnalysisCaller = 'save-to-mind' | 'brain-console' | 'codex' | 'claude-code' | 'api';

export interface VideoSource {
  kind: VideoSourceKind;
  uri: string;
  provider?: string | null;
  original_capture_reference?: string | null;
}

export interface VideoAnalysisRequest {
  schema_version?: '1.0.0';
  source: VideoSource;
  focus?: string;
  persist_to_mind?: boolean;
  caller: VideoAnalysisCaller;
  correlation_id?: string;
  idempotency_key?: string;
  frame_budget?: number;
  paid_vision_frame_budget?: number;
  transcript_provider?: 'captions' | 'groq' | 'openai' | 'none';
  allow_external_transcription?: boolean;
  allow_local_file?: boolean;
}

export interface VideoTranscriptSegment {
  start_seconds: number;
  end_seconds?: number | null;
  text: string;
}

export interface VideoVisualObservation {
  timestamp_seconds: number;
  timestamp: string;
  label: string;
  observation: string;
  confidence?: string | number | null;
  frame_path?: string | null;
}

export interface VideoAnalysisResult {
  schema_version: '1.0.0';
  job_id: string;
  status: 'succeeded' | 'partial' | 'failed' | 'blocked';
  ok: boolean;
  source: VideoSource;
  metadata: {
    title: string | null;
    channel: string | null;
    duration_seconds: number | null;
    width?: number | null;
    height?: number | null;
  };
  transcript: {
    text: string;
    segments: VideoTranscriptSegment[];
    provider: string | null;
    provenance: string | null;
  };
  visual_observations: VideoVisualObservation[];
  summary: string;
  key_points: string[];
  hook_analysis?: string | null;
  selected_frames: Array<{ timestamp_seconds: number; path: string; role: string }>;
  processing: {
    processor: 'brain-video-analysis';
    watch_video_output: string | null;
    frames_extracted: number;
    frames_sent_to_paid_vision: number;
    transcript_provider: string | null;
    vision_provider: string | null;
    vision_model: string | null;
    approximate_cost: number | null;
    asynchronous: boolean;
  };
  provenance: { source_reference: string; source_sha256: string; created_at: string };
  warnings: string[];
  error: string | null;
  step: string | null;
  persistence?: {
    requested: boolean;
    status: 'not_requested' | 'preview_ready' | 'pending_approval' | 'already_applied' | 'blocked' | 'applied';
    target_path?: string | null;
    preview_id?: string | null;
    preview_hash?: string | null;
    after_hash?: string | null;
    proposal_id?: string | null;
    approval_id?: string | null;
    rollback_artifact?: string | null;
    receipt_path?: string | null;
    confirmation_token?: string | null;
    blockers?: string[];
  };

  // Compatibility fields retained for existing Console/history consumers.
  title?: string | null;
  channel?: string | null;
  transcript_text?: string | null;
  human_summary?: string | null;
  ai_summary?: {
    topic?: string;
    speaker?: string | null;
    key_claims?: string[];
    evidence_type?: string;
    confidence?: string;
    research_hooks?: string[];
  } | null;
  mind_path?: string | null;
}
