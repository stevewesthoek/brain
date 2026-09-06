# CLI Access and Authentication Health

This is the canonical runtime check for every CLI registered in
`operations/CLI-MANIFEST.md`. It separates four facts that must not be
collapsed into one “installed” flag:

1. the command resolves on PATH;
2. the command can execute a bounded safe probe;
3. provider authentication or desktop session access works;
4. the capability is safe to invoke without task-specific input.

## Run the current check

From any repository:

```bash
node /Users/Office/Repos/stevewesthoek/brain/tools/check-cli-access-health.mjs --write --notify
```

From Brain, the relative form is equivalent:

```bash
node tools/check-cli-access-health.mjs --write --notify
```

The same check is available through the shared CLI surface as
`cli-access-health --write --notify`; it is registered in the CLI manifest and
therefore discoverable by the same natural-language routing path.

The command suppresses child output and writes only redacted metadata to:

```text
runtime/local/infrastructure/cli-access-health.json
```

Exit code `0` means every safely probeable registered CLI is ready. Exit code
`1` means one or more entries need attention. `not_tested` is explicit and does
not mean healthy: the registry refuses to probe commands that could mutate
state, scan credentials, load models, start services, or require task-specific
input.

`--notify` raises a deduplicated macOS notification when the attention state
changes. The managed `com.office.brain-cli-access-health` LaunchAgent runs this
check at load and every 15 minutes, writing its redacted snapshot under
`runtime/local/infrastructure/`.

Profile entries marked `enabled: false` remain visible in the report as
`disabled` for traceability but do not block the active account set.

## Authentication boundary

The checker may use an existing local env-file reference for a child probe, but
never prints or persists its values. It does not run `login`, rotate tokens,
open OAuth approval flows, or modify provider credentials. Those actions remain
explicit owner actions.

Examples:

- Stripe: the CLI can be installed and one profile can work while the required
  ProChat Studio profile still needs OAuth reauthentication.
- Cloudflare: a credential file can exist while the provider rejects its token.
- Spark: the CLI can exist while the required desktop session is absent.
- n8n: the API wrapper is ready only when its local env-file values are
  injected into the probe process.

## Updating the contract

When adding a CLI, register it in the CLI manifest and add an override to
`operations/specs/cli-access-health.json` when its safe probe differs from the
default `--version` probe. Run:

```bash
node tools/validate-agent-capability-onboarding.mjs
node tools/check-cli-access-health.mjs --write --notify
launchctl print "gui/$(id -u)/com.office.brain-cli-access-health"
```

Do not mark a credential-backed CLI ready from PATH presence alone.
