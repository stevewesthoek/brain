# Decision Log

Lightweight record of infra/structure decisions that affect the Brain repo.

## Format
- Date:
- Decision:
- Context:
- Impact:
- Rollback:

## Entries

- Date: 2026-08-14 (Two-Route Office SSH Policy)
- Decision: Standardize MacBook-to-Office connectivity on exactly two canonical routes: direct Thunderbolt when the cable route is reachable, otherwise Tailscale. Codex exposes only `office-repos-tb` (`Office Thunderbolt`) and `office-repos-ts` (`Office Tailscale`); the former `office-repos-lan`/mDNS profile is retired.
- Context: Tailscale remains available over home Wi-Fi, mobile/5G, hotspot, Ethernet, or another internet underlay. A separate home-LAN identity duplicated the Tailscale fallback, introduced a third connection choice, and depended on local name resolution without adding a required transport.
- Impact: The tracked SSH config, ownership contract, validators, Host Activation acceptance checks, and Codex connection state all use the same two-route topology. No DHCP address or `.local` hostname is canonical. Projects assigned to the retired LAN profile must be reassigned to `office-repos-ts` before that profile is removed so no project reference is lost.
- Verification: Validate both fixed aliases with strict host-key checking; confirm `office` remains Thunderbolt-first with Tailscale fallback; confirm Codex lists only Office Thunderbolt and Office Tailscale and can open an Office repository through each applicable route.
- Rollback: Preserve the pre-change Codex global-state files and repository commit. If Codex loses project visibility, quit Codex, restore the owner-only state backup atomically, and return both hosts to the prior repository commit before reopening the app. Do not delete the backup during the observation window.

- Date: 2026-08-12 (Workstation Config Ownership + Codex Generated Copy)
- Decision: Preserve the 2026-07-22 short physical `~/.codex` runtime-root fix for Codex Remote SSH, but change `~/.codex/config.toml` from an entry-level symlink to a mode-0600 physical generated copy whose canonical non-secret source remains in Brain. Standardize all workstation configuration under `SYMLINK`, `GENERATED-COPY`, `INCLUDE`, or `LOCAL-ONLY`; whole mutable Claude/Cursor/Gemini/Kiro/Codex runtime roots are forbidden as Git-backed symlinks.
- Context: The M1 MacBook Codex app previously failed to open repositories on the Office Mac mini because a whole-directory `~/.codex` symlink resolved `$CODEX_HOME/app-server-control/app-server-control.sock` to a 114-byte path, beyond macOS's 103-byte Unix-domain socket limit. The successful fix was the short physical runtime root, not reliance on a symlinked `config.toml`. The 2026-08-12 workstation audit also showed whole IDE/LLM runtime-root symlinks mix durable configuration with sessions, auth, logs, caches, locks, history and databases.
- Impact: Brain remains the Git authority for reproducible non-secret configuration. Codex Remote SSH continues to use the Office Mac's short physical `~/.codex` runtime root; `config.toml` is generated atomically from Brain. Existing Codex sessions/auth/SQLite/plugins/Computer Use state remain local. Git and SSH move toward native `Include` roots; SSH private keys and `known_hosts` stay local. Office↔MacBook migration requires Thunderbolt/Tailscale/Wi-Fi route inventory plus end-to-end Codex Remote SSH acceptance before old runtime-root residue can be removed.
- Verification: `node tools/validate-workstation-config-ownership.mjs`; `bash operations/scripts/codex-home-managed-root.sh check`; verify `$CODEX_HOME/app-server-control/app-server-control.sock` resolves within 103 bytes; verify existing Codex sessions/MCP/plugins/Computer Use; verify `ssh -G office`, `ssh -G MacBook`, and one end-to-end Codex Mac app Remote SSH task from the MacBook to the Office Mac after host migration.
- Rollback: Host migration remains separately authorized and receipt-backed. On Codex failure, quit Codex, restore the exact preserved runtime-root/config backup, and rerun the pre-migration Remote SSH path. Do not delete backups until multiple local and remote sessions succeed.

- Date: 2026-07-22 (Codex Managed Runtime Root)
- Decision: Replace the whole-directory `~/.codex` → Brain symlink with a real, short, machine-local `~/.codex` runtime directory. Symlink only `AGENTS.md`, `config.toml`, `RTK.md`, `rules/default.rules`, and `skills/user` to canonical Brain sources.
- Context: Codex Remote SSH reached and authenticated to the M4 Mac Mini but the remote app server failed to create `$CODEX_HOME/app-server-control/app-server-control.sock`. Resolving the legacy symlink produced a 114-byte pathname, exceeding macOS's 103-byte Unix-domain socket pathname limit. The whole-directory link also caused mutable Codex runtime state to write into the Git checkout.
- Impact: `operations/scripts/codex-home-managed-root.sh` owns guarded check, repair, migration, and rollback behavior; `brain-configs-link.sh` delegates Codex handling to it and never silently migrates a legacy link. Runtime content such as authentication, sessions, databases, plugins, caches, Computer Use, system skills, and sockets stays physically under `~/.codex`. Portable configuration remains version-controlled through entry-level symlinks. This supersedes only the Codex whole-directory portion of the 2026-06-18 MCP centralization decision; centralized MCP configuration remains unchanged.
- Verification: Run `operations/scripts/tests/codex-home-managed-root.test.sh`, then `operations/scripts/codex-home-managed-root.sh check`. After the guarded live migration, verify local Codex state and one end-to-end Remote SSH connection from the M1 MacBook.
- Rollback: Quit Codex and run the helper's guarded `rollback` command with the exact preserved `original-codex-home` path. The migrated real directory is retained as `failed-codex-home-<timestamp>`; nothing is deleted.

