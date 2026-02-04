# UI-UX Pro Max Install (Canonical Skills Layout)

Canonical location:
  01_AI/skills/ui-ux-pro-max/

## Install or update (preferred)
Use the helper script:
```
bash 04_OPERATIONS/scripts/update-ui-ux-pro-max.sh
```

## Manual install (if needed)
```
npm install -g uipro-cli
mkdir -p /tmp/uipro && cd /tmp/uipro
uipro init --ai all
cp -R .codex/skills/ui-ux-pro-max/data/* /Users/Office/Repos/Brain/01_AI/skills/ui-ux-pro-max/data/
cp -R .codex/skills/ui-ux-pro-max/scripts/* /Users/Office/Repos/Brain/01_AI/skills/ui-ux-pro-max/scripts/
```

Notes:
- The installer generates skills for many AI tools. We only need `data/` and `scripts/` here.
- Python 3.x is required to run the search scripts.
- This never overwrites `01_AI/skills/web-design/`.
