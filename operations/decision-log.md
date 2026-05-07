# Decision Log

Lightweight record of infra/structure decisions that affect the Brain repo.

## Format
- Date:
- Decision:
- Context:
- Impact:
- Rollback:

## Entries

- Date: 2026-05-07 (Design System Integration)
- Decision: Unified `/design` master orchestrator + `design-motion-principles` integration
- Context: Design system had 11 powerful skills (design-consultation, design-system, web-design, plan-design-review, design-review, huashu-design, redesign-skill, taste-skill, soft-skill, output-skill, ui-ux-pro-max) with no unified entry point. Users had to know which skill to invoke for which situation. kylezantos/design-motion-principles (393 stars) provides a systematic 3-designer motion audit framework. Goal: stupid-proof single natural-language entry point covering all design scenarios.
- Impact: (1) New `/design` master orchestrator at `brain/ai/skills/custom/design/SKILL.md` — single entry point, three workflows (NEW/MIMIC/UPGRADE), four project types (SAAS/LANDING/FUNNEL/WEBSITE), auto-sequences all 11 skills; (2) New `design-motion-principles` vendor skill at `brain/ai/skills/vendors/kylezantos/` with SKILL.md + 9 reference files fetched from GitHub (Emil, Jakub, Jhey, audit checklist, common mistakes, accessibility, performance, technical principles, output format); (3) Motion audit integrated into all three design workflows at post-build stage; (4) `/web-design` updated with motion audit reference in Motion Plan section; (5) `/design-review` updated with Phase 4b motion audit integration; (6) All three engine configs updated (CLAUDE.md, AGENTS.md, GEMINI.md); (7) brain/CLAUDE.md updated; (8) Symlinks created in active/; (9) AI-agnostic: works identically on Claude Code, Codex, Gemini, Cursor, Kiro.
- Rationale: One natural-language entry point removes the cognitive overhead of knowing 11 skill names. Motion audit adds systematic quality layer previously absent. DESIGN.md as source of truth ensures cross-session and cross-AI continuity.
- Rollback: Remove `brain/ai/skills/active/design` and `brain/ai/skills/active/design-motion-principles` symlinks; remove `brain/ai/skills/custom/design/` and `brain/ai/skills/vendors/kylezantos/` directories; revert CLAUDE.md, AGENTS.md, GEMINI.md, brain/CLAUDE.md, web-design/SKILL.md, design-review/SKILL.md edits.

- Date: 2026-05-07 (Phase 2)
- Decision: Automatic invisible memory injection on session start and mid-session recall-intent triggers
- Context: Phase 1 implemented memory infrastructure (IDs, mem-search script, progressive disclosure), but required manual invocation. Phase 2 makes memory truly automatic and invisible: detect recall-intent phrases naturally and inject matching memory entries without user thinking about hooks or commands.
- Impact: (1) Enhanced `inject-handoff.sh` to extract keywords from user's first prompt on session start, auto-search memory, prepend matching entries as `--- Memory context ---` block; (2) New `memory-recall-hook.sh` UserPromptSubmit hook detects 15+ recall-intent trigger phrases ("what did we", "remind me", "do we have", "what settings", etc.) and injects matching memory as `--- Memory recall ---` block into mid-session prompts; (3) Non-trigger prompts have zero cost (grep only, ~0ms passthrough); (4) Cap output at 5 entries/100-200 tokens max to keep injection lean; (5) Updated all three engine configs (CLAUDE.md, AGENTS.md, GEMINI.md) to explain auto-injection and guide usage; (6) Fully AI-agnostic: works on Claude Code, Codex, Gemini CLI with same mechanism.
- Rationale: Invisible automation is the ultimate UX — user talks naturally, memory surfaces automatically at the right time, zero mental overhead. Achieves "stupid-proof, fool-proof" goal: no commands to remember, no hooks to invoke, just conversation.
- Rollback: (1) Remove memory-recall-hook.sh; (2) Revert inject-handoff.sh to Phase 1 version (remove keyword extraction + memory search block); (3) Remove memory-recall-hook entry from settings.json UserPromptSubmit; (4) Revert CLAUDE.md, AGENTS.md, GEMINI.md to remove auto-injection docs; (5) All Phase 1 memory infrastructure remains intact and functional.

- Date: 2026-05-07
- Decision: Memory system upgrade — observation IDs, progressive disclosure, mem-search script
- Context: Analysis of claude-mem (73k GitHub stars) revealed three additive improvements worth adopting to enhance our existing 4-layer memory model. All changes are purely additive (no behavior changes, no breaking changes, backward-compatible).
- Impact: (1) Every memory file now has a unique ID in frontmatter (mem-{type}-NNN); (2) New `mem-search.sh` shell script at `brain/tools/scripts/mem-search.sh` with symlink at `~/.local/bin/mem-search` provides three-layer access (index → search → ID fetch); (3) Progressive disclosure pattern documented in all three engine configs (CLAUDE.md, AGENTS.md, GEMINI.md) saves ~10x tokens at scale; (4) Memory directory created at `~/.claude/projects/-Users-Office-Repos-stevewesthoek-brain/memory/` with MEMORY.md index and seed project memory entry; (5) Fully AI-agnostic (works on Claude Code, Codex, Gemini CLI, all IDEs via shell access); (6) Script uses only standard bash/grep/find (no dependencies).
- Rationale: IDs make memory entries citable in future decisions. Progressive disclosure (index → search → full content) provides token efficiency at scale. Shell script ensures universal access across all AI engines and IDEs. Three improvements together complete the claude-mem analysis and solidify the memory system.
- Rollback: (1) Remove `brain/tools/scripts/mem-search.sh` and `~/.local/bin/mem-search` symlink; (2) Delete `~/.claude/projects/-Users-Office-Repos-stevewesthoek-brain/memory/` directory; (3) Revert doc changes in `CLAUDE.md`, `AGENTS.md`, `GEMINI.md`, `brain/CLAUDE.md` to remove mem-search references and ID convention docs; (4) All existing memory behavior, hooks, and schemas remain unchanged and continue working.