- Date: 2026-05-07 (Design System v2)
- Decision: Full 14-skill design orchestrator unifying impeccable, taste-skill, soft-skill, redesign-skill, design-motion-principles, web-design, huashu-design, design-consultation, design-system, plan-design-review, design-review, output-skill, ui-ux-pro-max, and impeccable sub-commands (teach, shape, craft, document, critique, audit, polish, bolder, quieter, distill, harden, onboard, clarify, typeset, colorize, layout, adapt, optimize, overdrive, live) under one `/design` natural-language entry point
- Context: After installing impeccable (25.7k stars), the design system grew to 14 distinct skills across 3 vendors. No single orchestrator covered all of them. Users could not remember skill names, command sub-sets, or ordering. The system needed one entry point that acts as a black box: user describes the goal in plain English, orchestrator routes to the right skills in the right order.
- Impact: Rewrote /design orchestrator to: (1) incorporate impeccable's PRODUCT.md gate (teach) and DESIGN.md document command into context setup; (2) add impeccable shape as UX brief step A4; (3) integrate impeccable critique + audit into all QA phases alongside design-review; (4) add impeccable harden/clarify/onboard as mandatory production hardening step A9; (5) map all 20+ impeccable sub-commands to specific workflow stages in the natural language routing table; (6) incorporate impeccable's absolute bans (side-stripe borders, gradient text, glassmorphism as default, hero-metric, identical card grids, modal as first thought, em dashes) into standing design laws; (7) add color strategy axis (Restrained/Committed/Full palette/Drenched) and physical scene sentence for dark/light choice; (8) add two-order AI slop test and brand/product register classification; (9) integrated intensity defaults table by project type; (10) added natural-language → routing table for direct sub-skill access without going through full workflow.
- Rationale: One entry point eliminates all cognitive overhead. All skills become black boxes. User only needs to describe the goal.
- Rollback: Revert /design SKILL.md to previous version (still in git history).

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

- Date: 2026-05-30 (Gemini API Quota Safeguard)
- Decision: Reduce mind-project-decomposer polling interval from 5 minutes to 15 minutes to safeguard Gemini free-tier quota.
- Context: Automated quota audit revealed that mind-project-decomposer.py runs every 5 minutes (288 cycles/day) and calls Gemini for each project with `status: ready-for-review`. If multiple projects accumulate in this state (common during development/testing), quota exhausts rapidly: 5 stuck projects = 1,440 calls/day (96% of 1,500 free-tier daily limit), leaving no margin for video analyzer or other analysis tools. Video analyzer is core research infrastructure and must have quota buffer. Free tier is sufficient for all use cases if polling is optimized.
- Impact: (1) Crontab entry updated: `*/5 * * * * mind-project-decomposer.py` → `*/15 * * * * mind-project-decomposer.py` (3× reduction in polling frequency); (2) Daily quota impact: worst-case drops from 1,440 calls (96%) to 960 calls (64%), leaving 35% buffer for video analyzer and other tools; (3) Project decomposition responsiveness remains adequate: 4× per hour (vs 12× per hour at 5-min), still decomposing stuck projects within 3.75 minutes on average; (4) Created runbook `operations/runbooks/gemini-quota-management.md` documenting quota consumers, reset schedule, monitoring, and safeguards; (5) Free tier remains sufficient with zero cost — no upgrade to paid tier needed.
- Rationale: 15-minute interval balances three constraints: (1) safe quota consumption even with worst-case stuck projects, (2) adequate responsiveness for project decomposition (4× per hour is sufficient), (3) quota buffer for video analyzer (the primary research tool). At 5-min polling, quota is fragile and easily exhausted; at 15-min, even 10 stuck projects + heavy video use (100 calls) totals only 1,060 calls (70%), leaving 30% safety margin.
- Alternatives Considered: (1) 5-minute (current): unsafe, no buffer for video analyzer; (2) 1-hour: too slow for project responsiveness; (3) Paid tier: unnecessary at 15-min interval, adds cost with no benefit; (4) Disable decomposer: breaks project decomposition workflow.
- Monitoring: (1) Check decomposer activity: `tail ~/.local/share/brain/logs/project-decomposer.log` (should show "No project files ready" or "Decomposed N project(s)"); (2) Check for stuck projects: `grep -r "status: ready-for-review" ~/Repos/stevewesthoek/mind/03-projects/` (should be empty); (3) Check video analyzer usage: `cat ~/.local/video-orchestrator/state/gemini-rate-limits.json`; (4) Verify crontab: `crontab -l | grep mind-project-decomposer` (should show `*/15`).
- Rollback: Revert crontab entry to `*/5 * * * * ...` if decomposition responsiveness proves insufficient. However, this will require active management of stuck projects to prevent quota exhaustion.

