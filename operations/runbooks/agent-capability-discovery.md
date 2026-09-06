# Agent Capability Discovery

## Purpose

Give Claude Code, Codex CLI, Gemini CLI, and other Brain-managed agent
surfaces one black-box route from natural language to the actual available
skill, CLI, MCP server, source documentation, and safety state.

The user should be able to say, for example, “inspect Stripe subscriptions.”
The agent owns the routing and must not require the user to name a skill,
profile, CLI, MCP server, or configuration file.

## Canonical query

Run this read-only query from the Brain repository:

```bash
node tools/discover-capabilities.mjs --query "<the user's request>" --format compact
```

The query-time inventory reads:

- skill frontmatter from `ai/skills/custom/**` and `ai/skills/vendors/**`
- profile membership and the current active skill surface
- the canonical CLI manifest and executable availability on `PATH`
- Brain MCP admissions and provider documentation
- configured Codex MCP servers/plugins and Claude MCP template names

It returns ranked matches with source paths, route type, and availability or
configuration state. It does not print credential values and does not grant
execution authority.

## Routing contract

1. Query the shared inventory before creating or installing anything.
2. Read the selected skill source and operational runbook.
3. Use the actual available CLI through shared `PATH`, or the configured MCP
   surface named by the result. If the task needs provider data or a desktop
   session, consult the central redacted access-health report before acting.
4. Separate these states in the response: source-documented, installed,
   configured, authenticated, healthy, and live-verified.
5. If there is no match, inspect the canonical registries before proposing a
   new installation.

Examples:

```bash
node tools/discover-capabilities.mjs --query "inspect Stripe subscriptions"
node tools/discover-capabilities.mjs --query "search Brain code structure" --kind skill
node tools/discover-capabilities.mjs --query "retrieve Mind context" --kind mcp
```

## One onboarding shape

New capabilities are installed once and registered once:

| Kind | Required record | Required route support |
| --- | --- | --- |
| Skill | standard `SKILL.md` frontmatter and skill index/profile entry | source docs; runbook for operational behavior |
| CLI | row in `operations/CLI-MANIFEST.md` | executable on shared `PATH`; central health report for auth/session state; runbook for safety/usage |
| MCP | Brain admission or documented client integration | provider docs; client config; separate runtime verification |

The runtime instruction files point to the same query. Runtime-specific config
is an adapter, not another registry. `sync-ai-skills.mjs` exports active skill
symlinks; it is not a substitute for query-time discovery.

## Validation

```bash
node tools/validate-agent-capability-onboarding.mjs
node tools/scripts/switch-skill-profile.mjs default --dry-run --verbose
node tools/scripts/sync-ai-skills.mjs --check
```

For provider-specific changes, also run the relevant MCP admission and provider
tests. For CLI changes, verify both the manifest route and `command -v` in the
supported shell, then run `node tools/check-cli-access-health.mjs --write`.
Never report a configured integration as authenticated or healthy without that
evidence.

## Safety

Discovery is read-only. It does not authorize login, credential changes,
financial operations, production changes, repository writes, external-state
mutations, or destructive actions. Those remain governed by the selected
capability's runbook and the user's explicit scope.
