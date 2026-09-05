# Brain Console — Obsidian Integration

**Product:** Brain Console
**Role:** implementation entry point for the supported Obsidian knowledge and
Decision Center bridge
**Release baseline:** Brain Console 2.0 complete; maintenance-only

The canonical current integration contract is:

```text
operations/specs/brain-console-obsidian-plugin.md
```

Use these authorities for related concerns:

```text
operations/runbooks/brain-console-operations.md
docs/system/brain-console-architecture.md
projects/brain-console/README.md
docs/system/brain-console-roadmap.md
```

## Source and validation

The standalone plugin source remains in this project and is validated outside
the live vault:

```text
projects/brain-console-obsidian/
```

```bash
npm run check
```

The reviewed files are activated in the live Mind vault only through the
bounded maintenance procedure in the canonical operations runbook. Do not
modify other Mind settings, plugins, content, or secrets during routine Brain
Console maintenance.
