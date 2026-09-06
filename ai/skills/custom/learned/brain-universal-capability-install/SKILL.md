---
name: brain-universal-capability-install
description: Use when a genuinely new skill, CLI, MCP server, or agent surface is needed after shared capability discovery finds no existing route. Onboard it once through Brain's canonical registries and runtime-specific adapters.
---

# Brain Universal Capability Onboarding

Use this only after the shared discovery query finds no existing capability.
The user describes the desired work in natural language; the agent owns
discovery, onboarding, and verification.

## One standard

Every capability has one canonical Brain record and, where applicable, these
adapters:

| Capability | Canonical record | Operational support |
| --- | --- | --- |
| Skill | `ai/skills/custom/**` or `ai/skills/vendors/**` with frontmatter | profile/index entry; runbook when operational |
| CLI | `operations/CLI-MANIFEST.md` | executable on shared `PATH`; runbook for non-trivial use |
| MCP | `operations/specs/mcp-provider-admissions.json` or documented client integration | provider docs; client-specific config and runtime verification |
| Agent surface | shared discovery policy and runtime adapter | Claude/Codex/Gemini instructions point to the same query |

Canonical routing documentation:

- `ai/policy/capability-discovery.md`
- `tools/discover-capabilities.mjs`
- `docs/skills/skill-index.md`
- `operations/CLI-MANIFEST.md`
- `operations/system-configs/mcp/README.md`

Do not create a second registry, a runtime-specific copy of a skill, or a
manual user-facing activation ritual.

## Installation and documentation

1. Query first:

   ```bash
   node tools/discover-capabilities.mjs --query "<natural-language request>" --format compact
   ```

2. If the capability exists, read the selected source and runbook, then use
   the available CLI/MCP surface.
3. If it does not exist, install it once in the appropriate system location,
   add one canonical registry record, and add only the adapters required by
   the clients that can consume it.
4. Keep credentials and tokens outside Brain documentation and never print
   them.

The result must let any supported agent answer: what handles the request,
where its source and runbook live, which clients can consume it, whether it is
installed/configured/authenticated, and what safety limits apply.

## Validation

Run the repository validator and relevant runtime checks:

```bash
node tools/validate-agent-capability-onboarding.mjs
node tools/scripts/switch-skill-profile.mjs default --dry-run --verbose
node tools/scripts/sync-ai-skills.mjs --check
```

For an MCP provider, also run its admission validator. For a CLI, verify the
manifest entry and `command -v <cli>` in each supported shell/runtime. A
configured or documented integration is not proof of authentication or live
availability; report those states separately.

## Safety boundary

Discovery and onboarding do not authorize financial, production, credential,
or other external side effects. Read-only inspection is the default. Mutating
actions require the user's explicit scope and exact confirmation where the
underlying tool requires it.
