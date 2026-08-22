# BuildFlow → Workbench Next Decisions

## Scope and evidence

This is a read-only reconciliation of the remaining BuildFlow references in
Brain. It does not rename files, repositories, credentials, infrastructure,
domains, APIs, or runtime identifiers. The classifications below are based on
repository evidence only; no live provider mutation or secret inspection was
performed.

Classification used in the audit:

- **A — Current Workbench terminology missing:** an active human-facing label
  still says BuildFlow.
- **B — Legacy BuildFlow compatibility identifier:** changing it could break a
  path, credential lookup, runtime contract, deployment, or parser.
- **C — Historical infrastructure evidence:** the reference records a dated
  state, migration, benchmark, decision, or observation.
- **D — Requires product decision:** the repository does not establish whether
  the document or external label is still authoritative, so a rename or status
  change must be explicitly decided.

## Ambiguous active documentation audit

| File | Representative occurrences | Classification | Decision |
|---|---|---|---|
| `operations/standards/buildflow-dockerfile-contract.md` | Title and product prose; `stevewesthoek/buildflow`; `buildflow.prochat.tools`; `/var/lib/buildflow`; `BUILDFLOW_ACTION_TOKEN`; `buildflow:test` | A, B, C, D | The contract is marked implemented for a dated BuildFlow commit, but also contains unresolved checklist items and a paused provisioning status. Keep technical examples unchanged until its normative status is decided. |
| `operations/standards/buildflow-migration-plan.md` | Local-only phase language; `buildflow-orchestrator.sh`; `~/.buildflow`; public domain; action token; `buildflow-data` | A, B, C, D | This is explicitly a Phase 0/Phase 1 migration plan. It needs a close, supersede, or rewrite decision before any terminology or completion status is changed. |
| `operations/standards/buildflow-relay-privacy.md` | Relay product prose; `BUILDFLOW_ACTION_TOKEN`; `buildflow-relay`; `/var/lib/buildflow`; Dokploy procedures | A, B, C, D | Human-facing terminology can eventually become Workbench, but the document also describes an authentication and storage contract. Treat it as normative until an owner confirms the current security source of truth. |
| `operations/accounts/credentials-index.md` | Workbench relay/API heading; `RELAY_ADMIN_TOKEN`; `BUILDFLOW_ACTION_TOKEN`; `~/.config/buildflow`; `~/.buildflow`; `/var/lib/buildflow`; `buildflow-data` | B, C, D | Human-facing section and service labels are synchronized to Workbench. Credential names and lookup paths remain contractual; credential migration requires a separate rotation and rollback plan. |
| `operations/architecture/prochat-infrastructure-architecture.md` | Workbench and Workbench Staging inventory labels; pinned `ghcr.io/stevewesthoek/buildflow` images; BuildFlow volumes in historical sections | B, C, D | Current repository-facing labels are synchronized to Workbench. Image refs, volumes, IDs, and external provider status remain unchanged and require separate operational decisions. |
| `operations/architecture/prochat-infrastructure-evidence-register.md` | `buildflow-staging.prochat.tools` 502 evidence and routing claim | B, C, D | This is an evidence record, not a presentation inventory. Preserve the observed hostname and result; decide separately whether the underlying staging service still exists. |
| `operations/infrastructure/infra.md` | The current inventory label is already Workbench; `buildflow.prochat.tools` remains in the domain table with pending-provisioning language | A resolved, B, C, D | The human label is aligned. The domain and provisioning status need authoritative infrastructure reconciliation, not a terminology edit. |
| `operations/infrastructure/tailscale-cloudflare-connectivity-audit-2026-08-18.md` | Dated audit rows for `stevewesthoek/buildflow`, `buildflow-staging.prochat.tools`, and port 3054 | B, C, D | Preserve as dated connectivity evidence. Do not rewrite the hostname or repository path; decide separately whether a new current audit should supersede it. |
| `operations/runbooks/codex-starship-config.md` | 2026-05-13 preflight says the BuildFlow write policy blocked a path | C, D | This is historical runbook evidence. It may be stale after later access-policy work, but the correct replacement status is not established by identity mapping. |
| `operations/runbooks/kiro-global-steering-setup.md` | “Current BuildFlow write policy” blocks a Kiro path | A, C, D | The wording may be stale human-facing operational guidance. Confirm the current write policy and runbook ownership before changing it. |
| `operations/system-configs/ide-context.md` | Same BuildFlow write-policy statement as the Kiro runbook | A, C, D | This is a current-looking context contract with a historical policy dependency. It requires a separate consistency decision; it is not a safe identity-only edit. |

