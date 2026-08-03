# B8.1 Benchmark Pin Reconciliation — 2026-08-03

**Status:** reconciliation complete. Independent clean detached source clones resolved the dirty-live-checkout blocker, all selected pins and fixtures were validated, and the canonical non-materializing dry-run emitted an execution-ready plan for exact digest review. B8.1 remains unexecuted and unauthorized for materialization.

**Execution boundary:** this reconciliation did not execute B8.1, use `--materialize`, create or refresh a Codebase Memory index, start an MCP server or watcher, run Graphify, alter a scheduler, access Mind content, modify a source checkout, modify user configuration, or modify a provider binary.

## Landed Brain baseline

- Expected and fetched `origin/main`: `257fd72c3f47a53afb23778ed860976fd2429c71`
- Clean source checkout: `/Users/Office/Repos/stevewesthoek/brain-next`
- Feature worktree: `/Users/Office/Repos/stevewesthoek/brain-b8-1-plan`
- Feature branch: `feature/b8-1-benchmark-plan`
- Initial feature HEAD: `257fd72c3f47a53afb23778ed860976fd2429c71`
- Relationship: feature branch was created directly from `origin/main`; `origin/main` is its ancestor.
- Initial feature status: clean.
- The prohibited dirty checkout at `/Users/Office/Repos/stevewesthoek/brain` was not used as benchmark source evidence.

The landed merge-readiness audit exists at `operations/reports/b8-1-execution-gate-merge-readiness-audit-2026-08-03.md`.

Baseline verification before reconciliation:

- Execution-gate tests: 296/296 passed.
- Live document consistency: passed for 10 files.
- Live deletion readiness: expected exit 1, `SAFE=0`, `PARTIAL=2`, `BLOCKED=17`.

## Source revision inventory — initial snapshot

Status SHA-256 is `sha256(git status --porcelain)` including the exact emitted newline bytes. The empty status digest is the SHA-256 of zero bytes.

| Repository | Read-only source path | Branch | Current HEAD | Status SHA-256 | Manifest pin before reconciliation | Pin relationship |
|---|---|---|---|---|---|---|
| Brain | `/Users/Office/Repos/stevewesthoek/brain-next` | `main` | `257fd72c3f47a53afb23778ed860976fd2429c71` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `9d8c01a5a49e94b6aed1b62d721386c9b9b3416a` | Pin is an ancestor; 15 commits ahead, 0 behind. |
| Workbench Private | `/Users/Office/Repos/prochattools/saas/workbench-private` | `main` | `f482851457c4505bcbf98dd02c469728f61ab427` | `947df94e08524ecfd3165705d7386fdea47797a6a665247edb39de67fcf41676` | `aa7bf7ec97d0b0973ee3d322c689d44a6c8f539e` | Pin is an ancestor; 12 commits ahead, 0 behind. Checkout is dirty. |
| ProChat | `/Users/Office/Repos/prochattools/web/prochat` | `main` | `e404821bfeef0868fef9f42a14ede4926aabe6ef` | `858593d05c347c40461186229c676e6636460307e56c733fca10355f7d4f4b85` | `9bcd5769da33a851edea379431916f7e04890ff7` | Pin is an ancestor; 5 commits ahead, 0 behind. Checkout is dirty. |

All three pinned commits exist locally.

### Complete status porcelain — Brain

```text
(empty)
```

### Complete status porcelain — Workbench Private

