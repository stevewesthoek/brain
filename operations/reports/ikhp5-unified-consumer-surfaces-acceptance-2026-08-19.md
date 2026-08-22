# IKHP5 Unified Consumer Surfaces — Acceptance — 2026-08-19

## Status

IKHP5 is complete and accepted as a repository implementation on 2026-08-19.

IKHP5 exposes one canonical Infrastructure Knowledge & Health Plane across Brain Core API, Context Broker, CLI/MCP, and the existing Obsidian Brain Console surface. It does not create a second infrastructure truth store and does not add infrastructure execution authority.

## Implemented contract

- Shared canonical read projection: `projects/brain-core/src/adapters/infrastructure-plane.mjs`.
- Brain Core unified read-only endpoints for catalog, topology, health, incidents, backups, credential status, safety, action receipts, capabilities, doctor, resource inspection, and resource relations.
- Existing provider-specific infrastructure endpoints remain compatibility views.
- Source-neutral Context Broker infrastructure provider backed by the same canonical projection with descriptor-first bounded retrieval, exact resource IDs, citations/freshness, explicit UNKNOWN state, and token-budget enforcement.
- Source-neutral MCP capability descriptors backed by the same projection; all infrastructure descriptors are read-only and expose no execution.
- `prochat infra ...` CLI backed by the same projection.
- Existing Brain Console extended at `/infrastructure`; no second portal or independent canonical database was introduced.
- Credential surfaces expose metadata only and omit secret-store references/secret values.
- Runtime state remains derived under `runtime/local/infrastructure/`; missing runtime remains explicit `missing`/UNKNOWN rather than synthesized healthy state.
- IKHP4 safety invariants remain `executionEnabled=false`, `executionPerformed=false`, and `actualEffects=[]`.

## IKHP5 implementation paths

- `projects/brain-core/src/adapters/infrastructure-plane.mjs`
- `projects/brain-core/src/api/routes.ts`
- `projects/brain-core/src/adapters/capabilities.ts`
- `projects/brain-core/src/tests/infrastructure-plane.test.mjs`
- `projects/brain-core/src/tests/infrastructure-unified-endpoints.test.ts`
- `tools/context-learning/infrastructure-context-provider.mjs`
- `tools/prochat.mjs`
- `tools/validate-infrastructure-consumers.mjs`
- `projects/brain-console/lib/infrastructure-schemas.ts`
- `projects/brain-console/components/infrastructure-dashboard.tsx`
- `projects/brain-console/app/infrastructure/page.tsx`
- `projects/brain-console/components/shell.tsx`
- `package.json`
- `projects/brain-core/package.json`

## Acceptance evidence

Acceptance was re-run after the external migration/n8n work and subsequent Umami recovery/documentation were published. Repository HEAD stabilized at `c913f2fb790b0708b30e61cfa86ab5ba3120e18b` (`fix(migration): finalize Umami recovery and documentation`). The committed Umami change set is compatible with the uncommitted IKHP work: its only direct overlap with the IKHP5 acceptance/status files is `operations/infrastructure/infra.md`, whose current uncommitted diff changes only the IKHP status paragraph and preserves the committed Umami/runtime content.

- `npm run validate:infrastructure-consumers` — PASS; catalog version 1.3.0, 46 canonical resources, bounded context, 9 read-only MCP capabilities, execution disabled, no secrets.
- `npm run test:infrastructure-consumers` — PASS, 7/7.
- `npm run validate:context-learning-broker` — PASS.
- `npm run test:context-broker` — PASS, 11/11.
- `npm run validate:infrastructure-catalog` — PASS; only previously known stale-provenance warnings remain.
- `npm run test:infrastructure-catalog` — PASS, 8/8.
- `npm run validate:infrastructure-health` — PASS.
- `npm run test:infrastructure-health` — PASS, 10/10.
- `npm run validate:infrastructure-incidents` — PASS.
- `npm run test:infrastructure-incidents` — PASS, 23/23.
- `npm run validate:infrastructure-actions` — PASS.
- `npm run test:infrastructure-actions` — PASS, 36/36.
- `npm run validate:infrastructure-action-receipts` — PASS.
- `npm run test:infrastructure-action-receipts` — PASS, 12/12.
- All 14 changed JSON files — valid.
- New runnable IKHP5 MJS syntax checks — PASS.
- `node tools/prochat.mjs infra doctor` — PASS; read-only state, explicit missing runtime/UNKNOWN state, no execution.
- `npm run validate:diff-check` — PASS.
- `runtime/local/infrastructure/` — empty after validation; no repository runtime state was generated.

