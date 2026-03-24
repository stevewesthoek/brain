# Conventions

## Naming and casing
- Repo folders use lowercase kebab-case.
- File names use lowercase kebab-case when practical.
- Exceptions: `README.md`, `SKILL.md`, `AGENTS.md` (standard entry points).
- If you rename a file, update every reference to match exactly.
- Prefer clarity over legacy naming drift.

## Organisation structure

For a simple organisation folder, prefer:
- `overview.md`
- `positioning.md`
- `messaging.md`
- `offers.md`

For a richer organisation such as `prochat/`, group by function:
- `brand/` — brand strategy, positioning, narrative, customer, content
- `growth/` — channel and growth execution docs
- `legal/` — privacy, terms, and legal reference material
- `playbooks/` — strategic playbooks and supporting assets
- `youtube/` — channel-specific content system

## Source-of-truth rule

- Keep one canonical copy of each organisation fact.
- Put company/brand truth under the relevant organisation folder.
- Do not duplicate organisation truth into `runtime/` or unrelated AI docs.

## Data classification
- Public: safe to share (marketing copy, patterns).
- Internal: ok to store in Brain, not for public sharing by default.
- Sensitive: secrets, tokens, auth, personal data, machine state. Never commit.

## Security
- system-configs/ is symlinked; treat it as volatile and ignore by default.
- If something must be in Git, explicitly allowlist it in .gitignore and keep it credential-free.
