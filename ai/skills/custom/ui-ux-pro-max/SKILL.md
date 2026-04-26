---
name: ui-ux-pro-max
description: UI/UX design intelligence with a searchable database (styles, palettes, typography, UX guidelines, chart types, stack rules). Use when you need fast design-system selection, UI/UX best practices, or stack-specific UI guidance.
---

# UI-UX Pro Max

## What this provides
- Searchable design catalog (styles, palettes, typography, charts, UX rules, stack guidance).
- A design-system generator you can persist per project.

## Prerequisites
- Python 3.x (required to run scripts).

## Quick start (recommended)
From repo root:
```
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<product type + industry + style keywords>" --design-system -p "<Project Name>"
```

Optional: persist the system to project files
```
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --design-system --persist -p "<Project Name>" --page "<page name>"
```
This creates:
- `design-system/<project>/MASTER.md`
- `design-system/<project>/pages/<page>.md` (optional overrides)

## Domain search (targeted)
```
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain style
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain color
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain typography
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain landing
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain product
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain chart
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain icons
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain ux
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain web
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --domain react
```

## Stack search (stack-specific UI rules)
Stacks: html-tailwind, react, nextjs, astro, vue, nuxtjs, nuxt-ui, svelte, swiftui, react-native, flutter, shadcn, jetpack-compose

```
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack nextjs
python3 ai/skills/ui-ux-pro-max/scripts/search.py "<query>" --stack shadcn
```

## Role in Design Stack

**Searchable intelligence layer.** Supports other skills; does not route or own persistent brand truth.

Use for: palette/type lookup, stack-specific rules, UX patterns, chart guidance.

Do not use for: main design entry (`/web-design`), persistent system (`/design-system`), or artifacts (`/huashu-design`).

## Data location
All data lives in:
- `ai/skills/ui-ux-pro-max/data/`

If the data folder is missing, re-run:
```
uipro init --ai all
```
and copy the generated `data/` into the folder above.