Additional non-archive references were also found in
`operations/runbooks/buildflow-cli-diagnostics.md`,
`operations/infrastructure/local-port-audit.md`,
`operations/system-configs/codex/config.toml`, the Brain local-app command
parser, and test fixtures. These are respectively operational history,
technical paths/commands, trusted-project configuration, runtime command
compatibility, and fixture namespaces. They remain unchanged and are covered
by the B/C classifications below.

## Authentication and credential terminology

| Name | Classification | Finding |
|---|---|---|
| `BUILDFLOW_ACTION_TOKEN` | Contractual compatibility identifier | It is the documented bearer-token environment variable for the action API and is referenced by operational scripts and security guidance. Renaming it would require coordinated backend, deployment, Custom GPT, secret-store, and rollback changes. |
| `RELAY_ADMIN_TOKEN` | Contractual credential identifier | It is a separate relay-admin credential documented beside the action token. It is not a product label and must not be renamed as part of this identity pass. |
| BuildFlow Relay / BuildFlow API | Mixed presentation and service terminology | In headings and explanatory prose these can become Workbench later. Where they identify a deployed relay/API boundary, the service contract must first be confirmed; classify as D rather than assuming a harmless rename. |
| `buildflow.prochat.tools` | Contractual/current deployment identifier in repository evidence | It appears as the public action/API hostname. Changing it requires DNS, certificates, Cloudflare/Dokploy routing, deployment configuration, Custom GPT import/configuration, and rollback coordination. |
| `~/.config/buildflow` | Contractual local credential/configuration path | Scripts and the credential index use this path. A new path would require migration, compatibility lookup, permissions review, and rollback. |
| `/var/lib/buildflow` | Contractual container data path | Dockerfile, volume, and relay procedures use this path. A change requires data migration and deployment coordination. |
| `~/.buildflow` | Local runtime-state path | It is used by local state and backup procedures. Preserve until a state migration is approved. |

No secret values were read or printed. The presence and names of credential
references were audited only.

## Infrastructure identity

| Identity | Classification | Compatibility impact |
|---|---|---|
| `ghcr.io/stevewesthoek/buildflow` and pinned digest references | Compatibility identifier and deployed image reference | Image publishing, deployment manifests, rollback records, and pull configuration depend on the name. Requires an image migration project. |
| `buildflow-relay` container/service name | Compatibility identifier | Operational commands and logs address it directly. Requires coordinated service-name migration. |
| `buildflow-data` and `buildflow-data-staging` volumes | Compatibility identifier and storage identity | Renaming without a data copy/restore and rollback plan risks state loss or misattachment. |
| Dokploy app IDs such as `app-index-haptic-port-m88k9z` and `app-transmit-online-hard-drive-of1m9k` | Compatibility identifiers | The IDs do not need a product rename and must remain stable. Human labels may be changed only through the provider’s controlled inventory process. |
| `BuildFlow` / `BuildFlow Staging` provider labels | Presentation labels with external operational context | Current repository-facing labels are synchronized to Workbench. External provider labels and current-vs-historical service status remain unverified and require a separate provider decision. |
| `buildflow.prochat.tools` and `buildflow-staging.prochat.tools` | Production/staging domain identifiers in evidence | Formal domain migration required; preserve historical hostnames in evidence records. |
| `/Users/Office/Repos/stevewesthoek/buildflow` and related local paths | Compatibility/runtime identifiers | Used by local app inventory, bridge scripts, Codex project trust, credentials/runbooks, and audits. Requires a coordinated repository/path migration. |

## Repository naming impact

The Brain repository itself is `brain`; its origin is
`https://github.com/stevewesthoek/brain.git`. References to
`stevewesthoek/buildflow` point to a separate Workbench predecessor repository
and its local checkout. Renaming that repository or its local directory would
affect, at minimum:

