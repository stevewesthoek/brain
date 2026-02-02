# UI-UX Pro Max Install (Canonical Skills Layout)

This repo centralizes skills under `01-ai/skills/`. The UI-UX Pro Max data lives at:

  01-ai/skills/ui-ux-pro-max/data/

## Install using the upstream CLI
```
npm install -g uipro-cli
mkdir -p /tmp/uipro && cd /tmp/uipro
uipro init --ai all
cp -R .codex/skills/ui-ux-pro-max/data/* /Users/Office/Repos/Brain/01-ai/skills/ui-ux-pro-max/data/
```

## Notes
- The installer generates skills for many AI tools. We only need the **data** folder here.
- Python 3.x is required to run the search scripts.
