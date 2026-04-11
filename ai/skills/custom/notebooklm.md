# NotebookLM CLI Skill

Use this skill when the user wants to work with NotebookLM — creating notebooks, adding sources, generating content (audio, video, slides, quizzes, etc.), or querying data programmatically.

## Context

NotebookLM CLI (v0.3.4) is installed globally via pipx. Use for:
- **Research notebooks** — create, manage, and query knowledge bases
- **Content generation** — audio overviews, videos, slides, quizzes, flashcards, mind maps, infographics
- **Data extraction** — export quiz JSON, mind map hierarchies, data tables as CSV
- **Batch operations** — download all artifacts of a type, manage multiple notebooks
- **Automation** — integrate with nightly scheduler for recurring research tasks

## Key advantages over web UI

- **Batch downloads** — download all artifacts at once
- **Structured exports** — JSON for mind maps, CSV for data tables, PPTX for slides
- **Programmatic control** — manage notebooks and permissions via CLI
- **Headless automation** — perfect for nightly scheduler and workflows
- **Beyond UI** — features not available in the web interface

## Common patterns

### Authentication
\`\`\`bash
# First time only (opens browser for Google sign-in)
notebooklm login

# Check auth status
notebooklm auth check --test
\`\`\`

### Create and manage notebooks
\`\`\`bash
# Create a notebook
notebooklm create "My Research"

# List all notebooks
notebooklm list

# Use a specific notebook
notebooklm use <notebook_id>

# Rename or delete
notebooklm rename <notebook_id> "New Name"
notebooklm delete <notebook_id>
\`\`\`

### Add sources
\`\`\`bash
# URL
notebooklm source add "https://example.com/article"

# Local file (PDF, Markdown, text, Word, audio, video, images)
notebooklm source add "./paper.pdf"

# YouTube video
notebooklm source add "https://youtube.com/watch?v=..."

# Google Drive document (requires sharing)
notebooklm source add "https://docs.google.com/document/d/..."

# Pasted text
notebooklm source add --text "Paste content here"
\`\`\`

### Chat and query
\`\`\`bash
# Ask a question
notebooklm ask "What are the key themes?"

# Get conversation history
notebooklm chat history
\`\`\`

### Generate content
\`\`\`bash
# Audio overview (podcast)
notebooklm generate audio "make it engaging" --wait

# Video overview
notebooklm generate video --wait

# Quiz
notebooklm generate quiz --difficulty hard

# Flashcards
notebooklm generate flashcards --quantity more

# Slides
notebooklm generate slide-deck

# Mind map
notebooklm generate mind-map

# Infographic
notebooklm generate infographic --orientation portrait

# Data table
notebooklm generate data-table "compare key concepts"
\`\`\`

### Download artifacts
\`\`\`bash
# Audio
notebooklm download audio ./podcast.mp3

# Video
notebooklm download video ./overview.mp4

# Quiz (as JSON or Markdown)
notebooklm download quiz --format json ./quiz.json
notebooklm download quiz --format markdown ./quiz.md

# Flashcards (as JSON)
notebooklm download flashcards --format json ./cards.json

# Slides (as PDF or PPTX)
notebooklm download slide-deck ./slides.pptx

# Mind map (as JSON for programmatic use)
notebooklm download mind-map ./mindmap.json

# Data table (as CSV)
notebooklm download data-table ./data.csv
\`\`\`

## Integration with brain

- **Nightly scheduler**: Use for recurring research tasks (e.g., weekly research synthesis)
- **n8n workflows**: Add sources, generate content, download artifacts as part of automation
- **Data export**: Generate structured outputs (JSON, CSV) for downstream processing

## Data storage

- **All notebooks** are stored in your Google NotebookLM account
- The CLI authenticates with Google and reads/writes to the same data
- **No local database** — all data is synced to Google's servers
- Notebooks created via web UI, CLI, or any authenticated session are instantly available

## When to use Claude for NotebookLM

1. **Generate scripts** — describe research workflow, Claude writes automation
2. **Batch operations** — e.g., "download all quizzes from these 5 notebooks"
3. **Integration help** — connect to n8n, nightly scheduler, or other tools
4. **Data analysis** — process exported CSV/JSON outputs

## References

- [CLI Reference](https://github.com/teng-lin/notebooklm-py/blob/main/docs/cli-reference.md)
- [Python API](https://github.com/teng-lin/notebooklm-py/blob/main/docs/python-api.md)
- [GitHub repo](https://github.com/teng-lin/notebooklm-py)
