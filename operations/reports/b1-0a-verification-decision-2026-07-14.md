# B1.0a CWFM-18 installation-evidence decision — 2026-07-14

**Task:** `B1.0a — Deploy and verify Save-to-Mind target paths`
**Installation verdict:** `READY_FOR_FRESH_CWFM_18_VERIFICATION`

This is repository-only preparation for a fresh Workbench CWFM-18 review. It
does not claim CWFM-18 passed, B1.0a is complete, or that anything is live.

## Authority and evidence model

Workbench remains the authority for the generic controlled-workflow schema,
canonicalization, grants, confirmation, mutation, readback, rollback, and the
CWFM-18/CWFM-19 verdicts. Its current `n8n-controlled-topology-migration` v1
schema accepts explicit candidate, rollback, and manifest paths. It requires
every protected domain to be `unchanged`, includes activation and webhook node
parameters in canonical protected snapshots, and has no volatile-field
exclusions, protected-field projection, semantic-route field, or fixture-
adapter pointer. Brain supplies only installation artifacts and complementary
offline route/fixture evidence.

Generic Workbench policy is the strict manifest, protected-domain comparison,
and canonicalization. Installation evidence is the workflow identity, artifact
paths/hashes, declared graph transition, route proof, and fixture contract.

## Committed-evidence set for CWFM-18

| Artifact | Path | SHA-256 |
|---|---|---|
| Paused review candidate | `operations/automations/n8n/workflows/mind-inbox-fixed.json` | `0cac65e1ab99f7dc4560d1cd98d2385f6aa2651cba7a368ab5e681e26ce841ad` |
| Deployment candidate | `operations/automations/n8n/workflows/mind-inbox-controlled-deployment-v1.json` | `194ff9b6799709e3c7f649e9fcf875dcb067229973b42560fd1ad3a3060f82e1` |
| Rollback baseline | `operations/reports/artifacts/b1-0a-live-workflow-rollback.json` | `703f036d01a7854aa55b368f9f21fff4b93ec85b10c40d2d20405f68cd4e31dd` |
| Active strict manifest | `operations/automations/n8n/save-to-mind-controlled-topology-migration-v1.json` | `60a07682ea5b30e1e04e991010ecf041c75cfd48116c6389e2285d480d54fc96` |
| Historical legacy topology | `operations/automations/n8n/save-to-mind-topology-migration.json` | `7033c78da154e76d33fe9ad9b54e82b393c735c73f365589cbcb67085540be3a` |
| Wrapper v1 | `tools/n8n-api.sh` | `302c1495a1243ee276b637332b8c86b523f48d0e7b285dd96b4dc3fdcaf02d6f` |
| Fixture adapter | `tools/n8n-save-to-mind-fixture-adapter.mjs` | `c297bc57d6cc18864d7f3339e232f7b70488b5d5c00988414cac63f8093a0595` |
| Fixture contract v1 | `docs/contracts/save-to-mind-fixture-adapter-v1.json` | `0df0528635e923fa6eb9ff80da9c85a8403b8142fcd41b2b3ff2f745e6bbc75c` |

The legacy topology document is historical, non-executable evidence. The
versioned strict manifest above is the single active manifest supplied to
Workbench through its explicit manifest-path input.

## Canonical and protected-domain verdict

- Workflow ID: `FwP5INe9qoo1OwGC`
- Canonicalization version: `1`
- Rollback canonical SHA-256: `b08fddcc9cf70c02821fecc57f121e1eb6440857aa9bf49c74e2c24b1c0cca4b`
- Deployment candidate canonical SHA-256: `1a5664c507a3b141c1fe65700a1fb19d28c41edd281fc5a325cdd3295e2c7ff2`

The original reviewed candidate remains paused. The deployment candidate is a
separate, versioned artifact: it copies only the rollback baseline's protected
`active` value and `respond-webhook` parameters. Therefore activation, settings,
tags, sharing, credential references, webhook definitions, and schedules are
all equal under the Workbench protected snapshot. No activation change,
schedule change, or webhook identity/behavior change is requested.

## Exact topology and route proof

Node additions: `build-gemini-body`, `gemini-classify`,
`build-processed-note`.

Node removals: `resolve-inbox-path`, `prepare-capture`, `build-inbox-note`.

The only retained-node change is `handle-file-check` at
`/parameters/jsCode`. The strict manifest declares four connection additions,
four removals, all ten required candidate edges, and the four removed edges as
forbidden. Its exact post-migration graph therefore rejects unlisted node,
parameter, type, and connection changes.

`tools/n8n-save-to-mind-route-proof.mjs` additionally proves the retained
webhook reaches both fixed HTTP write boundaries through the approved graph;
the internal forced-failure branch reaches the same destination builder; the
only default destinations are `inbox/new` and `inbox/failed`; the only
overrides are `MIND_INBOX_PATH` and `MIND_FAILED_PATH`; `capture/inbox` and
`capture/failed` are forbidden; and there is no schedule trigger, second
webhook, external-write bypass, or extra write branch.

## Fixture adapter evidence

`docs/contracts/save-to-mind-fixture-adapter-v1.json` and its implementation
define only `success` and `failure` fixtures with validated timestamped IDs.
Payload is internally constructed from the fixed template. The adapter accepts
no caller content, URL, method, headers, or environment overrides; requests at
most once with zero retries, a 30-second timeout, redirects disabled, bounded
classification, replay rejection before a duplicate request, and no raw
response or credential output.

The read-only evidence inspector is injected only with a test root, while its
public operation accepts only fixture kind and ID. It reads no content and
inspects only `inbox/new`, `inbox/failed`, `capture/inbox`, and
`capture/failed`. It returns bounded metadata only. Synthetic fixture evidence
is committed under `tests/fixtures/save-to-mind-adapter/`.

## Validation and operational boundary

All evidence checks are offline; fake clients and fake filesystem roots are
used for fixture tests. The real Workbench verifier has no stable supported
CLI, so Brain validates installation semantics locally and CWFM-18 remains the
final generic authority. No n8n request, webhook invocation, deployment,
restart, credential access, grant provisioning, Mind write, Workbench change,
or push occurred.

## Next step

Rerun CWFM-18 read-only against the new committed Brain HEAD. Provision CWFM-19
only if CWFM-18 passes; do not execute B1.0a yet.