- Date: 2026-06-18 (MCP Centralization — One Way of Working)
- Decision: Unified, centralized MCP server configuration across all IDEs and LLMs (Claude Code, Codex, Gemini, Kiro, Cursor, Antigravity). Single authentication method (gcloud ADC) for all tools. Format-specific templates per tool. One source of truth.
- Context: MCP servers were previously scattered across tools with three different config formats, inconsistent documentation, and no unified authentication. Stitch MCP specifically had: (1) Claude Code: JSON config in `~/.claude.json`; (2) Codex: TOML in `~/.codex/config.toml`; (3) Antigravity: JSON in `~/Library/Application Support/Antigravity/User/mcp.json` with HTTP headers; (4) Gemini: explicitly documented as "not supported"; (5) Kiro/Cursor: no documented setup. No single registry, no automation, no clear "one way of working." Multiple conflicting documentation sources created confusion and maintenance burden. Decision: centralize all MCP configuration with one authentication mechanism, separate concerns by tool format (JSON for Claude/Kiro/Cursor, TOML for Codex, HTTP JSON for Antigravity), one master registry, automated setup scripts, unified documentation.
- Impact: (1) Created canonical MCP registry at `operations/system-configs/mcp/` with master setup docs: README.md, MASTER-MCP-SETUP.md, QUICK-REFERENCE.md, STITCH-CENTRALIZED-SETUP.md; (2) Stitch configuration: all tools use single authentication method `STITCH_API_KEY = "gcloud-adc"` (sentinel value, not a secret — proxies to gcloud ADC in `~/.stitch-mcp/`); (3) Unified templates for all IDEs: `stitch/claude-code-config.template.json`, `codex-config.template.toml`, `kiro-config.template.json`, `cursor-config.template.json`, `mcp-http-config.template.json`; (4) Automated setup scripts: `setup-stitch-all-ides.sh` and `verify-stitch-all-ides.sh` (Kiro/Cursor now fully automated via CLI instead of UI-only); (5) Symlink pattern: Codex config symlinked from `~/.codex` → `brain/operations/system-configs/codex`; Antigravity config symlinked from app directory → centralized ignored file at `brain/operations/system-configs/antigravity/User/mcp.json`; (6) Updated GEMINI.md to reflect Stitch automatic availability via context-mode (corrected outdated "not supported" claim); (7) Updated status tables in all MCP docs to show current state: Claude Code ✅, Codex ✅, Kiro ✅ (automated), Cursor ✅ (automated), Antigravity ✅, Gemini CLI ✅ (automatic); (8) Verification: `verify-stitch-all-ides.sh` confirms all critical checks pass (12 passed, 0 failed); (9) Fully AI-agnostic and IDE-agnostic: same pattern works identically on Claude Code, Codex, Gemini CLI, all IDEs; (10) Format-specific: JSON for tools expecting it, TOML for Codex, HTTP for Antigravity — one source, multiple formats.
- Rationale: "One way of working" with format variations per tool eliminates maintenance burden, enables automated distribution, allows new tools to plug in following the established pattern, and ensures all AI engines have consistent, verified access to MCP servers. Centralization at `operations/system-configs/mcp/` makes setup discoverable and reduces cognitive load. Single authentication method (gcloud ADC) avoids storing secrets in tracked files. Automated setup scripts remove manual steps and human error.
- Related Decision: `mem-project-007` (CLI Manifest) — same principle applied to CLIs; same principle applies to MCP servers.
- Rollback: (1) Revert Gemini docs back to "not supported" claim; (2) Delete `operations/system-configs/mcp/MASTER-MCP-SETUP.md`, `QUICK-REFERENCE.md`, `STITCH-CENTRALIZED-SETUP.md` (keep README.md, stitch/README.md, templates, scripts as they were pre-existing); (3) Revert Kiro/Cursor setup logic in `setup-stitch-all-ides.sh` to UI-based warnings only; (4) Revert status tables in all MCP docs to ⚠️ Pending for Kiro/Cursor; (5) All MCP infrastructure remains functional — this decision only affects presentation/organization/automation, not core functionality.
- Verification: (1) Run `bash operations/system-configs/mcp/stitch/verify-stitch-all-ides.sh` — should pass all critical checks; (2) Check that all IDEs see Stitch in `mcp list` output; (3) Verify symlinks: `ls -la ~/.codex`, `ls -la ~/Library/Application\ Support/Antigravity/User/mcp.json`; (4) Test Stitch invocation in each IDE.

- Date: 2026-06-18 (MCP Centralization — Gemini CLI Configuration)
- Decision: Populate Gemini CLI's `~/.gemini/config/mcp_config.json` with Stitch MCP configuration (was previously empty)
- Context: Claude Code UI indicated "Not forwarded to: Codex CLI · Gemini CLI." This is correct architecture — each tool reads from its own config file. However, Gemini's `mcp_config.json` was completely empty (0 bytes), meaning Gemini had no MCP servers configured. Codex was already properly configured in `~/.codex/config.toml`. Gemini needed the same Stitch config added to its own file.
- Impact: (1) Populated `~/.gemini/config/mcp_config.json` with Stitch MCP configuration (stdio proxy mode, gcloud ADC auth); (2) Mirrored config to brain: `operations/system-configs/gemini/config/mcp_config.json` now contains canonical Gemini MCP config (tracked in git); (3) Updated all Stitch documentation: README.md, STITCH-CENTRALIZED-SETUP.md status tables now show Gemini as "Active (now centrally configured)" instead of "Automatic via context-mode"; (4) All six tools now have Stitch configured with identical auth method (gcloud ADC) across different config formats: Claude Code (JSON), Codex (TOML), Gemini (JSON), Kiro (JSON), Cursor (JSON), Antigravity (HTTP JSON).
- Rationale: "One unified way of working" requires all tools to be configured, not just most of them. Gemini is a core member of the unified AI system and must have equal access to Stitch. Empty config file was likely a bootstrap issue (Gemini CLI created the file but never populated it). By populating it from the canonical template and tracking it in brain, we ensure Gemini is never left behind in future MCP server updates.
- Verification: (1) Check Gemini config: `jq '.mcpServers.stitch' ~/.gemini/config/mcp_config.json` — should match Claude Code and Codex (same auth, different format); (2) Compare all three: Claude (JSON), Codex (TOML), Gemini (JSON) all have `STITCH_API_KEY = "gcloud-adc"` and stdio proxy setup; (3) Check brain copy: `cat operations/system-configs/gemini/config/mcp_config.json` — should match home copy.

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
- Decision: Implement real-time model tracking system with dynamic status line visibility into Claude Code's automatic model selection.
- Context: Claude Code's automatic model selection escalates from Haiku → Sonnet → Opus based on task complexity, but these decisions were invisible to the user. No way to see when expensive models (Sonnet ~5× cost, Opus ~25× cost) are running or why. Users couldn't correlate task cost with actual model choices.
- Impact: (1) Status line now displays active model + reason badge + agent name (e.g., "sonnet ↑ (complex) [coder-default]"); (2) Reason badges signal cost (↑ = escalation, ↑↑ = high blast-radius, ⊙ = plan, ◊ = review, ⚙ = preprocessing); (3) Three hooks (UserPromptSubmit, PostToolUse/Agent, Stop) detect mode changes and update ~/.claude/model-tracking.json in real-time; (4) Automatic reset to Haiku between independent tasks maintains cost discipline; (5) Full documentation: operations/runbooks/model-tracking.md (ops), docs/model-tracking-reference.md (user reference), operations/model-tracking-visual-guide.md (architecture); (6) Validation script passes all 12 checks.
- Rationale: Transparency into model selection enables users to (a) understand why expensive models are necessary, (b) track cost per task without guessing, (c) debug whether cheaper tiers could work, (d) learn which task types naturally escalate. Badges serve as real-time cost signals.
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
- Decision: Retire the OpenClaw Claude bridge and AWS OpenClaw host, and standardize on the local Telegram daemon running on the `Office` Mac.
- Context: The OpenClaw VPS and bridge had become redundant after moving to a local-first workflow around Claude, Codex, and Brain. The user wanted Telegram access without ongoing AWS cost or bridge maintenance.
- Impact: The AWS OpenClaw Lightsail instance and snapshots are deleted, the local bridge LaunchAgent and logs are removed, and the local Telegram control surface is now the only always-on control surface documented in Brain.
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
- Decision: Deploy New Relic Standard (nonprofit) across the full infra stack — 3 servers, 12 apps, PostgreSQL, Docker logs, 11 synthetic monitors, and a dashboard widget.
- Context: No observability existed beyond 7 Azure VM-level metric alerts. xGrow was in silent error state, n8n workflow failures were invisible, and there was no APM on any app.
- Impact: All three Linux servers report via infra agents (EU region, account 7019441). All 12 Dokploy Node.js apps have NR APM via `NODE_OPTIONS=--require newrelic`. Docker container logs forward via fluent-bit. PostgreSQL monitored via `newrelic_monitor` read-only role. Synthetics check all public URLs every 5 min. The dashboard shows live server health and uptime dots.
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
- Impact: Three-engine routing policy in routing.md. ~/.gemini was already symlinked to brain/operations/system-configs/gemini/. GEMINI.md replaced with global instructions. /gemini skill added at ai/skills/custom/gemini/. gemini-review.sh wrapper at tools/. repos.sh and sessions.sh updated to include Gemini as third option. AGENTS.md, routing policy docs, and both CLAUDE.md files updated. Cost priority: Gemini Flash (free) > Haiku > Codex mini > Sonnet > Codex standard > Opus.
- Rollback: Remove ai/skills/active/gemini symlink, ai/skills/custom/gemini/, tools/gemini-review.sh. Revert routing.md, AGENTS.md, both CLAUDE.md files, repos.sh, sessions.sh. GEMINI.md reverts to previous landing page builder content.

