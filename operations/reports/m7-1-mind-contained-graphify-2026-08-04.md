# M7.1 Mind Contained Graphify Acceptance — 2026-08-04

**Status:** pass — one bounded run completed; no recurring Graphify authority granted  
**Owner:** Brain runtime  
**Mind source:** `main` at `06de527423e05d4208cdcf485be92a2d1028c46d`  
**Runner source:** `codex/mind-m7-m2-unblock` at `38464719d96e9eced962c16982ed8bd4597dee66`

## Outcome

Brain executed one authorized contained `graphifyy` run from a clean Git-object
export of exact Mind HEAD. The runner never read Mind working-tree files and
wrote only under Brain's approved operational runtime root:

`runtime/local/graphify/mind-knowledge/`

The successful snapshot is atomically selected by `current`, which points to
`runs/20260804T000604198Z-06de527423e0`. Generated graph output remains
non-authoritative navigation evidence.

## Bound identities

| Identity | Value |
|---|---|
| Mind commit before/after | `06de527423e05d4208cdcf485be92a2d1028c46d` |
| Brain-owned runner commit | `38464719d96e9eced962c16982ed8bd4597dee66` |
| Runner SHA-256 | `cdcfafe45ed9ecbd28beaf2fd783c37a907a7bb0a7f2b8eafe4ebb08dec3e428` |
| Profile | `graphify-mind-knowledge`, catalog `1.1.0` |
| Profile SHA-256 | `8a9f1b142c005ae1cc9a1196e3339ef681ed663fb039c1ccf41eb51002e1f202` |
| Generator | `graphifyy 0.8.36` |
| Generator SHA-256 | `e04e632a74629399b6db20a2e761f2ef8d8aa069e3f96f372fdb46ed884b47cf` |
| Generator mode | `update <contained-corpus> --force --no-cluster` |
| Network/model access | model keys scrubbed and no model requested; OS egress was not independently sandboxed in the completed run |
| Receipt SHA-256 | `d03f2fb3f16dfda2edc323f5166669607fc51389dac7e1ab387c88bae3379bee` |
| Acceptance SHA-256 | `a27431d3381fd9131070627ddf58d60d7ed8d850a3a75b9d00565b8f32ac42b6` |
| Source manifest SHA-256 | `6ce98a5b420efeaf8c15cc4654a10358456f6453b75f5ab081d7eaa5222ec912` |
| Graph SHA-256 | `c17786ed9af9aa5bd49ce9103b1dd98250ea8b82c8a77cca99abce200cf54ea4` |

## Corpus and graph acceptance

| Check | Result |
|---|---:|
| Included Markdown | 591 files |
| Included Mind-owned scripts | 10 files |
| Total corpus | 601 files / 31,206,994 bytes |
| Graph | 6,202 nodes / 5,672 edges |
| Corpus files represented by graph | 601 of 601 |
| Committed `.obsidian/plugins/**` files observed | 29 |
| Plugin-internal files included | 0 |
| Exact Mind HEAD before and after | pass |
| Working-tree source read | false |

The corpus allowlists `.md`, `.mjs`, `.cjs`, `.js`, `.ts`, `.tsx`, `.sh`, and
`.py`. It excludes `.obsidian`, archives, history, generated/build/runtime
output, vendors, dependencies, compatibility graph roots, environment files,
credential/secret/backup-marked paths, and all unrelated binary extensions.

## Failure evidence

Three earlier attempts failed closed before publication while containment edge
cases were corrected. Their receipts remain under `failures/`; all record
`writesToMind=false`. No failed attempt changed `current` or published a partial
snapshot.

## Authority after this run

`currentExecutionAuthority` remains `none` for future runs. The authorization
ID `M7.1-user-request-2026-08-04` covered one successful bounded Mind run only.
The hardened runner now pins the canonical Brain runtime root, keeps a
non-retained authorization-consumption ledger, requires exact corpus coverage,
uses an allowlisted environment, and fails unless macOS denies network access.
The nightly scheduler, broad structural indexing, and semantic synthesis remain
inactive. A future refresh requires a new explicit authorization.

## Mind handoff

Mind may verify the operational receipt and hashes, record its first storage
baseline, project the bounded latest-receipt reference into its authorized
reports, and close M7.1. Brain did not modify Mind.
