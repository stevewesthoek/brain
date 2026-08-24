# Operations

Operational docs, helper scripts, deployment notes, and selected synced system configs.

## Structure

- `automations/` — workflow exports and higher-level automations
- `deploy/` — real deployment configs only
- `infrastructure/` — infrastructure and architecture docs
- `runbooks/` — repeatable procedures
  - **`human-writing-guardrails-adoption.md`** — why human-writing polish is a shared final-stage standard, not a separate always-on humanizer skill; lists which orchestrators use it and why.
  - **`media-acquisition-yt-dlp.md`** — install, safety boundaries, commands, folder layout, and natural-language routing for dormant yt-dlp media acquisition.
  - **`scripture-source-stack.md`** — source architecture for Bible passage retrieval, API.Bible, original-language data, Strong's-style lookup, and Scripture proof maps.
  - **`rtk.md`** — RTK shell-output token optimization for Claude, Codex, and Gemini sessions, including verification and rollback.
  - **`context-compression.md`** — explicit reversible compression, retrieval, evaluation, and failure-learning workflow for large local context.
- `standards/` — durable standards used by multiple workflows
  - **`human-writing-guardrails.md`** — shared final-stage writing-quality standard for research, Bible stories, marketing copy, websites, video scripts, captions, and other human-facing text.
  - **`redeploy-ingress-persistence.md`** — canonical Dokploy/Traefik acceptance gate proving ingress survives application and service recreation.
- `specs/` — implementation-facing operating specifications
  - **`graphify-standard.md`** — canonical Graphify operating standard for cross-repo graph generation, AI context, model-selection policy, and repo profiles.
  - **`graphify-profile-contract.md`** — declarative `.graphify-profile.json` contract for Graphify-enabled repositories.
  - **`graphify-profile.schema.json`** — machine-readable schema for repo-local Graphify profiles.
  - **`graphify-profile.examples.json`** — canonical starter examples for `mind-knowledge`, `brain-runtime`, and `code-app` profiles.
  - **`ai-context-compression-standard.md`** — live-zone-only and reversible-compression rules for future AI context tooling.
  - **`infinite-brain-runtime-inventory.md`** — Current state inventory of Brain Core, Graphify, Mind Steward, and Mind vault. Identifies gaps, safety risks, and prerequisites for autonomous knowledge graph maintenance.
  - **`infinite-brain-runtime-roadmap.md`** — 18-phase roadmap (IB0–IB17) across 4 phase groups: Foundation, Knowledge Maintenance, Continuous Reasoning, Query & Discovery. Spans 7 sprints (~4.5 months) with go/no-go checkpoints.
  - **`infinite-brain-runtime-implementation-plan.md`** — Sprint-by-sprint implementation breakdown with deliverables, task-level details, testing strategy, and quality gates for each of 7 sprints.
  - **`infinite-brain-runtime-notebooklm-findings.md`** — Research findings from NotebookLM "Brain Video Analyzer" notebook. Provides 16 recommended entity types (vs. 8 observed), validates 10 edge types, specifies atomic note guidance (50–300 lines), AI/manual maintenance split, LLM retrieval strategies, and explicit warnings against common anti-patterns. Alignment recommendations for planning documents.
- `scripts/` — executable helpers
- `snippets/` — reusable command or content fragments
- `system-configs/` — curated synced tool and machine config
  - **`claude/hooks/rtk-safe-bash-hook.sh`** — PreToolUse hook (Bash). Preserves risky-command guardrails before RTK rewrite.

## Rule

Keep durable operational knowledge here.
Keep volatile machine state out of Git.
