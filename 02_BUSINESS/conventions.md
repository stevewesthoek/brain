# Conventions

## Folder boundaries (ops)
- runbooks/ - short, repeatable operational procedures
- scripts/ - executable automation used in real workflows
- snippets/ - small reusable fragments (code/config)
- automations/ - higher-level flows (n8n/Zapier/etc) and their docs
- infrastructure/ - architecture, inventories, and diagrams
- system-configs/ - symlinked, machine-specific configs; keep repo-safe docs only

## Naming and casing
- Top-level folders are numbered and uppercase (00_IDENTITY, 01_AI, ...).
- File names are lowercase (required).
- Exceptions: `README.md`, `SKILL.md`, `AGENTS.md` (standard entry points).
- If you rename a file, update every reference to match exactly.
- Prefer stability over aesthetics, but enforce the casing rule above to avoid drift.

## Data classification
- Public: safe to share (marketing copy, patterns).
- Internal: ok to store in Brain, not for public sharing by default.
- Sensitive: secrets, tokens, auth, personal data, machine state. Never commit.

## Security
- system-configs/ is symlinked; treat it as volatile and ignore by default.
- If something must be in Git, explicitly allowlist it in .gitignore and keep it credential-free.
