# Agent Mode K4.1-B2 Host-Health Event Source Evidence — 2026-09-10

## Status

K4.1-B2 is complete for its bounded observation gate. K4 remains in progress.
No CI source, worker, model, remediation, provider network client, host
mutation, daemon, or listener was implemented.

## Infrastructure authority and source contract

`HostHealthEventSourceAdapter` implements the shared `EventSourceAdapter`
contract with source type `infrastructure.host-health`. Its default reader
calls the existing normalized `readInfrastructureHealth` boundary, the
existing `readInfrastructureCatalog` projection, and the authoritative
`operations/infrastructure/health/provider-bindings.v1.json` registry. It does
not query Tailscale, New Relic, Cloudflare, AWS, or Dokploy directly and does
not duplicate provider normalization.

Only catalog resources with `resourceClass: host` and admitted provider
bindings are eligible. Observations are matched by canonical resource ID and
provider ID, then expanded per binding so multiple provider channels for one
host remain provenance-distinct. Provider-returned names or addresses are not
used as Brain resource identity.

## Semantic state and transitions

The bounded source-owned cursor is a versioned JSON value in the existing
EventSource watermark. It stores at most 500 current channel states and a
continuation offset; no second database or health ledger is created. A channel
key is `resourceId|providerId|bindingId`. Its semantic fingerprint includes
only resource, provider, binding, effective status, freshness, and sorted
condition codes. Observation IDs, timestamps, and metric values are excluded.

Bootstrap persists the current baseline and emits zero events. Later
healthy/degraded/unhealthy/unknown or fresh/stale/unknown changes emit one
`infrastructure.host-health.changed` scheduler event containing bounded
previous/current status and freshness, condition codes, canonical identities,
observation ID, and timestamps. Equivalent repeated observations and metric
noise do not emit duplicates. Older observations cannot overwrite a newer
accepted state.

Freshness is recomputed with the existing `computeFreshness` and
`effectiveStatus` helpers. A fresh healthy observation can therefore become
unknown/stale once its configured freshness window expires, producing one
deterministic stale transition; repeated stale polls are quiet, and a later
fresh healthy observation produces one recovery transition.

## Bounds, failures, and loop safety

Bindings are sorted deterministically by resource/provider/binding identity.
Each poll scans at most the adapter binding bound and emits at most the source
catch-up limit. `hasMore` and the cursor continuation offset preserve truthful
bounded progress. Scheduler ingestion and cursor advancement remain one
existing StateStore transaction.

Missing or invalid normalized runtime state, unknown resources, binding
mismatches, malformed cursor state, and out-of-order observations fail closed
without synthesizing mass outages or advancing false state. Scheduler rows are
the destination only; the source reads normalized infrastructure evidence, so
host-health scheduler events cannot recursively feed the host-health source.

The finite operator surface is:

```text
brain-agent sources poll --once --source-type infrastructure.host-health
```

An unhealthy observation only becomes durable scheduler work. It does not SSH,
restart services, mutate infrastructure, create workers, open a Workcell, or
invoke a model.

## Fixtures and conformance

The B2 fixture suite covers bootstrap, identical-state and metric-noise
suppression, unhealthy/recovery transitions, fresh/stale recovery, multiple
providers for a synthetic host, unknown resource and binding failure, missing
snapshot failure, out-of-order protection, bounded scanning and continuation,
restart/observer reconstruction, and the shared contract probe across Git,
lifecycle, and host-health adapters. Existing infrastructure normalizer,
catalog, binding, and plane tests remain green.

## Validation

From `projects/brain-core`, using deterministic local fixtures and the bundled
fallback Git only where existing Git fixtures require it:

```text
npm run typecheck
npm run build
node --test --test-timeout=60000 dist/tests/k4-1-b2-host-health-event-source.test.js dist/tests/k4-1-b1-lifecycle-event-source.test.js dist/tests/k4-1-a-git-event-source.test.js dist/tests/k4-0-scheduler-heartbeat.test.js dist/tests/sqlite-state-store.test.js dist/tests/agent-mode-observer.test.js dist/tests/agent-mode-process-recovery.test.js dist/tests/infrastructure-observation-runtime.test.mjs dist/tests/infrastructure-plane.test.mjs dist/tests/infrastructure-unified-endpoints.test.js
```

Result: **89 passed, 0 failed**. Typecheck and build passed. The no-event
heartbeat returned `NO_ACTION`; ModelGateway calls, AgentRuntime calls, and
workers created were all zero. Safety and secret scans passed, with no direct
provider network, shell, host mutation, model, worker, daemon, or listener path
in the B2 source.

## Roadmap state

K4.1-B2 is **COMPLETE**. K4 remains **IN PROGRESS**. The next source task is
not started automatically; inspect the authoritative K4 closure requirements
before selecting it. The expected next bounded task is:

`K4.1-C — CI Event Source and K4.1 Event-Source Closure Audit`
