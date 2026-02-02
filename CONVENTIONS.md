# Conventions

## Folder boundaries (ops)
- runbooks/ - short, repeatable operational procedures
- scripts/ - executable automation used in real workflows
- snippets/ - small reusable fragments (code/config)
- automations/ - higher-level flows (n8n/Zapier/etc) and their docs
- infrastructure/ - architecture, inventories, and diagrams
- system-configs/ - symlinked, machine-specific configs; keep repo-safe docs only

## Naming and casing
- Top-level folders are numbered and uppercase (00-IDENTITY, 01-AI, ...).
- File names are usually lowercase; keep existing casing and update references to match exactly.
- Avoid renaming unless necessary; stability > aesthetics.

## Data classification
- Public: safe to share (marketing copy, patterns).
- Internal: ok to store in Brain, not for public sharing by default.
- Sensitive: secrets, tokens, auth, personal data, machine state. Never commit.

## Security
- system-configs/ is symlinked; treat it as volatile and ignore by default.
- If something must be in Git, explicitly allowlist it in .gitignore and keep it credential-free.