- Date: 2026-04-08
- Decision: Add Dance of Life Bible Studies transcription pipeline to the nightly scheduler.
- Context: The Bible Studies folder in Google Drive (synced nightly by `dance-of-life-sync`) contains ~38 series of video teaching content. To make this content queryable via Obsidian and NotebookLM without burning tokens, the content needs to be transcribed to text first.
- Impact: New pipeline at `tools/scripts/bible-studies-pipeline.sh` → `tools/scripts/bible-studies/pipeline.mjs`. Runs as chain member #5 (after `dance-of-life-sync`, before `gemini-cleanup`), 4-hour timeout, never stops chain. Uses `mlx-whisper` (model: `mlx-community/whisper-large-v3`) for max-quality transcription on Apple Silicon. Transcripts written to `personal/bible-studies/dance-of-life/[Series]/[NN-of-TT] - Title.md` — immediately visible in Obsidian. One `DOL - [Series]` NotebookLM notebook auto-created per series via `claude --print`. Pipeline is fully idempotent and detects new series/videos/folders dynamically on every run. `mlx-whisper` installed via `pipx` at `~/.local/bin/mlx_whisper`. `render-office-scheduler-report.sh` updated to include all 7 chain members (was only showing 3). Query pattern: Obsidian (Smart Connections) for local browse/search; Claude Code CLI → NotebookLM MCP for deep Q&A (~200–500 tokens per question, not per document).
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
- Implementation: (1) Created `operations/runbooks/buildflow-deployment.md` documenting phase-based migration (Phase 0: local only → Phase 5: production primary). (2) Added BuildFlow to `operations/infrastructure/infra.md` Dokploy project list (Web project) and domain inventory (`buildflow.prochat.tools`). (3) Added BuildFlow to `operations/runbooks/dokploy.md` app inventory table. (4) No Dokploy mutations performed yet (read-only discovery only). (5) BuildFlow remains LOCAL; no dashboard changes made yet. (6) Deployment runbook includes rollback plan, verification checklist, troubleshooting, and security constraints (RELAY_ADMIN_TOKEN, token-scoped routing, no device ID exposure).
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
- Implementation: (1) Updated `operations/runbooks/buildflow-deployment.md` BLOCKER section from ⚠️ to ✅ with verified components and commit reference. (2) Updated `operations/standards/buildflow-dockerfile-contract.md` status to "IMPLEMENTED AND VERIFIED (commit 3473303)". (3) Marked Phase 1 status as "READY FOR DOKPLOY PROVISIONING". (4) No changes to local BuildFlow or dashboard. (5) Brain docs ready for Phase 1 provisioning handoff.
- Rationale: Dockerfile contract was thorough and BuildFlow implementation met all requirements. Local verification confirms topology is production-ready. Phase 1 can now proceed with GHCR image pull and Dokploy application creation.
- Next: Phase 1 Dokploy provisioning — create BuildFlow app in Web project, configure GHCR pull credentials, set environment variables, deploy, and verify endpoints.
- Rollback: Not applicable; Dockerfile blocker is resolved and docs are updated. If Phase 1 provisioning fails, address specific Dokploy issue and retry.
## 2026-05-07 — RTK adopted for AI shell-output token optimization

- Decision: Install RTK globally and integrate it as the default shell-output compression layer for Claude Code, Codex, and Gemini CLI sessions.
- Reason: Shell-heavy AI coding loops waste model context on noisy CLI output; RTK reduces output tokens while preserving useful status, diff, test, build, and search signals.
- Impact: Claude Bash commands now pass through `rtk-safe-bash-hook.sh`, which runs the existing risky-command guard before RTK rewrite. Gemini uses an RTK `BeforeTool` hook. Codex has an RTK awareness file and instructions to prefix noisy commands with `rtk`. Rollback is documented in `operations/runbooks/rtk.md`.