```text
 M .graphifyignore
 M apps/macos/Sources/WorkbenchHelper/main.swift
 M apps/macos/Sources/WorkbenchMac/AppState.swift
 M apps/macos/Sources/WorkbenchMac/XPC/HelperActivationLifecycle.swift
 M apps/macos/Sources/WorkbenchMac/XPC/HelperLifecycleManager.swift
 M apps/macos/Sources/WorkbenchMac/XPC/PortableHostSupervisor.swift
 M apps/macos/Sources/WorkbenchMac/XPC/WorkbenchHelperXPCService.swift
 M apps/macos/Sources/WorkbenchMacApp/main.swift
 M apps/macos/Tests/WorkbenchMacTests/CrashProofSettingsTests.swift
 M apps/macos/Tests/WorkbenchMacTests/PhaseQActivationTests.swift
 M apps/macos/Tests/WorkbenchMacTests/TestRunner.swift
 M apps/macos/Tests/WorkbenchMacTests/XPCInvalidationRecoveryTests.swift
 M apps/macos/scripts/build-app.sh
 M apps/macos/scripts/install-app.sh
 M apps/macos/scripts/status.sh
 M apps/web/src/app/api/openapi/route.ts
 M decision-log.md
 M docs/operations/native-runtime-and-mcp.md
 M docs/product/architecture/phase-p-native-control-plane-adr.md
 M docs/product/native-macos-end-state-guardrail.md
 M docs/product/roadmap.md
 M graphify-out/cache/stat-index.json
 M package.json
 M packages/cli/src/agent/cbm-graph-context.ts
 M packages/cli/src/agent/graph-context-router.ts
 M packages/cli/src/agent/indexer.ts
 M packages/cli/src/agent/portable-read-handlers.ts
 M packages/cli/src/agent/server.ts
 M scripts/benchmark-native-acceptance.mjs
 M scripts/generate-macos-release-manifest.mjs
 M scripts/install-staged-macos-app.mjs
 M scripts/macos-release/artifact-manifest.mjs
 M scripts/macos-release/artifact-manifest.test.mjs
 M scripts/macos-release/entitlements/NodeRuntime.entitlements
 M scripts/macos-release/release-readiness-lib.mjs
 M scripts/portable-core-host.ts
 M scripts/portable-host-handlers.ts
 M scripts/restart-installed-macos-app.mjs
 M scripts/smoke-packaged-portable-host.mjs
 M scripts/stage-macos-app.mjs
 M scripts/verify-graph-context-router.ts
 M scripts/verify-macos-release-readiness.mjs
 M scripts/verify-native-topology.mjs
 M scripts/verify-portable-host-packaging.mjs
?? .build/
?? AGENTS.md
?? apps/web/.env.local.BAK
?? docs/product/plans/gui-only-restart-proposal.md
```

### Complete status porcelain — ProChat

```text
 M src/app/(marketing)/App.tsx
 M src/app/docs/DocsThemeLayout.tsx
 D src/app/docs/docs-public-chrome.css
?? src/assets/styles/prochat-public-chrome.css
```

## Pin-to-HEAD commit review

### Brain — 15 commits

1. `e10dca69eccabd127e027130541309261704e444` — reconcile Workbench provider after stabilization merge.
2. `a438817b892150f92b145713792d7e6c9ee75fc2` — add runtime-truth hardening and the B8.1 plan.
3. `fe7324aedc17c4440aff993ed773e6852a475d94` — make runtime-truth validation import-safe and fail closed.
4. `6b66f06fbaa163581e9c96bb0e942e3badf70c18` — correct B8.1 sequencing and safety boundaries.
5. `e92c6d01cc94d423438d242c0b02de13523c692c` — converge provider/runtime verification.
6. `6e0a28832e63cef7c9c5d133de9fa7ea3a32bf0e` — add pinned manifest and dry-run preflight.
7. `1cb9f7e085d893e33abdc4bc8371b953616f3dac` — harden the execution gate, structured verification, and evidence schema.
8. `c2e57d9b590cb15a65f050f9ddb6e9dc0e0f6aab` — add local Ajv dependency resolution.
9. `dbad000a0a8a94050187ecfed1d1d51bd3d7f516` — use local Ajv in validators.
10. `1cb007beecf52dd9acd611fe2a5e262c58119865` — harden preflight and materialization gates.
11. `3f043ee02eebc766338dc44a237154b368fd21cb` — ignore `node_modules`.
12. `5243331f337b1bc9463255f1ce5ecc189923ac35` — make exported-tree validation authoritative and fail closed.
13. `e987aaa7eb8a19b1cd939a1131d2b35c7486a81a` — require full validation and approved-plan binding.
14. `24ac9e30d63438a5c87fd01a864db799f262c343` — complete the benchmark execution gate.
15. `257fd72c3f47a53afb23778ed860976fd2429c71` — merge-readiness audit and final corrections.

Aggregate changed paths:

