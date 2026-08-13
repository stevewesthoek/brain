#!/usr/bin/env python3
"""Retired Mind project decomposer compatibility entrypoint.

This producer was retired on 2026-07-31 because legacy numbered Mind roots are
historical paths and kanban.md remains human-only authority. Keep this path as a
fail-closed compatibility surface so old cron/config references cannot resume
AI-driven Mind mutations.

If project decomposition is ever reintroduced, it requires a new approved
producer contract. The current approved AI policy for private Mind text work is
Bedrock-only (claude-bedrock / us.anthropic.claude-sonnet-4-6) with no Codex
fallback, but that policy does not reactivate this retired producer.
"""

RETIREMENT_MESSAGE = (
    "RETIRED: mind-project-decomposer.py is retired as of 2026-07-31. "
    "Reason: Legacy numbered roots (0x-*/) are historical paths per the canonical path registry. "
    "kanban.md is human-only authority per M1.4. "
    "See operations/reports/bs0-10-legacy-producer-migration-2026-07-31.md"
)


def main() -> int:
    print(RETIREMENT_MESSAGE)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
