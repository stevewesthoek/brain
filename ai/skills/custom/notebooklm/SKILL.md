---
name: notebooklm
description: Use when the user wants to work with NotebookLM for research notebooks, sources, generated artifacts, structured exports, or programmatic queries. Requires the installed NotebookLM CLI and its separate account authentication.
---

# NotebookLM CLI Skill

Use this skill when the user wants to work with NotebookLM — creating
notebooks, adding sources, generating content (audio, video, slides, quizzes,
etc.), or querying data programmatically.

## Context

NotebookLM CLI (v0.3.4) is installed globally via pipx. Use for:

- **Research notebooks** — create, manage, and query knowledge bases
- **Content generation** — audio overviews, videos, slides, quizzes, flashcards, mind maps, infographics
- **Data extraction** — export quiz JSON, mind map hierarchies, data tables as CSV
- **Batch operations** — download all artifacts of a type, manage multiple notebooks
- **Automation** — use a separately approved automation surface for recurring research; do not assume the Brain Scheduler is available

## Key advantages over web UI

- **Batch downloads** — download all artifacts at once
- **Structured exports** — JSON for mind maps, CSV for data tables, PPTX for slides
- **Programmatic control** — manage notebooks and permissions via CLI
- **Headless automation** — suitable for explicitly approved workflows with their own credentials and safety review
- **Beyond UI** — features not available in the web interface

## Common patterns

### Authentication

```bash
# First time only (opens browser for Google sign-in)
notebooklm login

# Check auth status
notebooklm auth check --test
```

### Create and manage notebooks

```bash
notebooklm create "My Research"
notebooklm list
notebooklm use <notebook_id>
notebooklm rename <notebook_id> "New Name"
notebooklm delete <notebook_id>
```

### Add sources

```bash
notebooklm source add "https://example.com/article"
notebooklm source add "./paper.pdf"
notebooklm source add "https://youtube.com/watch?v=..."
notebooklm source add --text "Paste content here"
```

### Chat and query

```bash
notebooklm ask "What are the key themes?"
notebooklm chat history
```

### Generate content

```bash
notebooklm generate audio "make it engaging" --wait
notebooklm generate video --wait
notebooklm generate quiz --difficulty hard
notebooklm generate flashcards --quantity more
notebooklm generate slide-deck
notebooklm generate mind-map
notebooklm generate infographic --orientation portrait
notebooklm generate data-table "compare key concepts"
```

### Download artifacts

```bash
notebooklm download audio ./podcast.mp3
notebooklm download video ./overview.mp4
notebooklm download quiz --format json ./quiz.json
notebooklm download flashcards --format json ./cards.json
notebooklm download slide-deck ./slides.pptx
notebooklm download mind-map ./mindmap.json
notebooklm download data-table ./data.csv
```

## Integration with Brain

- **Scheduler boundary**: Recurring research needs a separately approved automation surface; do not assume the Brain Scheduler
- **n8n workflows**: Add sources, generate content, download artifacts as part of automation
- **Data export**: Generate structured outputs (JSON, CSV) for downstream processing

## Data storage

Notebooks are stored in the user's Google NotebookLM account. The CLI reads
and writes the same account as the web UI; no local NotebookLM database is
expected.

## Safety boundary

Authentication, source uploads, notebook creation, deletion, permissions, and
content generation can have external side effects. Inspect first and require
explicit user scope before executing those actions. Never print credentials or
session data.

When planning NotebookLM work, use this skill to generate scripts, design
batch operations, connect to a separately approved automation surface, or
analyze exported CSV/JSON outputs.

## References

- [CLI Reference](https://github.com/teng-lin/notebooklm-py/blob/main/docs/cli-reference.md)
- [Python API](https://github.com/teng-lin/notebooklm-py/blob/main/docs/python-api.md)
- [GitHub repository](https://github.com/teng-lin/notebooklm-py)