```text
.gitignore
operations/reports/b8-1-execution-gate-merge-readiness-audit-2026-08-03.md
operations/reports/post-merge-mcp-runtime-truth-audit-2026-08-02.md
operations/reports/roadmap-audit-2026-08-01.md
operations/reports/workbench-mcp-provider-post-merge-readmission-2026-08-02.md
operations/runbooks/infinite-brain-roadmap-status.md
operations/specs/b8-1-context-memory-benchmark-evidence.schema.json
operations/specs/b8-1-context-memory-benchmark-manifest.json
operations/specs/b8-1-context-memory-benchmark-manifest.schema.json
operations/specs/b8-1-context-memory-benchmark-plan.md
operations/specs/b8-1-network-deny.sb
operations/specs/infinite-brain-runtime-implementation-plan.md
operations/specs/mcp-provider-admissions.json
operations/system-configs/mcp/b1-0a-guarded-save-to-mind/README.md
operations/system-configs/mcp/workbench/README.md
package-lock.json
package.json
tools/lib/b8-1-network-isolation-child.mjs
tools/lib/mcp-provider-verification.mjs
tools/lib/mcp-provider-verification.test.mjs
tools/prepare-b8-1-context-memory-benchmark.mjs
tools/prepare-b8-1-context-memory-benchmark.test.mjs
tools/validate-b8-1-benchmark-evidence.mjs
tools/validate-b8-1-benchmark-evidence.test.mjs
tools/validate-b8-1-benchmark-manifest.mjs
tools/validate-b8-1-benchmark-manifest.test.mjs
tools/validate-brain-document-consistency.mjs
tools/validate-brain-document-consistency.test.mjs
tools/validate-mcp-provider-admissions.mjs
tools/validate-mcp-provider-admissions.test.mjs
tools/validate-mcp-runtime-truth.mjs
tools/validate-mcp-runtime-truth.test.mjs
```

Fixture review:

- `brain_f1`: path, symbol, line 21, callee, and file hash are unchanged.
- `brain_f2`: path, symbol, line 73, callers/callees, and file hash are unchanged.
- `brain_f3`: admitted tool set remains exactly `getWorkbenchStatus`, `readWorkbenchContext`, `runWorkbenchCommand`. The containing admission changed from `active-local`/Workbench `1.3.1-beta` at `be780050...` to fail-closed `candidate`/`1.3.3-beta` at `aa7bf7ec...`; the fixture asks only for the admitted tool set, which is unchanged. The new runtime-truth validator now exists at the refreshed pin.
- `brain_f4`: path, symbol, line 255, caller/callees, and file hash are unchanged.
- CBM provider identity remains version `0.9.0`, revision `b637e333...`, candidate status, and the same admitted tool inventory.

Classification: **admissible pin refresh**. Security boundaries became stricter; fixture paths, symbols, lines, sets, counts, and retrieval semantics did not weaken. The Brain repository pin and all four Brain fixture pins are refreshed to landed main. The manifest source path is changed from the prohibited dirty `brain` checkout to the clean read-only `brain-next` checkout.

### Workbench Private — 12 commits

1. `7a46c0353aa9d623d0cf4253ff101b21b32a3215` — authenticate native ingress bridge.
2. `7a843b82813ce70c06312c2b1076d92929e867a9` — consolidate native/MCP operations and add runtime validation.
3. `0c9836d085fa0b8a3f700ece530b46c4119af3e5` — make live health verification authoritative.
4. `6997a08f63f18f6f08d324574f2a36c94f01607a` — add manifest-driven macOS activation preflight.
5. `a64376f68c3a27d9b231a1c51ba9facda6e1f676` — correct Q8E1 evidence and transport docs.
6. `b7a8fd64ae9a88ce21e4a9f51f1703e217ff2b5b` — add native run lifecycle tests.
7. `2416a5a3eeb78fb73c5906116891e9a53087db53` — complete native run provider integration.
8. `e7c990b035fb2b8a693b9ecbfb2d283e8283de3f` — add native run provider implementation.
9. `085bc5b0239e63284aacd24b1647a131dbfb2546` — add bounded XPC invalidation recovery.
10. `b7d700838fcfc86335f6b760b57b632c73f8c3a3` — record XPC recovery implementation.
11. `5141c0f41daf0f95fa1f226d87c320b0dfdfa67a` — add XPC invalidation recovery tests.
12. `f482851457c4505bcbf98dd02c469728f61ab427` — prepare GUI stability release candidate.

