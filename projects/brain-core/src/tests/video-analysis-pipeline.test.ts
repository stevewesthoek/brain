import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { routeRequest } from '../api/routes.js';
import { detectVideoSourceFromCapture } from '../adapters/mind-steward-video-dispatcher.js';
import { inferVideoSource, normalizeVideoAnalysisRequest } from '../adapters/video-analysis-service.js';
import {
  applyVideoAnalysisApplyOne,
  prepareVideoAnalysisApplyOnePreview,
  type VideoAnalysisApplyOneApproval,
} from '../adapters/infinite-brain-writers/video-analysis-writer.js';
import type { VideoAnalysisResult } from '../adapters/video-analysis-types.js';

class MockResponse implements ServerResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body = '';

  writeHead(statusCode: number, headers?: Record<string, string>): void {
    this.statusCode = statusCode;
    this.headers = headers ?? {};
  }

  end(chunk?: string): void {
    this.body = chunk ?? '';
  }
}

function createPostRequest(url: string, body: unknown): IncomingMessage {
  const serialized = JSON.stringify(body);
  return {
    method: 'POST',
    url,
    headers: {},
    socket: { remoteAddress: '127.0.0.1' },
    on(event: string, listener: (...args: any[]) => void) {
      if (event === 'data') listener(Buffer.from(serialized));
      if (event === 'end') listener();
      return this;
    },
  } as IncomingMessage;
}

function resultFixture(): VideoAnalysisResult {
  return {
    schema_version: '1.0.0',
    job_id: 'video-analysis-0123456789abcdef0123',
    status: 'succeeded',
    ok: true,
    source: { kind: 'youtube-url', uri: 'https://youtu.be/example', provider: 'youtube', original_capture_reference: 'inbox/new/video.md' },
    metadata: { title: 'Example', channel: 'Channel', duration_seconds: 12, width: 512, height: 288 },
    transcript: { text: '[00:01] spoken words', segments: [{ start_seconds: 1, end_seconds: 2, text: 'spoken words' }], provider: 'captions', provenance: 'watch-video/report.md' },
    visual_observations: [{ timestamp_seconds: 1, timestamp: '00:01', label: 'Dashboard', observation: 'A dashboard is visible.', confidence: 'high', frame_path: null }],
    summary: 'A short example.',
    key_points: ['The example is bounded.'],
    selected_frames: [],
    processing: { processor: 'brain-video-analysis', watch_video_output: null, frames_extracted: 4, frames_sent_to_paid_vision: 1, transcript_provider: 'captions', vision_provider: 'claude-bedrock', vision_model: 'model', approximate_cost: 0.001, asynchronous: false },
    provenance: { source_reference: 'https://youtu.be/example', source_sha256: 'source-hash', created_at: '2026-08-29T00:00:00.000Z' },
    warnings: [],
    error: null,
    step: null,
    title: 'Example',
    channel: 'Channel',
    transcript_text: '[00:01] spoken words',
    human_summary: 'A short example.',
    ai_summary: null,
    mind_path: null,
  };
}

test('video source inference supports YouTube, direct remote URLs, and local files', () => {
  assert.equal(inferVideoSource('https://www.youtube.com/watch?v=abc').kind, 'youtube-url');
  assert.equal(inferVideoSource('https://cdn.example.test/video.mp4').kind, 'remote-video-url');
  assert.equal(inferVideoSource('/tmp/example.mp4').kind, 'local-file');
  const request = normalizeVideoAnalysisRequest({ source: 'https://cdn.example.test/video.mp4', caller: 'claude-code', frame_budget: 5 });
  assert.equal(request.source.kind, 'remote-video-url');
  assert.equal(request.frame_budget, 5);
  assert.equal(request.persist_to_mind, false);
  assert.throws(
    () => normalizeVideoAnalysisRequest({ source: { kind: 'youtube-url', uri: '/tmp/example.mp4' } }),
    /source_kind_mismatch/,
  );
});

test('Save-to-Mind capture detection routes URL and raw-file inputs to the canonical source kinds', () => {
  assert.deepEqual(
    detectVideoSourceFromCapture('/tmp/capture.md', 'Watch https://www.youtube.com/watch?v=abc'),
    { kind: 'youtube-url', uri: 'https://www.youtube.com/watch?v=abc' },
  );
  assert.deepEqual(
    detectVideoSourceFromCapture('/tmp/capture.md', 'Analyze https://cdn.example.test/video.mp4?download=1'),
    { kind: 'remote-video-url', uri: 'https://cdn.example.test/video.mp4?download=1' },
  );
  assert.deepEqual(detectVideoSourceFromCapture('/tmp/recording.mov'), { kind: 'local-file', uri: '/tmp/recording.mov' });
});

