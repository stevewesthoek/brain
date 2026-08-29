# Brain Video Analysis v1

## Purpose

This is the single Brain-owned, provider-neutral video analysis contract used
by Brain Console, `brain-agent`, Codex, Claude Code, and the Save-to-Mind queue.
Clients submit a source and receive one normalized result. Clients do not call
the vendored `claude-watch` implementation directly.

Supported source kinds are:

- `youtube-url` — a public YouTube URL;
- `remote-video-url` — an ordinary downloadable HTTP(S) video URL;
- `local-file` — a file inside the configured local-video boundary, or an
  explicitly authorized local CLI invocation.

## Processing policy

1. Captions/subtitles are attempted first.
2. A configured local/free transcription route may be used when available.
3. NotebookLM is optional and may enrich a YouTube transcript only; it is not
   a visual-analysis engine and is never required for local or direct URLs.
4. The Brain `watch-video` adapter performs local media inspection, scene-aware
   frame extraction, and timestamp preservation.
5. Only a bounded selected-frame set is sent to an admitted multimodal model.
   The result records the extracted-frame count and paid-vision-frame count.

Missing speech or vision evidence is explicit in `warnings`; transcript-only
output is never labelled as complete visual analysis.

## Authority and persistence

Analysis artifacts are Brain runtime evidence until reviewed. `persist_to_mind`
creates a durable exact-path preview under the approved enriched-video writer;
it does not bypass approval. The writer may create at most one canonical
`mind/inbox/processed/video-analysis/<job-id>.md` artifact, with a durable
proposal, preview hash, single-use approval, rollback artifact, and post-write
receipt. It never moves or deletes the original `inbox/new` capture.

See `brain-video-analysis-v1.schema.json` and the Brain/Mind bridge contract for
the approval and receipt fields.
