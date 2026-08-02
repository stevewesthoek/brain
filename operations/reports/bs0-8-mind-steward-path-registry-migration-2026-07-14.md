# BS0.8 — Mind Steward path-registry migration

**Status:** complete (2026-07-14)  
**Boundary:** B1.5 outcome B; stop before BS0.10.

## Bounded outcome

Mind Steward now consumes the Brain-owned canonical path registry through the
local, dependency-safe `tools/mind-canonical-path-registry.mjs` resolver. The
typed bridge sets its working directory to the Brain root, so resolver behavior
does not depend on the caller's current directory. It has no Brain Core package
import, HTTP/API dependency, or duplicate registry.

The migrated consumers are:

- contracts and loop plans: canonical `agent-context`, inbox, domain, history,
  and `kanban-current-authority` path IDs;
- classifier and failed-item discovery: canonical `inbox/new/` and
  `inbox/failed/`, read-only unless the pre-existing exact apply boundary is
  satisfied;
- preview: canonical `system/agent-context/current.md` only, with unknown and
  noncanonical targets fail-closed;
- report, wiki health, maintenance preview, and CLI dry-run presentation:
  registry-derived paths and report-only output;
- maintenance preview: canonical paths only, except `wiki/log.md`, which is a
  registry-classified, read-only compatibility proposal ledger and produces
  only a no-op review item.

No newly reachable writer was introduced. The existing report-only/dry-run
defaults and explicit approval checks remain unchanged.

## Retired-token review

The production source scan found no retired path selected as an active default.
Remaining occurrences are classified as follows:

| Occurrence | Classification | Why it remains |
|---|---|---|
| `wiki/log.md` in health and preview | registered compatibility read | The registry explicitly retains it as the proposal ledger; preview cannot create or write it. |
| `[[sources/` source-trace marker | historical evidence marker | It recognizes provenance text in existing content; it does not select `sources/` as an input or destination. |
| Generic “wiki page” labels in maintenance findings | inactive terminology | Ordinary wiki paths are not scanned as active health authority and fail closed for preview actions. |
| Retired path tokens in tests | negative fixtures | They prove rejection, not active behavior. |

## Validation

```text
npm --prefix projects/mind-steward run typecheck
# pass

./projects/mind-steward/node_modules/.bin/tsx --test projects/mind-steward/src/tests/*.test.ts
# 59 pass, 0 fail

node tools/mind-canonical-path-registry.mjs validate
# registry=pass; registry_version=1.0.0; paths=36
# network_access=false; mind_content_read=false

node --test tools/mind-canonical-path-registry.test.mjs
# 3 pass, 0 fail
```

Focused maintenance-preview and wiki-health fixtures additionally prove the
canonical failed queue, ordinary-wiki rejection, registered `wiki/log.md`
exception, and no-write result. The package typecheck and import inventory show
no circular Brain Core/Mind Steward package dependency.

All tests use temporary fixture roots. No Mind content was changed; no real
Mind write, deployment, live n8n query, webhook, schedule mutation, credential
access, or network write occurred.

## Continuation decision

All active Mind Steward path policy now derives from the canonical registry or
the explicit `wiki/log.md` compatibility exception. No Critical or High path
ambiguity remains. **BS0.8 is complete; BS0.9 may proceed.** BS0.10 remains
pending because M1.4 task authority remains blocked.
