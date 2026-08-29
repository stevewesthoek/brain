import assert from 'node:assert/strict';
import { videoAnalysisResponseSchema } from './braincore-schemas.js';

const result = videoAnalysisResponseSchema.parse({
  schema_version: '1.0.0',
  job_id: 'video-analysis-0123456789abcdef0123',
  status: 'partial',
  ok: true,
  source: { kind: 'local-file', uri: '/approved/video.mp4', provider: null, original_capture_reference: null },
  metadata: { title: 'Example', channel: null, duration_seconds: 3, width: 512, height: 288 },
  transcript: {
    text: 'spoken words',
    segments: [{ start_seconds: 1, end_seconds: 2, text: 'spoken words' }],
    provider: 'captions',
    provenance: 'watch-video/report.md',
  },
  visual_observations: [],
  summary: '',
  key_points: [],
  selected_frames: [],
  processing: {
    processor: 'brain-video-analysis',
    watch_video_output: null,
    frames_extracted: 1,
    frames_sent_to_paid_vision: 0,
    transcript_provider: 'captions',
    vision_provider: null,
    vision_model: null,
    approximate_cost: null,
    asynchronous: false,
  },
  provenance: { source_reference: '/approved/video.mp4', source_sha256: 'hash', created_at: '2026-08-29T00:00:00.000Z' },
  warnings: ['vision_provider_unavailable'],
  error: null,
  step: null,
});

assert.equal(typeof result.transcript, 'object');
if (!result.transcript || typeof result.transcript === 'string') throw new Error('structured transcript was not parsed');
assert.equal(result.transcript.text, 'spoken words');
console.log('video-analysis-schema: structured transcript accepted');
