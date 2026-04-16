# Testing & QA Procedures

## Brain repo

No formal test suite — this is a config/docs repo, not a code project. Verification is manual.

**Post-reboot/reinstall:** Run `tools/scripts/brain-automate-verify.sh` to confirm all systems (symlinks, crons, services) are working.

## QA skills (for project repos)

| Skill | Purpose | Modifies code? |
|-------|---------|----------------|
| `/qa` | Systematic test + fix bugs | Yes |
| `/qa-only` | Report bugs, no fixes | No |
| `/benchmark` | Performance regression detection (Core Web Vitals) | No |
| `/review` | Pre-landing PR review (SQL safety, LLM trust, patterns) | No |
| `/design-review` | Visual QA (consistency, spacing, hierarchy) | No |
| `/investigate` | Systematic debugging (investigate → hypothesize → test → confirm) | Depends |

## Safety guardrails

| Skill | Purpose |
|-------|---------|
| `/careful` | Warn before destructive commands (rm -rf, DROP TABLE, force-push) |
| `/guard` | Full safety mode (warnings + approval prompts) |
| `/freeze` / `/unfreeze` | Restrict edits to a specific directory |
| `/cso` | Infrastructure-first security audit |
