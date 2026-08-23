# Brain Core System Projections v1

## Purpose

These projections are the first practical read-only consumers of the Brain Core
projection envelope. They normalize existing status, capability, repository,
contract, and topology references without creating a monitoring database or a second
authority system.

## Endpoints

```text
GET /projections/health
GET /projections/topology
GET /projections/services
GET /projections/contracts
```

Every response uses `brain-core-projection-v1` and the safety invariants:

```text
readOnly=true
writesToMind=false
executionEnabled=false
```

## Health semantics

Health state is one of:

- `healthy`: the API and required validation evidence are available;
- `healthy_with_attention`: the API is available but evidence or capability
  limitations require operator attention;
- `degraded`: a known required component is impaired;
- `unavailable`: Brain Core cannot provide the projection;
- `unknown`: the source does not establish a safe conclusion.

The foundation implementation deliberately reports `healthy_with_attention` when
Brain Core is available but last validation evidence is not registered in the runtime
projection. Unknown validation is never converted into healthy evidence.

Capability lists come from the existing Brain Core capability manifest. They are not
live provider probes and must be read as availability of the declared API surface.

## Topology semantics

Topology is an explicit relationship projection, not an ownership inference engine.
Each node declares ownership and source references. Mind appears only as a reference
authority; no Mind content is read or copied. Client nodes describe adapters and do
not become authority.

Repository aliases are reused from the existing `/repos` adapter. Missing or
unconfigured repositories remain `unknown`/placeholder state rather than being
silently treated as absent or healthy.

## Services and contracts

The services projection currently exposes only the Brain Core service because no
other service inventory is admitted by this packet. The contracts projection exposes
the accepted projection-envelope contract. Future services or contracts require
explicit source ownership and provenance; they must not be inferred from process
names or client configuration.

## Client model

Brain Core exposes operational truth and bounded source status. Brain Console,
Obsidian, Claude, Codex, Workbench, and future clients consume the projections and
render their states. Clients do not read runtime files directly, become authority,
promote data, schedule work, or mutate Mind/Brain state.