Aggregate changed paths:

```text
.nvmrc
CLAUDE.md
apps/macos/Sources/WorkbenchMac/AppState.swift
apps/macos/Sources/WorkbenchMac/Views/ContentView.swift
apps/macos/Sources/WorkbenchMac/Views/RunDashboardView.swift
apps/macos/Sources/WorkbenchMac/XPC/HelperLifecycleManager.swift
apps/macos/Sources/WorkbenchMac/XPC/HelperProvider.swift
apps/macos/Sources/WorkbenchMac/XPC/NSXPCConnectionHelperClient.swift
apps/macos/Sources/WorkbenchMac/XPC/NativeRunProvider.swift
apps/macos/Sources/WorkbenchMac/XPC/XPCHelperClient.swift
apps/macos/Tests/WorkbenchMacTests/NativeRunLifecycleTests.swift
apps/macos/Tests/WorkbenchMacTests/TestRunner.swift
apps/macos/Tests/WorkbenchMacTests/XPCInvalidationRecoveryTests.swift
docs/mcp-codex-registration.md
docs/operations/native-runtime-and-mcp.md
docs/product/agent-mode-progress.md
docs/product/plans/native-source-management-follow-up.md
package.json
packages/mcp/package.json
packages/mcp/src/client.ts
packages/mcp/src/configure-claude.ts
packages/mcp/src/configure-codex.ts
packages/mcp/src/configure-core.ts
packages/mcp/src/health.ts
packages/mcp/src/tests/client.test.ts
packages/mcp/src/tests/health.test.ts
scripts/generate-macos-release-manifest.mjs
scripts/inspect-macos-signing-readiness.mjs
scripts/install-staged-macos-app.mjs
scripts/macos-release/activation-preflight.mjs
scripts/macos-release/activation-preflight.test.mjs
scripts/macos-release/artifact-manifest.mjs
scripts/macos-release/artifact-manifest.test.mjs
scripts/macos-release/process-inspector.mjs
scripts/macos-release/process-inspector.test.mjs
scripts/macos-release/signing-readiness-inspector.mjs
scripts/macos-release/signing-readiness-inspector.test.mjs
scripts/restart-installed-macos-app.mjs
scripts/verify-node-runtime.mjs
```

Fixture review:

- `workbench_f1`: the literal and callers remain unchanged, but a new Node `20.20.2+` runtime contract moves `BRAIN_PROFILE_ALLOWED_TOOLS` from line 7 to line 35. The file hash changes from `914d6a70...` to `56c21ff5...`. A repin therefore requires an exact fixture line and notes-hash update.
- `workbench_f2`: path, symbol, line 7, literal, and file hash `4dd2731c...` remain unchanged.
- Security boundaries change materially: native ingress now verifies the derived MCP credential against the owner action token; registration validates the Node runtime; health verification is explicit; bounded cancellation and ambiguity behavior is added. The three-tool Brain allowlist and `n8n_workflow_migration` command-kind allowlist remain exact.

Initial classification: **requires fixture update and a clean source checkout**. The live checkout was ineligible, but the 2026-08-04 disposable-source resolution validated the same committed HEAD from a clean detached clone. The manifest now pins `f482851457c4505bcbf98dd02c469728f61ab427`; `workbench_f1` is updated to line 35 with file hash `56c21ff5b4d8323a64e3d58643e10332253b3b2cf1c3a033eaff23614d2a01f3`. No expected assertion is weakened.

### ProChat — 5 commits

1. `998f3ec488de5e63ab56abb8dc4df7d479f7cfa9` — reduce CSS payload on privacy/terms routes.
2. `9d1e4080cc24876299b77b2d5bb68ed2be5c2096` — remove render-blocking Google Fonts import.
3. `70fe808ba1b764719840d1a81ca1cb766239d4dc` — remove Framer Motion from the not-found route.
4. `de23c97483099de474c2a44c85b80fe48f416058` — add canonical LCP attribution evidence.
5. `e404821bfeef0868fef9f42a14ede4926aabe6ef` — isolate docs/homepage CSS.

