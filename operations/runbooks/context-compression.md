# Context Compression

Brain uses explicit, reversible compression for large local context. It does not run a compression proxy in front of Claude, Codex, Gemini, or the AI Model Selector.

## Tools

| Tool | Purpose | Writes |
|---|---|---|
| `rtk` | Shrinks noisy shell command output at command time. | RTK local state only |
| `brain-compress` | Compresses large JSON, logs, or text on demand and stores the original by hash. | `~/.brain/cache/compression/` |
| `brain-learn-failures` | Reports recurring session failures for manual promotion into learner skills or repo docs. | Optional report under `runtime/local/failure-learning/` |

## Default Agent Behavior

Claude, Codex, and Gemini are instructed to use these helpers automatically:

- before spending context on large local JSON, logs, or text, use `brain-compress` when exact retrieval may matter
- after difficult debugging with repeated local failures, use `brain-learn-failures` before promoting anything through `/learner`
- keep model/provider routing behind the AI Model Selector

The user does not need to invoke these commands by name.

## `brain-compress`

Use when a command, log, JSON response, or pasted file is too large for efficient LLM context but may need exact retrieval later.

```bash
brain-compress compress logs/build.log --type log
brain-compress compress response.json --type json --json
brain-compress retrieve <hash>
brain-compress retrieve <hash> --query "FATAL"
brain-compress eval logs/build.log --needle "FATAL"
```

Behavior:

- compression is explicit; nothing is intercepted automatically
- originals are stored locally under `~/.brain/cache/compression/`
- every compressed result prints a hash for exact retrieval
- JSON compression keeps first, last, error-like, and sampled items
- log compression keeps first, last, error-like, and deduplicated lines
- if exact output matters, retrieve the original hash or rerun the command raw

## Failure Learning

Run this after difficult sessions or repeated tool failures:

```bash
brain-learn-failures --repo . --write-report
```

The report is advisory. Promote an item only when it passes the learner quality gate:

- not easily found in public docs
- specific to this machine, repo, or tool stack
- likely to recur

## Evaluation

Before adopting any new compression behavior, evaluate it with:

```bash
brain-compress eval <fixture> --needle "<important string>"
```

Minimum acceptance:

- important strings remain in the compressed output or are retrievable by hash
- token estimate decreases on the target content type
- retrieval returns the exact original
- the behavior is explicit and documented

## Boundaries

Compression tooling must not:

- route model/provider calls
- mutate agent instruction files
- replace `~/.brain/memory/`
- write project-local hidden memory stores
- intercept Claude, Codex, Gemini, or app traffic by default
