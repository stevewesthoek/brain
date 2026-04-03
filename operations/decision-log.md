# Decision Log

Lightweight record of infra/structure decisions that affect the Brain repo.

## Format
- Date:
- Decision:
- Context:
- Impact:
- Rollback:

## Entries
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