Aggregate changed paths:

```text
docs/platform/PERFORMANCE_STRATEGY.md
docs/product/agent-mode-progress.md
package.json
scripts/run-canonical-performance.mjs
src/app/(marketing)/App.tsx
src/app/(marketing)/layout.tsx
src/app/(marketing)/memory-qa/page.tsx
src/app/(marketing)/memory/page.tsx
src/app/(marketing)/prochat-home.css
src/app/(marketing)/workbench/page.tsx
src/app/docs/DocsThemeLayout.tsx
src/app/docs/docs-public-chrome.css
src/app/docs/layout.tsx
src/app/not-found.tsx
src/assets/styles/globals.scss
tests/performance/canonical-performance-attribution.mjs
tests/performance/canonical-performance-attribution.test.mjs
```

Fixture review:

- `prochat_f1`: `src/app/layout.tsx`, `RootLayout` at line 74, callees, and file hash `bc882d15...` are unchanged.
- `prochat_f2`: exact `route.ts` count remains 27.
- `prochat_f3`: webhook path, `POST` at line 9, callees, and file hash `997de32e...` are unchanged.
- `prochat_f4`: Prisma path, symbol at line 7, callers/callee, and file hash `b4728c62...` are unchanged.
- The committed delta is presentation/performance work and does not change provider identity, security boundaries, or retrieval semantics for these fixtures.

Classification: **content-admissible pin refresh**. The live checkout was ineligible, but the 2026-08-04 disposable-source resolution validated the committed HEAD from a clean detached clone. The manifest now pins `e404821bfeef0868fef9f42a14ede4926aabe6ef`; the four ProChat fixture assertions and content hashes are unchanged apart from their pinned commit.

## Manifest reconciliation

Exact changes:

1. Brain repository `localPath`: `../../../brain` → `../../../brain-next`, avoiding the prohibited dirty Brain checkout.
2. Brain repository `pinnedCommit`: `9d8c01a5...` → `257fd72c...`.
3. `brain_f1` through `brain_f4` pinned commits: `9d8c01a5...` → `257fd72c...`.
4. Active benchmark plan repository table: `../../../brain` → `../../../brain-next`.
5. Workbench repository and fixture pins: `aa7bf7ec97d0b0973ee3d322c689d44a6c8f539e` → `f482851457c4505bcbf98dd02c469728f61ab427`.
6. `workbench_f1`: line 7 → 35; file hash `914d6a70...` → `56c21ff5b4d8323a64e3d58643e10332253b3b2cf1c3a033eaff23614d2a01f3`; verification line updated to 35. The command-kind literal remains at line 36.
7. ProChat repository and fixture pins: `9bcd5769da33a851edea379431916f7e04890ff7` → `e404821bfeef0868fef9f42a14ede4926aabe6ef`.
8. No expected path, symbol, literal, set, count, caller, callee, or scoring assertion is weakened. The only fixture line/hash change records the exact moved Workbench literal.

## Export validation and dry-run gate

The authoritative validator passed against exact `git archive` exports of all three selected pins:

```text
b8-1-benchmark-manifest-valid=true
```

Focused fail-closed checks passed:

| Case | Result | Cleanup |
|---|---|---|
| Missing fixture path | Rejected with `file not found` | Temporary root removed. |
| Changed symbol/line | Rejected with `not found at line` | Test temporary root removed. |
| Count mismatch | Rejected with `file count mismatch` | Test temporary root removed. |
| Set mismatch | Rejected with `set mismatch` | Test temporary root removed. |
| Symlink escape | Rejected with `symlink escape` | Test temporary root removed. |
| Wrong pinned commit | Rejected by the preflight manifest check | Test repository and run root removed. |

Focused negative-case total: 6/6 passed (five repository tests plus one direct missing-path assertion). No `brain-b81-*` temporary export remained.

Those historical live-checkout attempts correctly stopped. On 2026-08-04, independent clean detached clones supplied through the complete, explicit `--source-root` mapping resolved the source-state gate without changing either live checkout. The canonical command then exited 0 with `executionReady: true`, `materialized: false`, no blocking checks, subjects `cbm,exact-source`, and Graphify excluded.