- Date: 2026-04-24
- Decision: Treat the Codex warning "Some enabled skills were not included in the model-visible skills list for this session" as a signal that the task likely needs `investigate` when the work is root-cause debugging or process tracing.
- Context: The warning appeared in a debugging session that was tracing an open-handle path, lingering Prisma clients, timers, and CLI exit behavior. The task pattern matched systematic investigation rather than a generic coding or UI skill.
- Impact: When a similar warning appears during debugging-heavy work, explicitly naming `investigate` should help load the right skill context and reduce ambiguity. This is an inference for interpretation only, not a global routing rule.
- Rollback: Remove this entry if the warning is later shown to map to a different skill or if the interpretation stops being useful.

- Date: 2026-04-15
- Decision: Pivot Firecrawl from Dokploy VPS deployment to local on-demand Docker Compose with auto-lifecycle management.
- Context: VPS-hosted Firecrawl (firecrawl.prochat.tools on Dokploy) consumed fixed infrastructure resources even during idle periods. Local on-demand setup reduces resource consumption by starting Firecrawl only when needed and auto-shutting down after 15 minutes of inactivity.
- Impact: (1) Removed firecrawl.prochat.tools from Dokploy; (2) Created local Docker Compose setup in brain/tools/firecrawl/ with Port 3051; (3) Built wrapper script (firecrawl-wrapper.sh) implementing idle-based lifecycle, parameter validation, hard caps (50 pages, 3 depth, 120s timeout), safe defaults (25 pages, 2 depth, 60s), comprehensive logging to brain/tools/firecrawl/logs/firecrawl.log; (4) Updated `/firecrawl` skill to reference localhost:3051 + wrapper-only access; (5) All Tailscale/VPS references removed from skill and documentation; (6) Single source of truth: wrapper script handles all orchestration (startup, validation, shutdown, logging); (7) Deep mode flag (--deep) for approved research allowing 100 pages + 3 depth.
- Rationale: Local on-demand deployment reduces fixed resource costs and simplifies the infrastructure footprint while maintaining token-efficient markdown output for all three AI engines (Claude Code, Codex, Gemini Flash). Wrapper script provides unified parameter safety and audit trail.
- Rollback: (1) Delete brain/tools/firecrawl/ directory; (2) restore Firecrawl app on Dokploy with docker-compose from version control; (3) update `/firecrawl` skill to point to firecrawl.prochat.tools:3002 (or current Dokploy port); (4) restore VPS/Tailscale references in documentation; (5) remove wrapper script references from all skills and runbooks.

- Date: 2026-04-14
- Decision: Implement real-time model tracking system with dynamic status line visibility into Claude Code's automatic model routing.
- Context: Claude Code's model router automatically escalates from Haiku → Sonnet → Opus based on task complexity, but these decisions were invisible to the user. No way to see when expensive models (Sonnet ~5× cost, Opus ~25× cost) are running or why. Users couldn't correlate task cost with actual model choices.
- Impact: (1) Status line now displays active model + reason badge + agent name (e.g., "sonnet ↑ (complex) [coder-default]"); (2) Reason badges signal cost (↑ = escalation, ↑↑ = high blast-radius, ⊙ = plan, ◊ = review, ⚙ = preprocessing); (3) Three hooks (UserPromptSubmit, PostToolUse/Agent, Stop) detect mode changes and update ~/.claude/model-tracking.json in real-time; (4) Automatic reset to Haiku between independent tasks maintains cost discipline; (5) Full documentation: operations/runbooks/model-tracking.md (ops), docs/model-tracking-reference.md (user reference), operations/model-tracking-visual-guide.md (architecture); (6) Validation script passes all 12 checks.
- Rationale: Transparency into model routing enables users to (a) understand why expensive models are necessary, (b) track cost per task without guessing, (c) debug whether cheaper tiers could work, (d) learn which task types naturally escalate. Badges serve as real-time cost signals.
- Rollback: (1) Remove hook registrations from ~/.claude/settings.json (UserPromptSubmit, PostToolUse/Agent, Stop); (2) Delete ~/.claude/hooks/model-*.sh files; (3) Delete ~/.claude/model-tracking.json; (4) Revert statusline-command.sh to previous version (remove tracking JSON read logic); (5) Delete brain docs/operations files related to model tracking; (6) Remove model tracking section from brain/CLAUDE.md.

