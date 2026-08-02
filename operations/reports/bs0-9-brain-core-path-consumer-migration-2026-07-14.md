# BS0.9 — Brain Core path-consumer migration

**Status:** complete (2026-07-14)  
**Prerequisite:** BS0.8 complete.  
**Boundary:** stop before BS0.10; M1.4 remains blocked.

## Bounded outcome

Brain Core now uses the Brain-owned canonical path resolver for active Mind
defaults and destructive-writer boundaries. No active consumer requires a
retired path as its default or sole target.

Migrated consumers include:

- `mind-paths.ts`: canonical inbox, domain, history, agent-context, and
  `kanban.md` authority defaults; canonical capture builder and destination
  prefixes;
- maintenance pilot loader, freshness validator, and completed-active detector:
  canonical agent context, projects, dashboard, and default five-file pilot;
- capture-promotion detector: canonical `inbox/new/` intake and canonical
  projects/knowledge/resources destinations;
- execution plans and API target unions: canonical agent-context proposal
  target, with retired roots remaining only blocked-input safety cases;
- completed-project archive suggestions: canonical `projects/` source and
  `history/projects/` destination;
- single-file writers: resolver-derived canonical destinations. Source-routing
  and supersede/archive moves additionally reject compatibility or historical
  mutation sources;
- temporary-fixture and report-builder coverage: canonical defaults, explicit
  compatibility read requests, and retired-path rejection cases.

The mutation containment boundary remains fail-closed: writers still require
their existing exact approval, hash, rollback, and manual-confirmation gates.

## Compatibility readers retained

Compatibility paths are not defaults and are never writer destinations. They
remain only in these registry-bounded read contexts:

| Consumer | Retained read | Guard |
|---|---|---|
| `MIND_STRUCTURE_COMPATIBILITY_GROUPS` | Registry-listed legacy structures | Candidate metadata only; canonical candidate is first and all write prefixes are canonical. |
| Maintenance pilot loader | `wiki/organisations/prochat/brand/...` | Explicit caller-selected compatibility read only; the default five-file set uses `organizations/...`. |
| Review surface | `wiki/log.md` | Registered proposal ledger compatibility read; not a write destination. |
| Graph output checks | `graphify-out/` and `.graphify-out/` | Generated-output compatibility observation only; never authority or a write default. |

Every retained legacy token in active source is therefore one of: explicit
compatibility/historical metadata in `mind-paths.ts`, a scoped read exception,
or a blocked-input safety fixture. Unrelated media fixture `/sources/` paths
and archive/log wording are outside the Mind folder contract.

## Validation

```text
npm --prefix projects/brain-core run typecheck
# pass

tsx --test focused consumer and path suites
# 52 pass, 0 fail
# includes canonical loader/default and explicit compatibility-read fixtures,
# capture preservation/promotion, structure validation, and archive suggestions

tsx --test writer, recovery, feature-flag, and mutation-containment suites
# 49 pass, 0 fail

node tools/validate-infinite-brain-contract-registry.mjs
# registry=pass; registry_version=1.0.0; contracts=22
node --test tools/validate-infinite-brain-contract-registry.test.mjs
# 3 pass, 0 fail

node tools/mind-canonical-path-registry.mjs validate
# registry=pass; registry_version=1.0.0; paths=36
node --test tools/mind-canonical-path-registry.test.mjs
# 3 pass, 0 fail

node tools/validate-infinite-brain-contract-layers.mjs
# layers=pass; schema_version=1.0.0; families=9
node --test tools/validate-infinite-brain-contract-layers.test.mjs
# 3 pass, 0 fail
```

Writer tests use temporary fixture roots only. No actual Mind path was written,
moved, or deleted; no deployment, live n8n query, webhook, schedule mutation,
credential access, or network write occurred.

## Verdict and continuation decision

Active Brain Core defaults and mutation destinations are registry-backed and
canonical. Explicit compatibility reads are retained safely; no Critical or
High consumer ambiguity remains. **BS0.9 is complete.** BS0.10 remains pending
because M1.4 task authority is blocked, and it is outside this lane.
