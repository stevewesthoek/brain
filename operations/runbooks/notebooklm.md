# NotebookLM CLI Runbook

## Installation & Status

- **Installed globally**: `pipx install notebooklm-py[browser]` (Version 0.3.4)
- **Verify**: `notebooklm --version`
- **Storage**: All notebooks stored in Google NotebookLM (Google account owned)

## Quick Start

### First-time setup
```bash
# Authenticate (opens browser for Google sign-in)
notebooklm login

# Check auth
notebooklm auth check --test
```

### Create a notebook and add sources
```bash
# Create
notebooklm create "My Research"

# List notebooks (find the ID)
notebooklm list

# Use a notebook (all subsequent commands target this notebook)
notebooklm use <notebook_id>

# Add sources
notebooklm source add "https://example.com"
notebooklm source add "./research.pdf"
notebooklm source add "https://youtube.com/watch?v=..."
```

### Generate and download content
```bash
# Generate (use --wait to block until complete)
notebooklm generate audio "make it engaging" --wait
notebooklm generate video --wait
notebooklm generate quiz --difficulty hard --wait
notebooklm generate flashcards --wait
notebooklm generate slide-deck --wait
notebooklm generate mind-map --wait

# Download
notebooklm download audio ./podcast.mp3
notebooklm download quiz --format json ./quiz.json
notebooklm download slide-deck ./slides.pptx
notebooklm download mind-map ./mindmap.json
notebooklm download data-table ./data.csv
```

## Common use cases

### 1. Weekly research synthesis (manual or separately approved automation)
```bash
#!/bin/bash

# Set notebook
export NLM_NOTEBOOK_ID="your-notebook-id"

# Add latest sources
notebooklm source add "https://news.example.com/latest-article"

# Generate synthesis
notebooklm generate report "summarize this week's key findings" --wait

# Download and save
notebooklm download report ./research-weekly-$(date +%Y%m%d).md

# Optional: upload to storage or email
```

### 2. Batch export all notebooks
```bash
#!/bin/bash

# List all notebooks
NOTEBOOKS=$(notebooklm list --format json | jq -r '.[].id')

for nb in $NOTEBOOKS; do
  echo "Processing notebook $nb..."
  notebooklm use "$nb"
  
  # Download all artifacts
  notebooklm download audio "./exports/$nb-audio.mp3"
  notebooklm download quiz "./exports/$nb-quiz.json"
  notebooklm download mind-map "./exports/$nb-mindmap.json"
done
```

### 3. Research workflow (web + PDF sources)
```bash
# Create focused research notebook
notebooklm create "AI Safety Research Q1"
notebooklm use <notebook_id>

# Add diverse sources
notebooklm source add "https://openai.com/safety"
notebooklm source add "https://deepmind.com/research"
notebooklm source add "./papers/ai-safety-2026.pdf"
notebooklm source add "https://youtube.com/watch?v=ai-safety-panel"

# Query
notebooklm ask "What are the top 5 AI safety concerns?"

# Generate structured outputs
notebooklm generate quiz "advanced" --wait
notebooklm generate data-table "create a timeline of safety breakthroughs" --wait
notebooklm download quiz --format json ./quiz.json
notebooklm download data-table ./timeline.csv
```

## Scheduler boundary

NotebookLM is not a current Brain Scheduler job. This section describes a
separately approved automation shape only; it is not an instruction to edit
the Brain Scheduler or its LaunchAgent.

1. Create script (e.g., `scripts/research-synthesis.sh`) only after that separate review:
```bash
#!/bin/bash
set -e

# Ensure notebooklm is available
command -v notebooklm >/dev/null || { echo "notebooklm not found"; exit 1; }

# Set target notebook
NLM_NOTEBOOK_ID="your-notebook-id"

# Add today's sources
notebooklm use "$NLM_NOTEBOOK_ID"
notebooklm source add "https://hacker-news.firebaseio.com/v0/topstories.json"

# Generate content
notebooklm generate report "summarize today's tech news" --wait

# Download
notebooklm download report "/tmp/news-$(date +%Y%m%d).md"

# Optional: upload to cloud storage, send via email, etc.
```

2. Keep this script outside `office-nightly-scheduler.sh` and the typed registry unless a separate safety and credential review approves an automation owner:
```bash
# Run NotebookLM research synthesis
bash ~/Repos/stevewesthoek/brain/scripts/research-synthesis.sh
```

3. Make executable and test:
```bash
chmod +x ~/Repos/stevewesthoek/brain/scripts/research-synthesis.sh
bash ~/Repos/stevewesthoek/brain/scripts/research-synthesis.sh
```

## Data migration from MCP

**Important**: No data migration needed.

- Your notebooks were always stored in Google NotebookLM
- The old MCP server was just a connector to the same Google account
- The CLI authenticates with the same Google account
- Run `notebooklm list` and you'll see all your existing notebooks

**Verification**:
```bash
# List all notebooks (should show notebooks from the MCP era)
notebooklm list
```

## Environment variables

```bash
# Optional: set default notebook (if working with one frequently)
export NLM_NOTEBOOK_ID="<notebook-id>"
export NLM_DATA_DIR="~/.notebooklm"  # Local storage for artifacts
```

## Debugging

### Auth issues
```bash
# Test authentication
notebooklm auth check --test

# Re-authenticate if needed
notebooklm login
```

### Browser launch failure
```bash
# If `playwright install chromium` fails, reinstall Playwright
playwright install chromium
```

### List format variations
```bash
# List notebooks in JSON (for scripting)
notebooklm list --format json

# List with details
notebooklm list --verbose
```

### Download timeout
Add `--wait` flag to generation commands and increase timeout if needed:
```bash
notebooklm generate video --wait  # Will poll until complete
```

## Links

- [GitHub repo](https://github.com/teng-lin/notebooklm-py)
- [CLI reference](https://github.com/teng-lin/notebooklm-py/blob/main/docs/cli-reference.md)
- [Python API docs](https://github.com/teng-lin/notebooklm-py/blob/main/docs/python-api.md)
- [NotebookLM web UI](https://notebooklm.google.com)