- Date: 2026-05-08 (Phase 2 Local Video Generation: Stable Diffusion + Wave + FLUX.1-dev + Roop)
- Decision: Install and integrate four local AI models (SDXL, Wave, FLUX.1-dev, Roop) for smart, cost-free video/image generation. Create smart router skill to optimize model selection per task. All generation runs locally on Mac mini M4 Pro (24 GB) with zero platform costs.
- Context: User needs to generate talking heads, avatars, screen walkthroughs, and varied content at scale (50+ items/week) without invoking external paid platforms. Current workflow (Stable Diffusion only) lacks talking head capability and has no quality routing. Solution: local-first, multi-model pipeline with intelligent routing.
- Requirements (hard constraints):
  - Zero external platform costs (no Higgsfield, no APIs)
  - Local generation only (Mac mini M4 Pro 24 GB, 90% resources available at night)
  - Orchestrable via Claude Code/Codex (scripting only, no computation from AI engines)
  - Can be batch-scheduled at night with nightly scheduler
- Implementation: (1) Created `operations/runbooks/local-video-generation-setup.md` with full installation guide for all four models, thermal management, scheduling, and troubleshooting. (2) Created `/stable-diffusion-local` skill (fast images, 30–60s, 6–8 GB VRAM). (3) Created `/wave-local` skill (talking heads, 60–90s, 8–12 GB VRAM, best quality). (4) Created `/flux-local` skill (premium images, 2–4 min, 18–20 GB VRAM, schedule at night). (5) Created `/roop-local` skill (avatar/face synthesis, 30–120s, 4–8 GB VRAM). (6) Created `/video-generation-smart-router` skill (classify task intent, route to optimal model, schedule recommendations). (7) Updated `/video` orchestrator Workflow C to include C0 (smart model selection) before composition. (8) All skills symlinked to `ai/skills/active/`. (9) Integrated into video tool reference map with speed/quality/VRAM profiles.
- Routing Logic: SDXL for 95% of work (fast, batch-friendly), Wave for talking heads (best quality), FLUX for premium product/marketing (schedule at night), Roop for avatar consistency. Router handles classification and scheduling automatically.
- Performance Profile: SDXL 30–60s (good), Wave 60–90s (best), FLUX 2–4 min (premium, night only), Roop 30–120s (good). Total resources: 24 GB Mac handles all daytime + nightly batching.
- Thermal Impact: Sustained 85% CPU nightly reduces Mac lifespan by ~0.5–1 year over 7-year typical lifespan (acceptable). Mitigations: ensure ventilation, run at 80–85% not 90%, monitor temps (<75°C sustained).
- Phase Placement: Phase 2 of Video Orchestrator (after Phase 1 account/credential mgmt, before Phase 3 multi-platform routing). Models are production-ready today; integration is optional quality upgrade.
- Rationale: Local-first eliminates platform dependency and cost. Multi-model approach optimizes quality/speed per use case. Smart router ensures users get best output for minimal resources. All generation runs offline, respects hard constraints (zero external costs, only Claude/Codex orchestration).
- References: `operations/runbooks/local-video-generation-setup.md` (install + thermal guide), `ai/skills/custom/learned/{stable-diffusion,wave,flux,roop}-local/SKILL.md` (individual models), `ai/skills/custom/learned/video-generation-smart-router/SKILL.md` (routing logic), `ai/skills/custom/video/SKILL.md` (orchestrator integration).
- Rollback: (1) Remove symlinks from `ai/skills/active/` (5 symlinks); (2) Delete `ai/skills/custom/learned/{stable-diffusion,wave,flux,roop}-local/`, `ai/skills/custom/learned/video-generation-smart-router/`; (3) Delete `operations/runbooks/local-video-generation-setup.md`; (4) Revert `/video` orchestrator to previous Workflow C (remove C0 references); (5) All models remain installed but unused. Nothing destructive.

- Date: 2026-05-08 (Remotion Assessment)
- Decision: Do not incorporate Remotion into any active orchestrator. Defer to Phase 5+ of the Video Orchestrator as an optional experimental feature only.
- Context: Remotion is a React-based framework for programmatic video composition using web technologies (CSS, Canvas, SVG, WebGL). User assessed three integration points: (1) `/web` orchestrator (research/scraping/automation), (2) `/design` orchestrator (static design direction + motion planning), (3) `/video` orchestrator (video production pipeline). Assessment revealed Remotion is orthogonal to current workflows and adds no value to Phases 1–4.
- Reasoning:
  - **`/web` orchestrator:** Remotion is a video rendering tool, not a web/research/automation tool. Domains are completely orthogonal. No integration needed.
  - **`/design` orchestrator:** Remotion is a specialized rendering tool for procedural animations only (5% of design work). Current design workflow handles 95% of animation needs via Framer Motion + CSS. Adding Remotion to main routing would bloat the orchestrator for a rare use case. Separation of concerns: `/design` is for direction; Remotion is for rendering implementation.
  - **`/video` orchestrator Phase 1–4:** Current stack (FFmpeg, STB pipeline, n8n, Viral Flow) handles all needs. Rendering bottleneck is not composition (FFmpeg handles this fast); it's TTS + multi-platform posting. Remotion adds complexity without addressing the real constraints.