- local-app registry and bridge-stack paths;
- `buildflow-orchestrator.sh` command references;
- credential/config lookup paths;
- Codex trusted-project configuration;
- the Brain command parser’s explicit script compatibility pattern;
- Docker/GHCR image and deployment references;
- runbooks, audits, migration manifests, and rollback evidence.

Therefore a repository rename is not a safe terminology edit. It requires a
formal compatibility migration with aliases or a staged cutover, validation,
and rollback. No repository was renamed.

## Safe to rename later

Only presentation-only text with no runtime or historical meaning:

- active inventory `name`, `description`, and table-label fields;
- human-readable log prefixes and status prose;
- new non-contractual explanatory prose that describes the current product.

These changes must not alter paths, commands, environment-variable names,
domains, app/service IDs, image names, volume names, or historical records.
The previously approved active infrastructure labels fall in this category.

## Must remain BuildFlow

The following identifiers must remain unchanged until a formal migration is
approved:

- `BUILDFLOW_ACTION_TOKEN` and other existing credential/config variable names;
- `BUILDFLOW_DIR`;
- `stevewesthoek/buildflow` and `/Users/Office/Repos/stevewesthoek/buildflow`;
- `buildflow-orchestrator.sh`;
- `buildflow.prochat.tools` and `buildflow-staging.prochat.tools`;
- `~/.config/buildflow`, `~/.buildflow`, and `/var/lib/buildflow`;
- `buildflow-relay`, `buildflow-data`, and `buildflow-data-staging`;
- `ghcr.io/stevewesthoek/buildflow` image references and pinned digests;
- provider app/service IDs, migration-manifest identifiers, and deployment
  names;
- `.buildflow/` and `.buildflow-test-*` runtime/test namespaces;
- compatibility patterns in command parsers and configuration files.

## Requires migration project

The following changes are possible, but not as part of identity cleanup:

1. Repository/GitHub slug and local checkout rename, including aliases and
   every script, trusted-project, CI, and deployment reference.
2. Action-token and relay-admin credential variable/path migration, including
   secret rotation, dual-read or cutover behavior, permissions, and rollback.
3. Public and staging domain migration, including DNS, TLS, Cloudflare,
   Dokploy routing, Custom GPT configuration, health checks, and rollback.
4. Docker image, container, volume, app-label, service-name, and deployment
   manifest migration with state-copy and restore verification.
5. Command and fixture namespace migration, including compatibility handling
   for existing local state and tests.

Each project needs an owner, a source-of-truth decision, a compatibility
window, validation evidence, and an explicit rollback plan.

## Not recommended to change

Do not rewrite BuildFlow names in:

- `docs/projects/buildflow/` historical reports;
- dated migration reports, decision logs, evidence registers, and benchmark
  artifacts;
- migration manifests and cutover/rollback packets;
- generated artifacts and test evidence;
- historical observations that record the hostname, image, path, or service
  name that existed at the time.

Historical accuracy is more valuable than terminology uniformity in these
records. If current guidance needs to supersede one of them, add a new
authoritative document or explicit addendum rather than rewriting the original
evidence.

## Unresolved decisions

1. Which document is the current normative source for Workbench relay
   authentication and deployment: the older BuildFlow standards, the newer
   Workbench documentation, or a formally designated successor?
2. Is `buildflow.prochat.tools` still the authoritative production action/API
   hostname, or only a preserved compatibility endpoint? Repository evidence
   is not sufficient to answer this without a live deployment decision.
3. Are the BuildFlow and BuildFlow Staging provider applications still
   current-active, or should their status be reconciled against the current
   Workbench runtime and architecture catalog?
4. Should the Kiro/IDE write-policy references be closed as historical, or
   updated in a separate operational-policy task?
5. If a future rename is approved, which compatibility window and rollback
   strategy will protect existing local state, credentials, clients, and
   deployed services?

The original audit was read-only. The subsequent bounded synchronization changed
only the human-facing labels recorded in the reconciliation report and left
runtime code, authentication, schemas, infrastructure, credentials, technical
identifiers, and historical evidence unchanged.
