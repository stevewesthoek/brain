# Video Analyzer — YouTube Transcript Extraction and Managed AI Structuring

**Status:** Active Brain Core route
**Current policy:** NotebookLM extraction; Bedrock-primary/Codex-secondary text routing

## Flow

```text
YouTube URL
  -> NotebookLM full transcript extraction
  -> AI Model Selector: transcript_summarization
  -> Claude Bedrock (preferred) or Codex CLI (secondary)
  -> structured title, channel, summaries, claims, and research hooks
  -> raw transcript saved to mind/inbox/new
  -> result returned to Brain Console
```

The analyzer is invoked by Brain Core's `POST /research/video-analyze` route.
It remains useful even if semantic structuring fails: the complete transcript is
returned and saved, while structured summary fields are `null`.

## Ownership and privacy boundary

- NotebookLM authentication stays in its local credential/session store.
- The analyzer never embeds transcript content in process arguments.
- Bedrock requests use a unique owner-only temporary JSON file and
  `--cli-input-json file://...`; the file and directory are removed in `finally`.
- Codex fallback receives the prompt through stdin, runs ephemerally and
  read-only, and writes its final message to a private temporary file.
- AI Model Selector receives routing metadata and outcome reports. It does not
  receive provider credentials.
- Mind writes are limited to a new Markdown capture in `inbox/new`; existing
  Mind files are not edited by this analyzer. Names include microseconds and a
  random suffix, and creation is exclusive, so a collision fails instead of
  overwriting an existing note.
- A persistence failure returns `ok: false`, `step: mind-save`, plus the raw
  transcript; it is never presented as a successful saved analysis.

## Routing contract

The selector request is:

```json
{
  "task_type": "transcript_summarization",
  "input_token_count": 3000,
  "urgent": true,
  "task_metadata": {
    "preferred_providers": ["claude-bedrock", "codex-cli"],
    "fallback_policy": "ordered_strict"
  }
}
```

Only `claude-bedrock` and `codex-cli` responses are executed by this consumer.
There is no Ollama, MTPLX, Qwen-local, local OpenAI-compatible endpoint, or
always-on local text dependency.

## Runtime paths

```text
NotebookLM state: ~/.local/brain/state/notebooklm-video-analyzer.json
Mind target:      ~/Repos/stevewesthoek/mind/inbox/new/
Selector:         http://127.0.0.1:4890
```

Temporary Bedrock/Codex request and response files use the operating system temp
directory and are removed before the request returns.

## Verification

Read-only checks:

```bash
python3 -m py_compile projects/brain-core/services/video-analyzer/analyze.py
python3 -m unittest projects/brain-core/services/video-analyzer/test_analyze.py
npm run validate:local-text-policy
```

An end-to-end request contacts NotebookLM and a selected managed provider and
creates a new Mind inbox capture, so run it only as an explicitly authorized
functional test.

## Restore and upgrades

The analyzer source and routing policy live in Git. A rebuilt Mac requires the
normal NotebookLM, AWS, and Codex sign-ins; those credentials are intentionally
not in Git. Provider and application upgrades do not change the analyzer's
filesystem ownership model. If a CLI contract changes, update this consumer and
its validator before applying the upgrade to the live workflow.