- Date: 2026-04-10
- Decision: Deploy self-hosted Firecrawl on Dokploy as the default AI-agnostic web data tool, replacing `/browse` (QA tool, retired) and raw WebFetch usage (token-heavy HTML).
- Context: Firecrawl provides 75–90% token savings by returning clean markdown instead of raw HTML. It supports search, scrape, and batch crawl. Self-hosted means no API cost, full control, and data privacy. Replaces gstack `/browse` (which is a QA/dogfooding tool not web search) and ad-hoc WebFetch calls for research.
- Impact: (1) `/browse` skill removed from `ai/skills/active/`; (2) new `/firecrawl` skill at `https://firecrawl.prochat.tools` becomes default for all web research; (3) Dokploy gains Firecrawl service using 5GB api + 2GB playwright (mem-limited for Dokploy's 15GB RAM); (4) Firecrawl works with Claude Code, Codex, and Gemini Flash; (5) integration documented in routing.md and brain skill.md files.
- Rollback: (1) Delete Firecrawl Dokploy app; (2) remove DNS CNAME via `~/.local/bin/cloudflare-prochat-provisioner dns delete prochat.tools firecrawl.prochat.tools`; (3) restore `/browse` symlink from `vendors/gstack/browse/`; (4) revert CLAUDE.md skills list; (5) delete `/firecrawl` skill files.
- Date: 2026-04-03
- Decision: Centralize AI safety rules in `ai/policy/guardrails.md` and reference that file from both Claude and Codex global configs.
- Context: Both agents are configured for high autonomy and may run with reduced permission prompts or broad access.
- Impact: Shared guardrails now live in one canonical policy, while tool-specific configs only carry brief summaries and pointers.
- Rollback: Remove the references from the tool-specific configs and delete `ai/policy/guardrails.md` if a different canonical location is chosen.
- Date: 2026-04-03
- Decision: Add lightweight global Claude preflight hooks for risky Bash commands and sensitive-file edits.
- Context: The goal is hands-off safety with minimal latency for high-risk actions such as deploys, destructive commands, database mutations, and secret-bearing file changes.
- Impact: Claude now runs automatic low-cost checks before those tool calls. Codex still relies on shared policy instructions because no equivalent hook layer is documented here.
- Rollback: Remove the `hooks` block from `operations/system-configs/claude/settings.json` and delete the scripts under `operations/system-configs/claude/hooks/`.
- Date: 2026-04-03
- Decision: Standardize self-hosted n8n CLI usage through a shared `/n8n` skill backed by the official global `n8n` npm package and a stable `~/.local/bin/n8n-cli` symlink.
- Context: The repo already centralizes CLI workflows for Stripe, GitHub, Supabase, Cloudflare, and Dokploy. n8n should follow the same AI-agnostic pattern for both Claude and Codex.
- Impact: Both agents now have one documented way to inspect or operate self-hosted n8n, with npm and Docker execution modes documented in the same skill.
- Rollback: Remove `ai/skills/custom/n8n/n8n-cli`, delete the `ai/skills/active/n8n` symlink, remove the `~/.local/bin/n8n-cli` symlink, and delete the related doc and rule updates.
- Date: 2026-04-03
- Decision: Use the live n8n Public API on `n8n.prochat.tools` as the default automation interface, with local auth in `~/.config/n8n/.env` and a stable `~/.local/bin/n8n-api` wrapper.
- Context: The n8n instance is hosted as a Docker Compose app on Dokploy. Dokploy manages the container, but workflow CRUD should use n8n's supported Public API for frictionless prompt-to-workflow automation.
- Impact: Claude and Codex can now target the live server headlessly for workflow, credential, variable, and project operations without requiring routine UI login.
- Rollback: Remove `brain/tools/n8n-api.sh`, delete `~/.local/bin/n8n-api`, remove `~/.config/n8n/.env`, and revert the `/n8n` skill and rules updates if a different integration path is chosen.
- Date: 2026-04-03
- Decision: Back up live n8n credentials and workflows into the gitignored local path `operations/automations/n8n/n8n_backup/` using `tools/scripts/backup-n8n.sh`.
- Context: The Public API on the current n8n build does not expose routine credential listing, but server-side `n8n export:*` in the Dokploy-hosted container does allow full recovery exports, including decrypted credentials for migration to a new instance.
- Impact: Existing n8n OAuth/API credentials and workflows are now recoverable from the local machine backup set even if the self-hosted server is reinstalled.
- Rollback: Delete `tools/scripts/backup-n8n.sh`, remove the local backup directory, and choose a different recovery/export workflow.
- Date: 2026-04-03
- Decision: Schedule the n8n backup with a daily `launchd` calendar trigger at 03:00 plus `RunAtLoad` catch-up, instead of a 15-minute polling interval.
- Context: The Mac mini is usually always on, but may occasionally reboot or be temporarily off. A lighter schedule is preferred as long as backups still resume automatically after restart.
- Impact: The job now runs with near-zero idle overhead while still catching up automatically after reboot once the user session is active and Lisbon time is past 03:00.
- Rollback: Restore the previous `StartInterval`-based LaunchAgent if tighter catch-up polling is preferred.
- Date: 2026-04-03
- Decision: Standardize Azure access through the official Azure CLI (`az`) installed via Homebrew, a stable `~/.local/bin/azure-cli` symlink, and a shared `/azure` skill with multi-account subscription-first guidance.
- Context: Azure is closer to AWS-style account/subscription CLI work than to n8n-style app-local automation. The user has two Azure accounts and wants one AI-agnostic way for Claude and Codex to inspect and manage them.
- Impact: Both agents now have one documented Azure CLI path and a helper inventory script to enumerate subscriptions, resource groups, and resources after login.
- Rollback: Remove `ai/skills/custom/azure/azure-cli`, delete the `ai/skills/active/azure` symlink, remove `~/.local/bin/azure-cli`, and delete `tools/scripts/azure-inventory.sh` if a different Azure integration approach is chosen.
- Date: 2026-04-03
- Decision: Standardize self-hosted CloudPanel CLI usage through a shared `/cloudpanel` skill backed by the remote `clpctl` binary and a stable local wrapper at `~/.local/bin/cloudpanel-cli`.
- Context: The CloudPanel server is already reachable through the repo-managed `cloudpanel` SSH alias in `operations/system-configs/ssh/config`. Both Claude and Codex need one AI-agnostic way to operate it without introducing an MCP server.
- Impact: Both agents now have one documented command path for CloudPanel operations on the self-hosted host: `~/.local/bin/cloudpanel-cli` or the direct fallback `ssh cloudpanel /usr/bin/clpctl`.
- Rollback: Remove `ai/skills/custom/cloudpanel/cloudpanel-cli`, delete the `ai/skills/active/cloudpanel` symlink, remove the `~/.local/bin/cloudpanel-cli` symlink, and delete the wrapper script at `operations/system-configs/bin/cloudpanel-cli`.
- Date: 2026-04-03
- Decision: Standardize AWS CLI usage through a shared `/aws` skill backed by a stable local wrapper at `~/.local/bin/aws-cli`, with mandatory workload qualification before any EC2 or Lightsail provisioning.
- Context: AWS is intended to be one stage in a larger infrastructure pipeline, and server creation must be sized from explicit workload answers instead of guesswork. The AWS CLI is already installed and authenticated on this machine.
- Impact: Both Claude and Codex now have one documented, AI-agnostic AWS CLI entrypoint plus a shared qualification workflow for deciding between EC2 and Lightsail and selecting the right machine shape.
- Rollback: Remove `ai/skills/custom/aws/aws-cli`, delete the `ai/skills/active/aws` symlink, remove the `~/.local/bin/aws-cli` symlink, delete `operations/system-configs/bin/aws-cli`, and remove the related rule updates.
- Date: 2026-04-03
- Decision: Standardize AWS role usage with `provisioner` and `destroyer` profiles exposed through `~/.local/bin/aws-provisioner` and `~/.local/bin/aws-destroyer`, while keeping `~/.local/bin/aws-cli` as the generic base wrapper.
- Context: The AWS account now uses two assumed roles for AI automation. The safe default should be explicit in the local command surface so both Claude and Codex use the non-destructive role by default.
- Impact: AI-driven AWS work now defaults to the provisioner role for discovery and provisioning, and reserves the destroyer role for explicit teardown workflows only.
- Rollback: Remove the wrapper scripts from `operations/system-configs/bin`, remove the `~/.local/bin/aws-provisioner` and `~/.local/bin/aws-destroyer` symlinks, and revert the AWS skill language back to direct profile or generic wrapper usage.
- Date: 2026-04-03
- Decision: Make `operations/infrastructure/infra.md` the canonical machine-readable human-readable infrastructure reference for cloud accounts, servers, access paths, and hosted platforms.
- Context: Infrastructure facts had become fragmented across skills, SSH config, runbooks, and memory. The user wants one place that Claude and Codex can consult for Azure, AWS, Dokploy, CloudPanel, n8n, server IPs, and access paths.
- Impact: The repo now has one central infrastructure document that is updated from live inventory and can serve as the recovery and orientation reference point for future sessions.
- Rollback: Move the canonical infra reference to a different file and replace cross-references once a better location is chosen.
- Date: 2026-04-03
- Decision: Standardize Hetzner Cloud CLI usage through a shared `/hetzner` skill backed by the official `hcloud` binary, a stable `~/.local/bin/hetzner-cli` wrapper, and local-only auth in `~/.config/hetzner/.env` or native `hcloud` contexts.
- Context: Hetzner is part of the server migration path, but Hetzner infrastructure control is a different layer from CloudPanel site migration. Claude and Codex need one AI-agnostic interface for Hetzner Cloud infrastructure that matches the repo’s other CLI integrations.
- Impact: Both agents now have one documented, shared Hetzner CLI path for server, firewall, volume, network, image, and DNS-zone operations without committing credentials to the repo.
- Rollback: Remove `ai/skills/custom/hetzner/hetzner-cli`, delete the `ai/skills/active/hetzner` symlink, remove `~/.local/bin/hetzner-cli`, delete `operations/system-configs/bin/hetzner-cli`, and revert the related doc/rule updates.
- Date: 2026-04-03
- Decision: Standardize Azure CLI usage around subscription-explicit provisioner and destroyer wrappers instead of ambient account context.
- Context: Azure access is authenticated to two subscriptions in two different tenants. The safe interface for Claude and Codex is to make both the subscription and the destructive/non-destructive intent explicit in the command path.
- Impact: AI-driven Azure work now defaults to `azure-apps-provisioner` or `azure-data-provisioner` for inventory and provisioning, and reserves the matching destroyer wrappers for explicit teardown workflows.
- Rollback: Remove the wrapper scripts from `operations/system-configs/bin`, remove the `~/.local/bin/azure-*` symlinks, and revert the Azure skill back to generic `az` plus manual subscription targeting.
- Date: 2026-04-03
- Decision: Back the Azure provisioner and destroyer wrappers with dedicated service principals and custom Azure RBAC roles per subscription.
- Context: Local wrapper discipline alone was not enough. Azure needed account-side enforcement comparable to the AWS role model, but the two subscriptions live in different tenants, so each subscription required its own principals.
- Impact: `PROCHAT-APPS` and `PROCHAT-DATA` now each have provisioner and destroyer service principals, with custom non-destructive provisioner roles and `Contributor` destroyer roles, and the local wrappers now authenticate through those principals.
- Rollback: Delete the Azure service principals and custom roles, remove the local credential files under `~/.config/azure-ai/credentials/`, and revert the Azure wrappers back to direct user-authenticated `az`.
- Date: 2026-04-03
  Area: cloudflare
  Decision: Standardize Cloudflare access for Claude and Codex behind account-aware provisioner and destroyer wrappers with external credential files under `~/.config/cloudflare-ai/credentials/`. Use dedicated Cloudflare API tokens per account and role, but rely on local wrapper guardrails for destructive separation because Cloudflare token permissions do not cleanly distinguish DNS/tunnel edit from delete.
- Date: 2026-04-04
- Decision: Make `operations/infrastructure/scheduler-inventory.md` the canonical inventory for Office-Mac timed jobs, LaunchAgents, and app-level schedulers that should be considered together.
- Context: Scheduler knowledge was split across app-specific docs, launchd plist files, crontab entries, and n8n exports. The user wants one central place to see what runs when, what is heavy, and what should be ordered.
- Impact: Future scheduled-job additions now have one review point, and the current `03:00` collision plus repo/live drift are explicitly documented in one place.
- Rollback: Move the canonical scheduler inventory into a different infrastructure document and replace links once a better location is chosen.
- Date: 2026-04-04
- Decision: Centralize Office-Mac nightly jobs behind `com.office.nightly-scheduler` and `tools/scripts/office-nightly-scheduler.sh`, with ordered execution of STB batch, n8n backup, and Claude session cleanup.
- Context: The live machine had three independent `03:00` jobs competing in the same slot. The user wants one sane, reliable scheduler that prevents overlap and stops the chain on hangs.
- Impact: The Office Mac now has a single nightly entrypoint with locking, per-job timeouts, run-state markers, and ordered execution. The STB batch registration path also moves away from owning its own direct daily cron entry.
- Rollback: Reinstall the individual crontab / LaunchAgent entries, disable `com.office.nightly-scheduler`, and revert the STB scheduler registration flow to direct cron ownership if centralized sequencing is no longer desired.
- Date: 2026-04-04
- Decision: Migrate the live `Office` Mac to the centralized nightly scheduler and retire the standalone `com.office.n8n-backup`, `stb-pipeline-batch`, and `claude-session-cleanup` schedule owners.
- Context: The repo-side scheduler changes were ready, but the live machine still had the old overlapping `03:00` cron and LaunchAgent state.
- Impact: The live machine now matches the documented design: `com.office.nightly-scheduler` is installed in `~/Library/LaunchAgents`, the STB batch is registered through `~/.local/state/office-scheduler/stb-pipeline-batch.env`, direct batch/cleanup cron entries are gone, and `com.office.n8n-backup` has been removed from the active LaunchAgent set.
- Rollback: Recreate the removed crontab entries, reinstall `~/Library/LaunchAgents/com.office.n8n-backup.plist`, boot out `com.office.nightly-scheduler`, and remove the STB scheduler state file if the machine must return to independent job ownership.
- Date: 2026-04-04
- Decision: Generate a post-run scheduler snapshot automatically to `runtime/local/office-scheduler/latest-run.md` after each real nightly scheduler execution.
- Context: The user wants measured durations from the live `03:00` run without relying on memory or a second investigation pass. The repo should have an easy local source of truth for the latest observed runtimes without creating daily Git churn.
- Impact: After each real nightly run, the latest job statuses, durations, and log tail are rendered to a gitignored local markdown file that can be reviewed and copied back into the canonical scheduler inventory.
- Rollback: Remove `tools/scripts/render-office-scheduler-report.sh`, stop calling it from `tools/scripts/office-nightly-scheduler.sh`, and delete `runtime/local/office-scheduler/latest-run.md` if automated local runtime snapshots are no longer wanted.
- Date: 2026-04-04
- Decision: Retire the OpenClaw Claude bridge and AWS OpenClaw host, and standardize on the local `ProBot` Telegram daemon running on the `Office` Mac.
- Context: The OpenClaw VPS and bridge had become redundant after moving to a local-first workflow around Claude, Codex, and Brain. The user wanted Telegram access without ongoing AWS cost or bridge maintenance.
- Impact: The AWS OpenClaw Lightsail instance and snapshots are deleted, the local bridge LaunchAgent and logs are removed, and `tools.prochat.probot` is now the only always-on Telegram control surface documented in Brain.
- Rollback: Recreate the AWS host and snapshots from scratch or restore the retired bridge code and LaunchAgent if a remote bridge architecture is needed again.
- Date: 2026-04-06
- Decision: Change `check-risky-command.sh` sensitive credential file access from manual-confirmation (`ask`) to auto-approve with logging.
- Context: The manual confirmation prompt was interrupting flow on routine Bash credential reads (e.g. `cat .env`, `cp .pem`). The security signal was useful but blocking was not.
- Impact: Bash commands that touch credential files (`.pem`, `.key`, `id_rsa`, `.env`, `.aws/credentials`, etc.) are now auto-approved. Each event is timestamped and logged to `brain/operations/security-auto-approvals.log`, auto-committed via background git, and surfaced as a non-blocking notice in the Claude conversation. All other risky Bash patterns (destructive deletes, force-push, deploys, database mutations) still prompt as before. `guardrails.md` updated to document this behavior.
- Rollback: In `check-risky-command.sh` section 4, replace the `auto_allow_sensitive` call with the original `ask "Sensitive credential file access or mutation detected. Confirm before printing, copying, moving, or deleting secrets."` call and remove the `auto_allow_sensitive()` function.
- Date: 2026-04-06
- Decision: Use `dockerfile` buildType (never nixpacks) for all Dokploy deployments across the prochattools stack.
- Context: After adding New Relic with `NODE_OPTIONS=--require newrelic` as a Dokploy env var, all 11 apps broke on the next deploy. Nixpacks injects all Dokploy env vars as `ENV` statements active during every `RUN` step — including `npm ci`. Node.js tried to preload newrelic before node_modules existed, causing `Cannot find module 'newrelic'` on every build. With `dockerfile` buildType, Dokploy uses the repo's own Dockerfile as-is and only injects env vars at container runtime.
- Impact: Every prochattools repo now has a custom multi-stage Dockerfile (deps → builder → runner). Builder stage includes placeholder ENV values for any SDK keys validated at module-eval time during `next build` (Prisma DATABASE_URL, Resend API key, Stripe keys). The forge skill Phase 6c was updated to require a Dockerfile as a pre-deploy step. This is the permanent standard for all new and existing repos.
- Rollback: Switch Dokploy buildType back to nixpacks and remove NODE_OPTIONS from the Dokploy env vars for affected apps.
- Reference: `operations/deploy/dockerfile-standard.md`
- Date: 2026-04-05
- Decision: Deploy New Relic Standard (nonprofit) across the full infra stack — 3 servers, 12 apps, PostgreSQL, Docker logs, 11 synthetic monitors, and ProBot dashboard widget.
- Context: No observability existed beyond 7 Azure VM-level metric alerts. xGrow was in silent error state, n8n workflow failures were invisible, and there was no APM on any app.
- Impact: All three Linux servers report via infra agents (EU region, account 7019441). All 12 Dokploy Node.js apps have NR APM via `NODE_OPTIONS=--require newrelic`. Docker container logs forward via fluent-bit. PostgreSQL monitored via `newrelic_monitor` read-only role. Synthetics check all public URLs every 5 min. ProBot dashboard shows live server health and uptime dots.
- Rollback: Remove `newrelic-infra` from servers, remove `NODE_OPTIONS`/`NEW_RELIC_*` env vars from Dokploy apps, delete NR entities via NerdGraph, remove `~/.config/newrelic/.env`.

- Date: 2026-04-07
- Decision: Replace per-user OAuth GWS access (gwsa) with a single service account with domain-wide delegation, following the provisioner/destroyer wrapper pattern used by AWS, Azure, and Cloudflare.
- Context: The org has 17 domains and 20 users across yeshua.academy (primary), prochat.tools, and 15 additional domains including 6 client-owned domains. Per-user OAuth required a separate browser login per account and had no protection model.
- Impact: `gws-provisioner` and `gws-destroyer` wrappers now provide org-wide access via `~/.config/gws/service-account.json`. Six client-domain accounts are hard-protected in the wrapper (exit 3 on any delete/suspend attempt). `gwsa` is deprecated for org accounts. `messaggerocristiano.it` domain scheduled for manual deletion (no users, no longer needed — requires `admin.directory.domain` write scope added to DWD first).
- Rollback: Remove service account wrapper scripts from `operations/system-configs/bin/`, remove `~/.config/gws/service-account.json`, revert gws skill to per-account OAuth instructions, and re-add `gwsa`/`gwsa-login` shell functions to `.zshrc` if per-user OAuth is needed again.

- Date: 2026-04-07
- Decision: Add monthly skill library pruning via the nightly scheduler.
- Context: The active skill library reached 79 skills. Beyond ~60 non-tool skills the token overhead and signal dilution outweigh the benefit of additional skills. A saturation point exists.
- Impact: `/skill-prune` skill added at `ai/skills/custom/learned/skill-prune/`. Monthly pruning job added to `office-nightly-scheduler.sh` — fires on the 7th of each month, skips silently on all other nights. State tracked in `~/.local/state/office-scheduler/skill-prune.last-month`. Log at `~/Library/Logs/office-scheduler/skill-prune.log`. Skills README updated with maintenance policy and quality gate. Scheduler inventory updated with full chain member list. Two new learned skills also added this session: `dokploy-swarm-deploy-stale` and `nextjs-fixed-header-hero-flex-overflow`.
- Rollback: Remove `run_skill_prune` function and its call from `office-nightly-scheduler.sh`. Remove `ai/skills/active/skill-prune` symlink and `ai/skills/custom/learned/skill-prune/`.

- Date: 2026-04-06
- Decision: Add Gemini CLI as a third AI engine (large-context preprocessor) in the unified system.
- Context: Claude (orchestrator) + Codex (reviewer) needed a free-tier large-context engine. Gemini Flash has a 1M token context window and ~1500 RPD / 1M TPM free tier — ideal for preprocessing large inputs before handing to Claude/Codex.
- Impact: Three-engine routing policy in routing.md. ~/.gemini was already symlinked to brain/operations/system-configs/gemini/. GEMINI.md replaced with global instructions. /gemini skill added at ai/skills/custom/gemini/. gemini-review.sh wrapper at tools/. repos.sh and sessions.sh updated to include Gemini as third option. AGENTS.md, model-router skill, and both CLAUDE.md files updated. Cost priority: Gemini Flash (free) > Haiku > Codex mini > Sonnet > Codex standard > Opus.
- Rollback: Remove ai/skills/active/gemini symlink, ai/skills/custom/gemini/, tools/gemini-review.sh. Revert routing.md, model-router/SKILL.md, AGENTS.md, both CLAUDE.md files, repos.sh, sessions.sh. GEMINI.md reverts to previous landing page builder content.

- Date: 2026-04-08
- Decision: Add Dance of Life Bible Studies transcription pipeline to the nightly scheduler.
- Context: The Bible Studies folder in Google Drive (synced nightly by `dance-of-life-sync`) contains ~38 series of video teaching content. To make this content queryable via Obsidian and NotebookLM without burning tokens, the content needs to be transcribed to text first.
- Impact: New pipeline at `tools/scripts/bible-studies-pipeline.sh` → `tools/scripts/bible-studies/pipeline.mjs`. Runs as chain member #5 (after `dance-of-life-sync`, before `gemini-cleanup`), 4-hour timeout, never stops chain. Uses `mlx-whisper` (model: `mlx-community/whisper-large-v3`) for max-quality transcription on Apple Silicon. Transcripts written to `personal/bible-studies/dance-of-life/[Series]/[NN-of-TT] - Title.md` — immediately visible in Obsidian. One `DOL - [Series]` NotebookLM notebook auto-created per series via `claude --print`. Pipeline is fully idempotent and detects new series/videos/folders dynamically on every run. `mlx-whisper` installed via `pipx` at `~/.local/bin/mlx_whisper`. ProBot dashboard updated with `bible-studies-pipeline` and `skill-prune` (was missing). `render-office-scheduler-report.sh` updated to include all 7 chain members (was only showing 3). Query pattern: Obsidian (Smart Connections) for local browse/search; Claude Code CLI → NotebookLM MCP for deep Q&A (~200–500 tokens per question, not per document).
- Rollback: Remove `run_bible_studies_pipeline` function and call from `office-nightly-scheduler.sh`. Remove `tools/scripts/bible-studies-pipeline.sh` and `tools/scripts/bible-studies/`. Remove `bible-studies-pipeline` and `skill-prune` entries from `SCHEDULER_JOB_ORDER` in `dashboard.ts`. Revert `render-office-scheduler-report.sh`. Remove `personal/bible-studies/dance-of-life/`. State file: `~/.local/state/bible-studies/state.json`.
- Date: 2026-04-09
- Decision: Add memory gate, cooldown, and CPU nice-level to bible-studies-pipeline to prevent kernel watchdog panics under sustained transcription load.
- Context: First run of the pipeline triggered a kernel panic (watchdog timeout, 66 swapfiles, 100% swap segments). Root causes: (1) mlx_whisper spawned 282 times back-to-back with no pause, each loading the 3 GB whisper-large-v3-mlx model fresh; (2) no memory check before spawning; (3) wrong model ID (`whisper-large-v3` → `whisper-large-v3-mlx`). HuggingFace token was also missing (`~/.cache/huggingface/token`).
- Impact: Pipeline now checks available RAM (free + speculative + purgeable + 50% inactive) before each mlx_whisper spawn; waits in 30 s intervals until ≥ 4 GB is available (max 30 min). Runs mlx_whisper at nice 10. 5-second cooldown after each transcription. State is written after each successful file so any interruption (crash, nightly timeout) auto-resumes on next run without re-transcribing completed files.
- Rollback: Remove `getAvailableMemoryGB`, `waitForMemory` functions from `pipeline.mjs`. Remove `await waitForMemory(4)` call and the 5 s sleep from the main loop. Change `spawnSync('nice', ['-n', '10', C.mlxBin, ...])` back to `spawnSync(C.mlxBin, [...])`.

- Date: 2026-04-10
- Decision: Adopt autoresearch as a strategic framework for autonomous optimization across all domains — skills, apps, UI, workflows, marketing, and business metrics.
- Context: Karpathy autoresearch is a proven loop: bounded scope + measurable metric + autonomous experiment cycle + keep/discard decisions. The pattern is general: anything measurable is improvable. The user recognized this applies far beyond LLM training: your skills can be optimized, your app endpoints can be optimized, your marketing copy can be optimized, your business model can be optimized.

- Date: 2026-04-10
- Decision: Adopt awesome-design-md as the default design tool for all web UI work. Stitch MCP is demoted to explicit-only fallback.
- Context: awesome-design-md (plain-text DESIGN.md files) is 70% cheaper (token-wise) than Stitch MCP, works with any AI agent (Claude, Codex, Gemini), has zero setup overhead (copy one file), and provides design systems extracted from real brands (Linear, Stripe, Apple, Vercel, etc.). User builds SaaS, landing pages, and faith-based websites (all Next.js + Tailwind + shadcn/ui). Need consistent, branded, beautiful UI without vendor lock-in or MCP overhead.
- Impact: (1) New `/design-system` skill installed at `ai/skills/custom/design-system/SKILL.md` to orchestrate picks + installs. (2) Design systems library created at `ai/design-systems/` with 30+ brand systems catalogued. (3) prochat.tools is first project to receive a custom DESIGN.md (extracted from actual brand tokens: Host Grotesk, #4c6fff blue, #0b1220 dark navy, 650ms motion). (4) prochat.tools DESIGN.md lives in both `ai/design-systems/custom/prochat-tools/` (canonical in brain) and `prochattools/web/prochat/` (active in project). (5) All-tools support: Claude Code uses `/design-system` skill, Codex reads DESIGN.md from AGENTS.md, Gemini Flash preprocesses DESIGN.md + brief. (6) Stitch fallback documented: explicit-only, never use unless requested.
- Rollback: Remove `/design-system` skill symlink from `ai/skills/active/`. Delete `ai/design-systems/` folder. Remove DESIGN.md from prochat.tools project root. Remove `/design-system` from CLAUDE.md skills list. Revert to Stitch MCP as default.
- Reference: `ai/design-systems/README.md` (AI-agnostic guide), `ai/design-systems/library.md` (full catalog), `ai/skills/custom/design-system/SKILL.md` (Claude Code skill).
- Impact: New `/autoresearch` skill added at `ai/skills/custom/autoresearch/SKILL.md`. New runbook at `operations/runbooks/autoresearch-strategy.md` with full domain catalog (6 domains), per-domain templates, cost structure, and integration with brain's model-routing system. Skill is live in Claude Code (symlinked to active/). Available in any session for any optimization task that has a metric and a scope. Becomes the standard framework for continuous improvement across all systems.
- Rollback: Remove `ai/skills/active/autoresearch` symlink, delete `ai/skills/custom/autoresearch/SKILL.md`, delete `operations/runbooks/autoresearch-strategy.md`, remove `/autoresearch` from CLAUDE.md available skills list.
## 2026-04-11 — Google Ads nonprofit account boundary and control plane

- The `brain` Google Ads automation system is nonprofit-only for now and is scoped to the Yeshua Academy Google Ad Grants account.
- `steve@yeshua.academy` is the only approved Google account for Google Ads Manager access, Google Ads API setup, OAuth client creation, and Google Cloud work related to Google Ads.
- The canonical local `gcloud` config for Google Ads work is `google-ads-nonprofit`.
- The automation architecture is AI-agnostic: Claude, Codex, and Gemini must all use the same docs, config, CLI, local SQLite state, and markdown reports.
- The customer-owned manager account is `Yeshua Academy Google Ads Manager (935-769-8503)`, linked to client account `592-920-2435`.
- Google Ads secrets live only in local files under `~/.config/google-ads/` and ADC under `~/.config/gcloud/`; the repo stores only status and file-path conventions.

- Date: 2026-04-15
- Decision: Standardize Dokploy Next.js apps on standalone output with a slim runtime image.
- Context: Via di Eden was still shipping a full `node_modules` tree into the runtime image, producing a ~4.97 GB container and long Swarm rollout times. A local Docker build showed the standalone variant reduces the image to ~400 MB while keeping `/api/health` healthy. The Dokploy application is still source-deployed with `buildType: dockerfile`, so full GitHub-built image publishing would require a separate app-model migration.
- Impact: The shared Dockerfile standard now recommends `output: 'standalone'`, `COPY .next/standalone`, `COPY .next/static`, and `CMD ["node", "server.js"]` for Next.js apps. This should be copied into all new and existing prochattools apps that still carry a full runtime `node_modules` layer.
- Rollback: Restore the old runtime image pattern with `COPY /app/node_modules` and `npm run start`, or revert the app back to a non-standalone Next.js build if a dependency truly requires it.

- Date: 2026-04-15
- Decision: Migrate Dokploy apps from source-deployed (Dokploy builds the Dockerfile on the VM) to image-based deployment (GitHub Actions builds and pushes to GHCR, Dokploy only pulls).
- Context: Dokploy VM (Azure vm-dokploy, 4 vCPU / 15 GB RAM) was running full npm ci + next build on every deploy. With standalone output, images are ~400 MB, but the build itself still consumed VM resources for 5–15 min per deploy and blocked concurrent deploys. Moving the build to GitHub Actions (ubuntu-latest) offloads all CPU/RAM pressure from the VM and enables BuildKit layer caching (type=gha), reducing warm builds to 1–3 min. Dokploy then only runs a fast docker pull + container swap (~30–60 sec).
- Impact: (1) New workflow template at operations/deploy/dokploy-image-deploy.yml — copy to .github/workflows/deploy.yml in each app repo; (2) images pushed to GHCR (ghcr.io) using built-in GITHUB_TOKEN — no registry cost; (3) Dokploy reads from GHCR via a read-only PAT registered once in Dokploy Settings → Registry; (4) NEXT_PUBLIC_* vars move from Dockerfile ENV to GitHub Actions build-args + GitHub repo variables; (5) all runtime env vars (Prisma, Stripe, New Relic) remain in Dokploy env section unchanged; (6) pilot app: via-di-eden; (7) dockerfile-standard.md updated with image-based flow section.
- Rollback: (1) In Dokploy app → General → Source: switch back from Docker Image to GitHub (Dockerfile); (2) delete .github/workflows/deploy.yml from the app repo; (3) existing Dockerfile remains valid for source-deployed builds.

- Date: 2026-04-27
- Decision: Establish BuildFlow as a managed relay service on Dokploy following the image-based deployment pattern.
- Context: BuildFlow v1.2.0-beta has a hardened multi-user relay that can be deployed on Dokploy. BuildFlow should remain ONE product to users, but infrastructure-wise it consists of relay (3053) and web (3054) services. Current local BuildFlow works perfectly; production relay should be deployed in parallel as an opt-in surface. Local-to-production migration is phased so local remains primary until production is validated. This follows the same infrastructure discipline as prochattools apps.
- Implementation: (1) Created `operations/runbooks/buildflow-deployment.md` documenting phase-based migration (Phase 0: local only → Phase 5: production primary). (2) Added BuildFlow to `operations/infrastructure/infra.md` Dokploy project list (Web project) and domain inventory (`buildflow.prochat.tools`). (3) Added BuildFlow to `operations/runbooks/dokploy.md` app inventory table. (4) No Dokploy mutations performed yet (read-only discovery only). (5) BuildFlow remains LOCAL in ProBot; no dashboard changes made yet. (6) Deployment runbook includes rollback plan, verification checklist, troubleshooting, and security constraints (RELAY_ADMIN_TOKEN, token-scoped routing, no device ID exposure).
- Rationale: BuildFlow is a new service requiring Dokploy integration. The same pattern used for ProChat, Says the Bible, etc. (image-based deployment, GHCR pull, persistent volumes) applies cleanly. Phased migration de-risks the transition by keeping local BuildFlow as fallback. Documentation-first approach allows next prompt to create Dokploy application without discovery work.
- Next: Provision BuildFlow Dokploy application in Web project, configure GHCR pull credentials, set environment variables, create GitHub Actions workflow, and perform end-to-end verification (Phase 1-2).
- Rollback: Delete BuildFlow app from Dokploy (preserves volume). Revert Brain docs to remove BuildFlow references. Local BuildFlow continues unchanged. Production domain is freed or parked.

- Date: 2026-04-27 (Phase 1 Verification — BLOCKER IDENTIFIED)
- Decision: Phase 1 provisioning paused — BuildFlow Dockerfile does not support production topology.
- Context: Docker architecture verification (2026-04-27) revealed current Dockerfile only builds relay (packages/bridge) on port 3053. Production topology documented in Brain requires: (1) single container exposing port 3054 as public entry; (2) internal proxy routing to relay (3053) and web (3054); (3) both relay and web services built and started inside container; (4) proxy handles /api/* routing and WebSocket upgrades. Current Dockerfile is insufficient for single-app deployment.
- Implementation: (1) Verified BuildFlow repo structure: packages/bridge (relay), apps/web (Next.js). (2) Analyzed current Dockerfile: builds only relay, exposes 3053 only, no web app or proxy. (3) Created `operations/standards/buildflow-dockerfile-contract.md` documenting exact blocker, requirements, implementation options (Option C: Node.js proxy recommended), multi-stage build pattern, routing rules, health checks, and testing checklist. (4) Updated `operations/runbooks/buildflow-deployment.md` section "Internal Container Architecture" to replace "Assumption" with "⚠️ BLOCKER" and detailed fix requirements. (5) No Dokploy mutations performed; local BuildFlow untouched; Brain docs marked Phase 1 as PAUSED.
- Rationale: Deploying incomplete Dockerfile to production would create broken candidate surface. Better to identify architecture blocker early and document exact contract so BuildFlow maintainer can implement correct topology. Dockerfile contract provides clear checklist (multi-stage build, proxy setup, routing rules, local testing steps).
- Next: BuildFlow repo maintainer (future session) updates Dockerfile per contract in buildflow-dockerfile-contract.md. Once image is verified locally to support full topology (relay + web + proxy on 3054 with proper routing and WebSocket support), re-trigger Phase 1 provisioning in Brain repo.
- Rollback: No rollback needed; no Dokploy mutations performed. Brain docs updated to mark blocker; can delete blocker-related docs and resume provisioning once Dockerfile is ready.

- Date: 2026-04-27 (Dockerfile Blocker Resolved)
- Decision: BuildFlow Dockerfile topology blocker resolved; Phase 1 Dokploy provisioning may proceed.
- Context: BuildFlow commit 3473303 implements the full production topology: proxy on 3054 (public), relay on 3053 (internal), web on 3055 (internal). Image was verified locally via docker run -p 4054:3054 with all endpoints returning correct status codes and JSON responses (/ready 200, /health 200, /api/openapi 200, /api/register 201, /api/admin/devices protected). GHCR image ghcr.io/stevewesthoek/buildflow:latest is available and built from this commit.
- Implementation: (1) Updated `operations/runbooks/buildflow-deployment.md` BLOCKER section from ⚠️ to ✅ with verified components and commit reference. (2) Updated `operations/standards/buildflow-dockerfile-contract.md` status to "IMPLEMENTED AND VERIFIED (commit 3473303)". (3) Marked Phase 1 status as "READY FOR DOKPLOY PROVISIONING". (4) No changes to local BuildFlow or ProBot dashboard. (5) Brain docs ready for Phase 1 provisioning handoff.
- Rationale: Dockerfile contract was thorough and BuildFlow implementation met all requirements. Local verification confirms topology is production-ready. Phase 1 can now proceed with GHCR image pull and Dokploy application creation.
- Next: Phase 1 Dokploy provisioning — create BuildFlow app in Web project, configure GHCR pull credentials, set environment variables, deploy, and verify endpoints.
- Rollback: Not applicable; Dockerfile blocker is resolved and docs are updated. If Phase 1 provisioning fails, address specific Dokploy issue and retry.
## 2026-05-07 — RTK adopted for AI shell-output token optimization

- Decision: Install RTK globally and integrate it as the default shell-output compression layer for Claude Code, Codex, and Gemini CLI sessions.
- Reason: Shell-heavy AI coding loops waste model context on noisy CLI output; RTK reduces output tokens while preserving useful status, diff, test, build, and search signals.
- Impact: Claude Bash commands now pass through `rtk-safe-bash-hook.sh`, which runs the existing risky-command guard before RTK rewrite. Gemini uses an RTK `BeforeTool` hook. Codex has an RTK awareness file and instructions to prefix noisy commands with `rtk`. Rollback is documented in `operations/runbooks/rtk.md`.