The exact emitted plan digest is `7840db6cc15f53260e920b86e666bedd3730becedfa788d6c8451871939802f5`. The complete digest-bound object is preserved at `operations/reports/b8-1-canonical-dry-run-plan-2026-08-04.json` (file SHA-256 `683ff4051e9fa5215febb2d0dc13bc322ed340085d2a3eb328335da398b024e4`) so every check record and all 21 planned paths are reviewable. This digest is review evidence only; it is not execution authorization. No gate was weakened to obtain the result.

## Final Brain validation

- All nine execution-gate suites: 307/307 passed (the earlier historical epoch passed 296/296 before the source-root tests were added).
- Authoritative exported-tree manifest validation: passed.
- Live document consistency: passed for 10 files.
- Live deletion readiness: expected exit 1 with `SAFE=0`, `PARTIAL=2`, `BLOCKED=17`.
- Edited JSON parse: passed.
- Changed-file secret scan: passed.
- `git diff --check`: passed.
- Report and preserved-plan whitespace checks: passed.
- Temporary validator exports remaining: 0.
- Canonical run root absent; no benchmark state was materialized.
- Required source-state invariant: passed in the 2026-08-04 disposable-source epoch. The independent clones were clean and exact, and the live Workbench and ProChat HEAD/status fingerprints were unchanged from the beginning to the end of that epoch.
- Pre-landing structural and independent adversarial review: all actionable evidence-preservation and root-binding coverage findings were corrected; no unresolved finding remains.

## Historical live-checkout source-state invariant

During the first validation epoch, Brain and Workbench Private retained their initial HEAD and status fingerprints. ProChat retained HEAD `e404821bfeef0868fef9f42a14ede4926aabe6ef` but its status fingerprint changed:

- Initial: `858593d05c347c40461186229c676e6636460307e56c733fca10355f7d4f4b85`
- Final observed: `1521345e6facbba590eff52b40087a1c7d04eeac5ddd28c59b3282e557f0d26f`
- Newly observed porcelain entry: ` M src/app/(marketing)/components/product-pages/PublicProductPage.tsx`

Codex did not write to ProChat. The first epoch was discarded. A second evidence epoch was established with ProChat status fingerprint `1521345e6facbba590eff52b40087a1c7d04eeac5ddd28c59b3282e557f0d26f`, and all nine execution-gate suites and final validators were rerun.

After the first feature-branch commit was pushed, the required post-push check found a second concurrent source change. Workbench Private retained HEAD `f482851457c4505bcbf98dd02c469728f61ab427`, but its status fingerprint changed:

- Previous: `947df94e08524ecfd3165705d7386fdea47797a6a665247edb39de67fcf41676`
- Newly observed: `bc49872ad61126ba71c05008ccb27728cb0f0770f4644b6923741237a4062b74`
- Newly observed porcelain entry: ` M apps/macos/Sources/WorkbenchMac/XPC/NSXPCConnectionHelperClient.swift`

Codex did not write to Workbench Private. The second epoch was also discarded. A third evidence epoch was established with the Workbench status fingerprint `bc49872ad61126ba71c05008ccb27728cb0f0770f4644b6923741237a4062b74`. All nine execution-gate suites passed 296/296 again, and the authoritative manifest, live document-consistency, live deletion-readiness, JSON, whitespace, secret, and temporary-export checks were repeated.

Immediately after those checks, Workbench Private changed again while retaining HEAD `f482851457c4505bcbf98dd02c469728f61ab427`:

- Previous: `bc49872ad61126ba71c05008ccb27728cb0f0770f4644b6923741237a4062b74`
- Last observed during reconciliation: `692a606f1ac1ad2a4828ec35f92e0a6d302bfe8e79729aaaff83afc612d4602c`
- Newly observed porcelain entry: ` M "apps/macos/Tests/WorkbenchMacTests/Phase P-XPCConnectionTests.swift"`

The third epoch was discarded. The required unchanged-fingerprint invariant therefore **failed** in that historical epoch, and no stable final source-state table was asserted for it. Brain remained at clean HEAD `257fd72c3f47a53afb23778ed860976fd2429c71`; ProChat's last observed HEAD/status pair remained `e404821bfeef0868fef9f42a14ede4926aabe6ef` / `1521345e6facbba590eff52b40087a1c7d04eeac5ddd28c59b3282e557f0d26f`. Workbench Private and ProChat were ineligible for repinning in that epoch.

