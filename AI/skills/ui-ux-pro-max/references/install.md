# UI-UX Pro Max Install (Canonical Skills Layout)

Canonical location:
  AI/skills/ui-ux-pro-max/

## Install or update (preferred)
Use the helper script:
```
bash Operations/scripts/update-ui-ux-pro-max.sh
```

## Manual install (if needed)
```
npm install -g uipro-cli
mkdir -p /tmp/uipro && cd /tmp/uipro
uipro init --ai all
cp -R .codex/skills/ui-ux-pro-max/data/* /Users/Office/Repos/Personal/Brain/AI/skills/ui-ux-pro-max/data/
cp -R .codex/skills/ui-ux-pro-max/scripts/* /Users/Office/Repos/Personal/Brain/AI/skills/ui-ux-pro-max/scripts/
```

Notes:
- The installer generates skills for many AI tools. We only need `data/` and `scripts/` here.
- Python 3.x is required to run the search scripts.
- This never overwrites `AI/skills/web-design/`.