### TypeScript validation limitation

The repository checkout does not have project-local `tsc` or `tsx`, and no dependency/vendor installation was authorized for acceptance. Workbench's fixed built-in `type_check_cli` and `type_check_web` commands were also attempted with their strict supported envelopes; they target `packages/cli` and `apps/web`, which do not exist in this repository, so both returned `path_not_found` before a type check could run. This is recorded as an environment/tooling coverage limitation, not as a passing type check. Exact static review confirmed Brain Core `tsconfig.json` includes `src/**/*.mjs` with `allowJs: true`, the new TypeScript endpoint test follows the existing route-test mock pattern, and the Brain Console schema/client usage follows existing Zod and `brainCoreRequest` conventions.

## Security evidence

- Exact `forbidden_secret_material` scan over IKHP5 implementation paths excluding `routes.ts` — 0 findings.
- `projects/brain-core/src/api/routes.ts` retains two pre-existing lexical `secret_assignment` findings in unrelated Video Orchestrator webhook verification code. Exact diff review shows IKHP5 changes only the infrastructure-plane import and unified `/infra/*` routes, not those findings.
- Inherited reconciliation/IKHP3/IKHP4 paths remain clean except the already documented Azure CLI lexical finding in `operations/accounts/azure-subscriptions-comprehensive.md:138`; exact diff review confirms it is outside the subscription-rename changes.
- `operations/accounts/credentials-index.md` was not modified.

## Canonical identity/state conformance

The shared projection is the only new cross-surface contract. API, Context Broker, CLI/MCP, and Brain Console consume that projection or Brain Core endpoint; they do not write independent infrastructure state. Cross-surface tests prove stable canonical IDs including `host:dokploy-aws`, `host:supabase`, and the same catalog revision. Stale/UNKNOWN state remains visible, credential output remains metadata-only, and protected-resource/action state remains non-executing.

## Boundaries preserved

No provider write, infrastructure action execution, DNS/tunnel/server/config/firewall mutation, backup/restore operation, credential mutation, remediation, Decision Core write, IKHP6 work, CLR5 work, Mind change, Workbench-private change, or Video Orchestrator change was performed as part of IKHP5.

No commit, push, tag, release, or deployment was performed by the IKHP5 run.

## 1.3.7 release boundary

Exact `brain` repository search found no Brain product/package/service version `1.3.7`: root `machine-brain` is `1.0.0`, Brain Core is `0.1.0`, and Brain Console is `0.1.0`. The only verified `v1.3.7-beta` lineage in repository evidence belongs to Workbench-private context compaction, referenced by `operations/specs/infinite-brain-context-learning-runtime-implementation-plan.md`; Workbench-private `v1.3.8-beta — Source-Agnostic Context & Capability Federation` is recorded as following that release.

Therefore no Brain version was changed to 1.3.7. Workbench-private remains a separate source/release boundary requiring explicit cross-repository authorization.

## Next roadmap state

IKHP5 is complete. IKHP6 remains unstarted and requires separate owner authorization. CLR5 remains unstarted and requires separate owner authorization. The requested 1.3.7 release/deployment work must next recover the real Workbench-private `v1.3.7-beta` release state in the Workbench-private repository; it must not be inferred from Brain package versions.