## Historical continuation audit — repeated clean-source gate

At the start of this continuation audit, the feature worktree was clean and pushed at `ad316a8812a00f1bd0761944eee2c14cc5d7278d`; remote `main` remained `257fd72c3f47a53afb23778ed860976fd2429c71`.

The required external source state still did not exist:

| Repository | Branch / HEAD | Observed status SHA-256 | Remote `main` | Result |
|---|---|---|---|---|
| Brain | `main` / `257fd72c3f47a53afb23778ed860976fd2429c71` | `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | `257fd72c3f47a53afb23778ed860976fd2429c71` | Clean and exact. |
| Workbench Private | `main` / `f482851457c4505bcbf98dd02c469728f61ab427` | `85e3f7dd254795e5e6e3f20dbad239c0c433fd70ae81ef8f0750e68b6a9d886e` | `18cf611a6703998514575ae9038bc7fe86c689d4` | Dirty and changed again; newly observed entry ` M .gitignore`. Local HEAD is 101 commits ahead of remote `main`. |
| ProChat | `main` / `e404821bfeef0868fef9f42a14ede4926aabe6ef` | `6311a0e3cdd15d4599784660d03022d311f68337769f02bb1a3f8dd24b4bcd03` | `70fe808ba1b764719840d1a81ca1cb766239d4dc` | Dirty and changed again; newly observed entry ` M src/app/(marketing)/contact/ContactPageClient.tsx`. Local HEAD is 2 commits ahead of remote `main`. |

ProChat changed from the prior continuation fingerprint `1521345e6facbba590eff52b40087a1c7d04eeac5ddd28c59b3282e557f0d26f` to `6311a0e3cdd15d4599784660d03022d311f68337769f02bb1a3f8dd24b4bcd03` without a HEAD change. Codex did not write to ProChat; this is another discarded external-source epoch.

Registered-worktree inventory found no eligible alternative:

- Workbench Private has one additional registered worktree, `/Users/Office/Repos/prochattools/saas/workbench-mrp6`, at `be780050a68d4ec95a7f07a1a180881582c57fc0`. It is dirty in four files and diverges from the retained manifest pin `aa7bf7ec97d0b0973ee3d322c689d44a6c8f539e` by 118 pin-only commits and 3 worktree-only commits.
- ProChat has no additional registered worktree.

No source repository or worktree was created, modified, cleaned, reset, or switched during that audit. At that point there was no clean exact-pin source set, so the canonical dry-run command remained prohibited and no `executionReady` or `planSha256` was emitted in that historical epoch.

## 2026-08-04 disposable-source resolution

The feature worktree began clean on branch `feature/b8-1-benchmark-plan` at `c5101a8fa76e31154148b57e9242d225db3ed77a`, matching the remote feature branch. Fetched `origin/main` remained fixed at `257fd72c3f47a53afb23778ed860976fd2429c71`.

The live source repositories were fingerprinted before any disposable checkout was created and again after all validation:

| Repository | Live HEAD | Initial status SHA-256 | Final status SHA-256 | Result |
|---|---|---|---|---|
| Workbench Private | `f482851457c4505bcbf98dd02c469728f61ab427` | `85e3f7dd254795e5e6e3f20dbad239c0c433fd70ae81ef8f0750e68b6a9d886e` | `85e3f7dd254795e5e6e3f20dbad239c0c433fd70ae81ef8f0750e68b6a9d886e` | Unchanged; read-only. |
| ProChat | `e404821bfeef0868fef9f42a14ede4926aabe6ef` | `5c7139e3b1e6d2a5128fecb9a674693e4e1a8d9dabeaac09171d7f70f77a0b0e` | `5c7139e3b1e6d2a5128fecb9a674693e4e1a8d9dabeaac09171d7f70f77a0b0e` | Unchanged; read-only. |

Independent detached clones were created under `/tmp/b8-1-sources.qhkwvd` at the exact selected commits:

- Brain: `257fd72c3f47a53afb23778ed860976fd2429c71`
- Workbench Private: `f482851457c4505bcbf98dd02c469728f61ab427`
- ProChat: `e404821bfeef0868fef9f42a14ede4926aabe6ef`

All three detached checkouts had empty porcelain status. Exact `git archive` exports validated all 10 fixtures. Workbench's security boundaries are strengthened by the refreshed delta and its moved fixture is recorded exactly. ProChat's delta is content-admissible, and its fixture content hashes remain unchanged.

The harness now accepts a repeatable `--source-root repoId=/absolute/path` option without changing default behavior. An override set must cover the manifest repository IDs exactly; each root must be absolute, traversal-free, an existing nonsymlink Git top-level, clean, and at the exact pinned commit. Unknown, missing, duplicate, dirty, wrong-commit, and traversal-bearing mappings fail closed. The override mapping participates in the source-state hash and plan digest. The focused preparation and manifest suites pass 89/89, including the required override cases, a dry-run-to-approved-materialization lifecycle test with the same exact roots, an authoritative repository-root-binding test whose manifest-local root is absent, unknown/dual-binding rejection, and temporary-export cleanup.

The canonical dry-run used all three explicit clean roots and returned:

- `executionReady: true`; `materialized: false`; blocking checks: none.
- Selected subjects: `cbm`, `exact-source`; excluded subject: `graphify`; partial evidence: true.
- `planSha256`: `7840db6cc15f53260e920b86e666bedd3730becedfa788d6c8451871939802f5`.
- Manifest: `sha256:91805c0a67d923e42ee090119140ad2591e0ed179d16e9f7ee2e3e03d1edd6f7`.
- Manifest schema: `sha256:b2c10030cbc7e937f92a03db4245b7b65132bfa1621d83fbba27fa667c4a6ecc`.
- Evidence schema: `sha256:62fa2b034037b391be094564475f4d9f079a95fae78d602db0092c22a94128a1`.
- Source-state hash: `sha256:d43d9ca2ac8acab940e48094e2c5c6d6db21bf2bcfc78bcff62d860fef52069a`.
- CBM stable launcher: `/Users/Office/.local/bin/codebase-memory-mcp`; resolved provider: `/Users/Office/.local/lib/brain/providers/codebase-memory-mcp/v0.9.0/codebase-memory-mcp`; version `v0.9.0`; SHA-256 `d9fbdd7d8570a77b2fb32453e00bd52a02627281309cd56003a4eccfcfe878d6`.
- Network isolation passed with `/usr/bin/sandbox-exec`, Node `v25.9.0`, a successful control, a started child process, and a denied connection (`EPERM`).
- The plan enumerated 21 paths under `/Users/Office/.brain`; the proposed run root was `/Users/Office/.brain/benchmark/b8-1/runs/b8-1-canonical-plan-20260804`. The complete path set and all other digest inputs are preserved in `operations/reports/b8-1-canonical-dry-run-plan-2026-08-04.json`.
- The proposed run root was not created. No index, MCP server, watcher, scheduler, provider, user configuration, Mind content, or source checkout was changed.

After the final report data was captured, the exact disposable root `/tmp/b8-1-sources.qhkwvd` was removed and verified absent. Because its physical paths are digest-bound, any later operation using this exact approved digest must first recreate clean detached roots at the same paths and commits; otherwise it must emit and obtain approval for a new digest.

## Canonical truth retained

- B8.1 benchmark not executed.
- B8.1 incomplete.
- B8.2 unauthorized and incomplete.
- Graphify blocked and excluded from the requested partial subject set.
- P8 remains 0/6 accepted.
- A dry-run plan is not execution authorization.
- Materialization requires separate human approval of the exact emitted digest.

## Exact next action

Human owner must review `operations/reports/b8-1-canonical-dry-run-plan-2026-08-04.json` and the exact plan digest `7840db6cc15f53260e920b86e666bedd3730becedfa788d6c8451871939802f5`. Materialization may occur only in a separately authorized operation that explicitly approves that exact digest and recreates the recorded clean roots at the exact digest-bound paths and commits; a different mapping requires a new reviewed digest. Benchmark execution, B8.2, and Graphify remain unauthorized.