- Impact: No changes to active skills. No new routing logic. Remotion assessment documented for future reference.
- Bookmark: [Remotion docs](https://remotion.dev) with study focus on: (1) parameterization patterns (pass data → render variations), (2) serverless rendering (headless Chrome → S3), (3) React → MP4 pipeline architecture.
- Revisit: Phase 5+ of video orchestrator IF procedural/algorithmic animation becomes a core content pillar.
- Rollback: Not applicable; no active changes made.

- Date: 2026-05-08 (Video Orchestrator Roadmap + Remotion Phase 5 Reservation)
- Decision: Document Remotion as Phase 5+ experimental feature for Video Orchestrator; record in roadmap for future reference.
- Context: User articulated Video Orchestrator Phases 1–5 vision in mem-project-001: Phase 1 (account mgmt), Phase 2 (platform templates), Phase 3 (multi-platform routing), Phase 4 (series management), Phase 5 (full studio UI + automation). Remotion fits only Phase 5 if animated sequences become desired (e.g., animated intros, data visualizations, procedural graphics).
- Implementation: (1) Updated `operations/runbooks/video-orchestrator-roadmap.md` with Phase 5 subsection "Experimental Features": Remotion listed under "Animated Sequences" with status DEFERRED, bookmark link, and one-line rationale. (2) Added note to Workflow C (COMPOSE) in `/video` skill: "Phase 5: C1e (Animated sequences) — Remotion integration pending if procedural animation becomes core need." (3) No code changes; no skill routing changes; pure documentation.
- Rationale: Video Orchestrator roadmap is a living document. Recording Remotion here prevents rediscovery work and signals to future sessions that this assessment has been made and deferred consciously.
- Reference: `operations/runbooks/video-orchestrator-roadmap.md` Phase 5 section, `ai/skills/custom/video/SKILL.md` Workflow C notes.
- Rollback: Remove Remotion mention from roadmap and video skill if the assessment is revisited and reversed.


---

## 2026-05-16 — Obsidian-first Brain Core replaces the old dashboard as primary machine UI

**Decision:** Obsidian is the only target primary human dashboard for personal, business, machine, workflow, and orchestrator operation. The old dashboard is deprecated as a primary UI and should not receive new product features.

**Rationale:** The system needs one human cockpit but not one monolith. Obsidian already owns the human operating layer in `mind`; Brain owns machine logic, skills, configs, and automations. The old dashboard duplicated Obsidian's role and accumulated mixed responsibilities: UI, routing, local app controls, Video Orchestrator panels, status rendering, OAuth/account UI, and diagnostics.

**Direction:** Build a small local Brain Core API as the machine boundary. Obsidian consumes Brain Core through markdown dashboards first and a small `brain-console` Obsidian plugin later. Video Orchestrator remains the runtime authority for video production. Skills remain execution workflows. Slack and Telegram, if retained, become thin fallback clients over Brain Core.

**Documentation:**

- `docs/system/obsidian-brain-core-roadmap.md`
- `docs/system/obsidian-brain-core-implementation-plan.md`
- dashboard-freeze notice

**Guardrails:**

- Do not add new product dashboard features to the old dashboard.
- Do not put secrets, OAuth internals, direct platform uploads, broad shell execution, or runtime database writes into Obsidian.
- Reuse backend capabilities only for Slack/Telegram adapters, session ranking, local app lifecycle logic, approvals, and status adapters.
- Start Brain Core read-only before adding controlled actions.
- Keep the number of Obsidian dashboard notes small and human-oriented.

---

## 2026-05-16 — Obsidian-First Brain Core Direction

**Decision:** Obsidian is the only primary human dashboard for personal, business, machine, workflow, and orchestrator operation. The old dashboard is deprecated as a primary UI.

**Rationale:** The old dashboard duplicates the role Obsidian should own and has grown into a mixed-responsibility surface. The long-term foundation should use one human cockpit with a small local machine API underneath it, not multiple parallel dashboards.

**Target architecture:**

```text
Obsidian = cockpit
mind     = human memory, strategy, tasks, projects, research
brain    = machine logic, skills, configs, automations, local control
Brain Core = local API and safety boundary
orchestrators = durable domain runtimes
skills   = execution workflows
```

**Implementation direction:** Build a small local Brain Core service that exposes structured, safe APIs for machine status, sessions, repos, skills, local apps, approvals, and orchestrators. Obsidian will consume those APIs through minimal dashboards and later a small Obsidian integration/plugin.

**Dashboard rule:** Do not add new product dashboard features to the old dashboard. Reuse only clean backend capabilities during migration, such as Slack/Telegram adapters, session ranking, local app lifecycle logic, approvals, and selected status adapters.

**Canonical docs:**

- `docs/system/obsidian-brain-core-roadmap.md`
- `docs/system/obsidian-brain-core-implementation-plan.md`

---

## 2026-05-21 — Dashboard decommissioned; all tabs ported to Brain Console v2.2

**Decision:** The old dashboard is decommissioned as a product surface. All 11 dashboard tabs are now available in Brain Console (Obsidian plugin) via Brain Core API. Brain Console is the primary operating cockpit.

**Rationale:** As planned in `docs/system/obsidian-brain-core-roadmap.md`, Obsidian is the only primary human dashboard. The old dashboard was the last blocker. With all 11 tabs ported and tests covering all new infra routes, there is no remaining reason to maintain the old dashboard.

**Tabs migrated (11/11):**
- Sessions → Brain Console Sessions tab
- Scheduler → Brain Console Sessions tab
- Local Apps → Brain Console Apps tab (pre-existing)
- Dokploy → Brain Console Infra tab (`/infra/dokploy`)
- Tunnels → Brain Console Infra tab (`/infra/tunnels`)
- Domains → Brain Console Infra tab (`/infra/domains`)
- New Relic → Brain Console Monitoring tab (`/infra/monitoring`)
- Analytics/Umami → Brain Console Analytics tab (`/infra/analytics`)
- Google Ads → Brain Console Analytics tab (`/infra/google-ads`)
- Stripe → Brain Console Stripe tab (`/infra/stripe`)
- Studio (Viral Flow + Video Orchestrator) → Brain Console Studio tab (`/infra/studio`)

**Implementation:** Brain Console v2.2 deployed to mind vault. 8 new Brain Core infra adapters. 25 new infra route contract tests (551 total pass, 7 pre-existing failures unrelated to this change). `GET /health` endpoint added. Brain Core runbook updated with rollback path and infra health checks.

**Guardrails:**
- Do not add new features to the old dashboard.
- All data flows through Brain Core — Brain Console never calls external services directly.
- Infra adapters return `not-configured` gracefully when credentials are absent.
- Brain Core rollback does not use the old dashboard as fallback.

**Rollback:** Brain Core runbook at `operations/runbooks/brain-core.md`.

---

## 2026-05-22 — Video Orchestrator Stage 1 complete / Stage 2 first test / n8n CF Access blocker

**Context:** STB → Video Orchestrator migration work.

**Stage 1 complete:** Parity matrix v1.1 — all 13 STB stages mapped to real file locations in `stb-video-parity.ts`. Entries 7–11 upgraded from `planned` → `partial` with real STB script paths. Facebook (entry-12) and Pinterest (entry-13) entries added.

**Dead queue cleared:** 34 dead `post` jobs deleted from `video_orchestrator` DB. All failed with `Account X not found` — referencing deleted account IDs. Queue is clean.

**Stage 2 first test:** `normalize` job `23c87e1b` ran successfully on `genesis-noah-30m.mp4` (4K, 30min source). Produced 5 platform crops in `/tmp/vo_norm_genesis_noah/` — all valid. Confirmed normalize worker is functional.

**YouTube post test:** `post` job `fbe09ce7` queued to `@says-the-bible` (account `303e91f9`). Status: `succeeded` (DB), but adapter landed in `manual` mode — n8n webhook at `https://n8n.prochat.tools/webhook` returned HTTP 403 error code 1010 (Cloudflare ASN block).

**Root cause:** `VO_N8N_WEBHOOK_URL` points to CF-proxied domain. Worker has no `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET`. Cloudflare Access blocks the request.

**Fix applied (pending activation):**
1. `~/.local/video-orchestrator/worker/video_worker.py` — added CF Access header injection when `CF_ACCESS_CLIENT_ID` + `CF_ACCESS_CLIENT_SECRET` are set in env.
2. `~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist` — added placeholder keys `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET`.

**Required manual step:** Create a Cloudflare Access service token for the VO worker:
1. Cloudflare Zero Trust → Access → Service Auth → Service Tokens → Create token
2. Name: `video-orchestrator-worker`  
3. Copy Client ID + Client Secret
4. Replace `PLACEHOLDER_CF_ACCESS_CLIENT_ID` and `PLACEHOLDER_CF_ACCESS_CLIENT_SECRET` in `~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist`
5. Reload: `launchctl unload ~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist && launchctl load ~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist`
6. Test: `vo queue post --video /tmp/vo_norm_genesis_noah/landscape_1920x1080_16x9.mp4 --platform youtube --account 303e91f9 --title "Test"`

**Also needed:** YouTube OAuth token for `@says-the-bible` — even with n8n reachable, the adapter will fail if no OAuth token is stored in keychain or configured in n8n. The n8n workflow must have the YouTube OAuth credential wired.

**Guardrails preserved:** Brain Console and Brain Core remain read-only. No secrets in repo. Worker plist has placeholders, not real values.

---

## 2026-05-22 — Brain Console v2.12 / Overnight autonomous build session

**Context:** Autonomous overnight build — all phases completed without needing tokens, keys, or manual intervention.

### What was built

**Brain Core — 3 new adapters:**
- `infra-video-orchestrator-normalize-history.ts` — queries `jobs WHERE job_type='normalize'`, resolves output `.mp4` files from disk
- `infra-video-orchestrator-manual-queue.ts` — queries succeeded `post` jobs where `adapter_mode='manual'` or `status='draft'`, joins `accounts` table
- `infra-video-orchestrator-worker-config.ts` — reads worker plist XML, queries macOS keychain for YouTube OAuth accounts, does `curl` HEAD check on n8n webhook, builds `manualActionsRequired[]`

**Brain Core — 3 new routes** (in `api/routes.ts`):
- `GET /infra/video-orchestrator/normalize-history?limit=N`
- `GET /infra/video-orchestrator/manual-queue?limit=N`
- `GET /infra/video-orchestrator/worker-config`

**Brain Core — types** (`types/api.ts`): Added `dead?: number` to `BrainCoreInfraVOQueueDepth`; added 6 new interfaces for the 3 new adapters.

**Brain Core — production gate updated** (`video-orchestrator-production-gate.ts`): Replaced blocked `dualrun-no-execution` and `dualrun-comparison-blocked` items with real evidence: `dualrun-first-normalize` (ready — job 23c87e1b confirmed), `dualrun-first-post-manual` (in-progress — job fbe09ce7 manual mode), `dualrun-comparison-pending` (blocked — infra only, not code).

**Brain Core — parity matrix updated** (`stb-video-parity.ts`): `nextSafeTask` and `nextSteps` updated to reflect completed normalize and blocked post test. `blockers` reordered to lead with CF Access + YouTube OAuth.

**Brain Console — v2.12:**
- 3 new state fields in `BrainConsoleViewState`: `voNormalizeHistory`, `voManualQueue`, `voWorkerConfig`
- 3 new imports in view.ts
- Promise.allSettled array: 150 → 153 (verified 153/153 aligned)
- 3 new Studio tab cards: VO Worker Config (status badges + manual actions list), VO Normalize History (job table), VO Manual Posting Queue (job table with inline instructions viewer)
- Dead job warning card in VO Queue block
- `renderParityMatrixCard` — replaced minimal list with full entry table (all 13 stages) + summary stats + next steps
- `renderDualRunStatusCard` — added expanded blockers list + `nextSafeTask` display
- `client.ts` — `dead?: number` added to `BrainCoreInfraVOQueueDepth` interface; 3 new interfaces + fetcher functions

**All tests: 577/577 pass. TypeScript: clean.**

### Manual steps required (ordered by priority)

**1. Cloudflare Access service token for video-orchestrator-worker** (blocks n8n dispatch):
- Cloudflare Zero Trust → Access → Service Auth → Service Tokens → Create Token
- Name: `video-orchestrator-worker`
- Set `CF_ACCESS_CLIENT_ID` and `CF_ACCESS_CLIENT_SECRET` in `~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist`
- Reload: `launchctl unload ~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist && launchctl load ~/Library/LaunchAgents/com.office.video-orchestrator-worker.plist`

**2. YouTube OAuth for @says-the-bible** (blocks YouTube auto-post):
- First verify Google Cloud OAuth client credentials exist in keychain: `service=video-orchestrator account=yt-oauth-client-@says-the-bible`
- Run: `~/.local/video-orchestrator/.venv/bin/python3 ~/.local/video-orchestrator/scripts/youtube_uploader.py auth-url --account @says-the-bible`
- Visit the URL, grant access
- Run: `~/.local/video-orchestrator/.venv/bin/python3 ~/.local/video-orchestrator/scripts/youtube_uploader.py auth-exchange --account @says-the-bible --code <CODE>`

**3. Verify n8n YouTube workflow** (after CF Access is set):
- Open n8n at `https://n8n.prochat.tools` 
- Confirm the workflow that receives VO webhook has a YouTube OAuth credential wired
- If not: add credential (type: YouTube OAuth2) pointing to `@says-the-bible` tokens

**4. Re-run post test** (after 1+2+3):
```bash
vo queue post --video /tmp/vo_norm_genesis_noah/landscape_1920x1080_16x9.mp4 --platform youtube --account 303e91f9 --title "Genesis — Noah (30min)"
```
Then monitor: `vo jobs --limit 5`

**5. NVIDIA orchestrator account in Cloudflare** (deferred by user — do when ready):
- Already acknowledged — will be done separately

### Guardrails
- Brain Core + Brain Console remain read-only viewers. No mutation routes added.
- Worker plist has placeholder values — no real tokens committed.
- No secrets in repo.

## 2026-05-22 — SvelteKit default for new web projects

**Decision:** All new web projects default to SvelteKit instead of Next.js.

**Reasoning:**
- 30-40% less code per component (smaller context windows, cheaper AI operations)
- No hooks footguns (stale closures, dependency arrays, rules of hooks)
- Single-file encapsulation (AI agents reason per-file without tracing imports)
- ONE way to do state ($state), derived values ($derived), effects ($effect)
- Scoped styles prevent cross-component CSS leaks
- SvelteKit adapter system enables vendor-agnostic deployment

**Scope:**
- All new greenfield web projects
- NOT existing Next.js projects (no migrations)
- NOT mobile (Svelte has no React Native equivalent)
- NOT projects requiring React-only libraries with no Svelte equivalent

**Stack for new projects:** SvelteKit + TypeScript + Tailwind + shadcn-svelte + Supabase + Drizzle

## 2026-05-24 — Video Orchestrator Gemini-first AI routing policy

**Decision:** Video Orchestrator and the shared AI Model Selector policy now use Gemini free-tier first for eligible non-sensitive text generation, then local Ollama, then Codex CLI, then Amazon Bedrock Claude.

**Reasoning:** Gemini free-tier can absorb high-volume draft generation before consuming local compute or paid Bedrock budget. Local Ollama remains mandatory first for sensitive, private, offline, external-provider-disallowed, or high-control review payloads, and becomes the default fallback when Gemini is exhausted, rate-limited, unhealthy, or fails quality checks.

**Impact:** VO strategy, roadmap, selector onboarding, agent orchestrator architecture, AI selector architecture, and implementation plan docs must describe quota-aware Gemini routing. The selector must track Gemini RPM/TPM/RPD budgets, daily reset state, 429/quota exhaustion, health failures, and quality-gate fallbacks. Direct OpenAI API and direct Anthropic API calls remain forbidden.



- Date: 2026-06-11 (AI System Context Reduction)
- Decision: Adopted an AI-agnostic Brain architecture that routes rules, coding orchestration, capability lookup, handoffs, and context ordering through canonical policies and runbooks instead of growing always-on prompts.
- Context: Brain's Claude/Codex/Gemini system needed to preserve one standard way of working while reducing prompt bloat, preventing asymmetric capability installs, keeping deterministic rules out of context, and making cross-runtime work resumable without full conversation dumps.
- Impact: Added and indexed canonical policies for rule onboarding/hooks, code orchestration, capability discovery, handoff/parallel briefs, and context-loading order. Added hook guards for generated/runtime staging, active skill surface, review-before-ship, sensitive edits, and risky commands. Kept the default active skill profile to seven skills: code, research, memory, review, qa, handoff, careful. Left GrepLoop dormant. Added `operations/runbooks/anthropic-inspired-ai-system-checkpoint.md` as the compact implementation checkpoint.
- Rationale: Stable AI behavior should come from modular policies, registries, deterministic hooks, and compact evidence briefs rather than giant runtime prompts or hidden chat memory.
- Rollback: Revert the Step 1–5 policy/runbook/runtime-reference commits listed in `operations/runbooks/anthropic-inspired-ai-system-checkpoint.md`; remove the checkpoint runbook and central index references if the system returns to inline prompt-managed behavior.

- Date: 2026-06-23 (MTPLX + Qwen 3.6 27B Local Inference)
- Decision: Unified all local AI inference on MTPLX Qwen 3.6 27B Speed with automatic Ollama memory management and custom graphify provider.
- Context: Graphify, terminal agent (aider), and nightly scheduler needed consistent, fast, local inference without API keys. MTPLX with native MTP speculative decoding provides ~1.6–2.2x speedup over standard MLX. Qwen 3.6 27B has native MTP support and fits in 24GB M4 Pro unified memory. Previous attempts to use both MTPLX and Ollama caused OOM crashes because they compete for the same memory pool (MTPLX ~21-22 GB, Ollama variable).
- Impact: (1) Registered custom "mtplx" provider in ~/.graphify/providers.json pointing to localhost:8000/v1 — avoids openai-python SDK's hardcoded api.openai.com base_url and API key validation conflicts; (2) All graphify entry points (graphify-nightly.sh, buildflow/graphify-run.sh, buildflow/run-graphify.sh, npm scripts) use --backend mtplx; (3) qwen command auto-stops Ollama before starting MTPLX (prevents OOM); (4) graphify-nightly.sh auto-starts MTPLX if not running and waits up to 120 seconds for model load; (5) Updated CLAUDE.md with MTPLX constraints and entry points; (6) Comprehensive runbook at operations/runbooks/mtplx-qwen-integration.md documents system architecture, memory breakdown, troubleshooting, and unified approach.
- Rationale: Single inference engine eliminates context switching, API key management, and memory contention. Custom graphify provider is more reliable than workarounds. Auto-stop/auto-start ensures the system works reliably without manual intervention.
- Constraints: M4 Pro has 24GB; MTPLX runtime needs ~21-22 GB. Ollama cannot run simultaneously with large models. Only Speed variant of Qwen 3.6 27B fits (Quality needs 30GB). Memory pressure must stay <90% or inference stalls.
- Rollback: (1) Delete ~/.graphify/providers.json custom "mtplx" entry; (2) Revert graphify scripts to --backend ollama with Ollama-based models; (3) Remove auto-stop and auto-start logic from qwen, graphify-nightly.sh; (4) Revert CLAUDE.md MTPLX section and runbook references; (5) Set graphify-nightly.sh GRAPHIFY_BACKEND=ollama.
