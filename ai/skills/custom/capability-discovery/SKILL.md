---
name: capability-discovery
description: Use automatically for any natural-language request that may need a Brain skill, CLI, MCP server, runbook, or external integration. Resolve the best existing capability without requiring the user to know internal names or profiles.
---

# Brain Capability Discovery

This is the shared natural-language entry point for Brain tooling. The user
describes the outcome; the agent discovers the existing skill, CLI, MCP server,
runbook, and safety boundary needed to complete it.

## Required routing

For any request that could use external tooling, first run from the Brain repo:

```bash
node tools/discover-capabilities.mjs --query "<the user's request>" --format compact
```

If the current repository is not Brain, use the absolute Brain path:

```bash
node /Users/Office/Repos/stevewesthoek/brain/tools/discover-capabilities.mjs \
  --query "<the user's request>" --format compact
```

Read the returned source documentation before acting. Prefer the highest
scoring existing route, then use the CLI through the shared PATH or the
already-configured MCP surface. The user must never need to name a skill,
profile, CLI, or MCP server.

## Safety and availability

- A discovered CLI being installed does not prove authentication or permission.
- A configured MCP server does not prove that it is connected or logged in.
- Follow the discovered skill/runbook safety rules, especially for billing,
  production data, credentials, external state, and destructive actions.
- Never print or expose secrets while checking configuration.
- Do not install or invent a new capability until discovery shows no existing
  route fits.

## Output contract

When useful, report the route compactly:

```text
Capability route: <skill | CLI | MCP | runbook>
Why: <one sentence>
Next action: <smallest safe step>
```

Discovery is read-only. Profile activation and client configuration remain
internal implementation details; do not ask the user to perform them for a
normal request.
