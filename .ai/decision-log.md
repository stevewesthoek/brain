# Decision Log

Durable decisions for this repo.

Rules:
- Append-only.
- High-signal decisions only.
- No secrets.
- No routine implementation notes.
- No raw logs.

---

## 2026-04-17 — Save to Mind naming standardization

- Decision: "Brain Inbox" naming deprecated; system standardized to "Save to Mind" (captures INTO Mind vault, saves TO Mind inbox).
- Reason: Old naming was confusing (two competing runbooks, conflicting endpoints). System actually saves to stevewesthoek/mind repo, not a "brain" repo.
- Impact: Authoritative runbook is n8n-mind-inbox.md; old n8n-brain-inbox.md is deprecation notice. All tests/docs use /webhook/mind-inbox endpoint. n8n workflow must be updated in UI to match (webhook path + name change).

## 2026-04-17 — GitHub token rotation completed

- Decision: GitHub PAT rotated after exposure in local n8n backup files. New token moved to n8n Dokploy environment variable GITHUB_MIND_PAT. Old token revoked.
- Reason: Token was hardcoded in n8n workflow Authorization header, exposing it in backups and exports.
- Impact: Workflow auth now uses $env.GITHUB_MIND_PAT. Token is not exposed in workflow JSON. Rotation verified at infrastructure level; functional test pending n8n webhook reactivation.

## 2026-04-17 — Brain-to-Mind naming migration hardened

- Decision: All automation scripts, runbooks, and operational code now exclusively use "Mind" naming. Commit ce3731c5: renamed 4 runbooks, renamed 4 scripts with internal logger/commit message updates, updated examples/paths/patterns.
- Reason: User requirement "NO BRAIN NAMING IN ACTIVE FILES. ONLY MIND." Automation scripts must reflect that they save to stevewesthoek/mind repo, not brain.
- Impact: Cron-driven automation (kanban-syncer, auto-router, project-decomposer, verify-check) now log with mind- prefix. All git commits from these scripts use "mind:" prefix. Runbook examples show correct paths and endpoints. Zero active "Brain" references remain in operational code.