test('canonical HTTP route is report-only and rejects missing source before provider execution', async () => {
  const response = new MockResponse();
  await routeRequest(createPostRequest('/research/video-analysis', {}), response);
  assert.equal(response.statusCode, 400);
  assert.deepEqual(JSON.parse(response.body), {
    error: { code: 'missing_source', message: 'source (URL or configured local-file path) is required' },
  });
});

test('video Apply-one preview is exact-path, hash-bound, and requires second confirmation', () => {
  const tempDir = mkdtempSync(path.join('/tmp', 'brain-video-writer-'));
  const mindRoot = path.join(tempDir, 'mind');
  const runtimeRoot = path.join(tempDir, 'runtime');
  mkdirSync(mindRoot, { recursive: true });
  try {
    const previewResult = prepareVideoAnalysisApplyOnePreview(resultFixture(), { mindRoot, sourceCommit: 'test-commit', previewRoot: runtimeRoot });
    assert.equal(previewResult.status, 'pending_approval');
    assert.ok(previewResult.preview);
    assert.equal(previewResult.target_relative_path, 'inbox/processed/video-analysis/video-analysis-0123456789abcdef0123.md');
    assert.equal(existsSync(previewResult.target_path), false);

    const preview = previewResult.preview!;
    const blocked = applyVideoAnalysisApplyOne(preview, {
      approval_id: 'approval-test', proposal_id: preview.proposal_id, approved_by: 'operator', approved_at: '2026-08-29T00:00:00.000Z', expires_at: '2999-01-01T00:00:00.000Z', source_commit: preview.source_commit, idempotency_key: preview.idempotency_key, target_relative_path: preview.target_relative_path, expected_before_hash: null, preview_hash: preview.preview_hash, after_hash: preview.after_hash, manual_confirmation: false, confirmation_token: '', reason: 'test',
    }, { mindRoot, receiptRoot: runtimeRoot });
    assert.equal(blocked.status, 'blocked');
    assert.equal(blocked.wrote_to_mind, false);
    assert.equal(existsSync(preview.target_path), false);

    const approval: VideoAnalysisApplyOneApproval = {
      approval_id: 'approval-test', proposal_id: preview.proposal_id, approved_by: 'operator', approved_at: '2026-08-29T00:00:00.000Z', expires_at: '2999-01-01T00:00:00.000Z', source_commit: preview.source_commit, idempotency_key: preview.idempotency_key, target_relative_path: preview.target_relative_path, expected_before_hash: null, preview_hash: preview.preview_hash, after_hash: preview.after_hash, manual_confirmation: true, confirmation_token: previewResult.confirmation_token!, reason: 'bounded video evidence apply-one test',
    };
    const tampered = applyVideoAnalysisApplyOne({ ...preview, content: `${preview.content}\nTAMPERED` }, approval, { mindRoot, receiptRoot: runtimeRoot });
    assert.equal(tampered.status, 'blocked');
    assert(tampered.blockers.includes('preview_content_hash_mismatch'));
    assert.equal(tampered.wrote_to_mind, false);
    assert.equal(existsSync(preview.target_path), false);

    const applied = applyVideoAnalysisApplyOne(preview, approval, { mindRoot, receiptRoot: runtimeRoot });
    assert.equal(applied.status, 'applied');
    assert.equal(applied.wrote_to_mind, true);
    assert.match(readFileSync(preview.target_path, 'utf8'), /Timestamped visual findings/);
    assert.ok(applied.receipt_path && existsSync(applied.receipt_path));
    assert.ok(applied.rollback_artifact && existsSync(applied.rollback_artifact));
    const receipt = JSON.parse(readFileSync(applied.receipt_path!, 'utf8')) as { approval_audit?: string };
    assert.ok(receipt.approval_audit && existsSync(receipt.approval_audit));
    assert.equal(JSON.parse(readFileSync(receipt.approval_audit!, 'utf8')).status, 'accepted');

    const replay = applyVideoAnalysisApplyOne(preview, approval, { mindRoot, receiptRoot: runtimeRoot });
    assert.equal(replay.status, 'already_applied');
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});
