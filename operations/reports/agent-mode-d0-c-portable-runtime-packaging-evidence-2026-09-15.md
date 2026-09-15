# Agent Mode D0-C Portable Runtime Packaging Evidence — 2026-09-15

## Decision and starting state

D0-C is **COMPLETE**. D0 remains **IN PROGRESS**. Starting HEAD was
`c62abd72 feat(agent-mode): add reproducible lean-core bootstrap`. D0-A and
D0-B are present and committed; no service registration, installation, VPS,
Tailscale, migration, or H0 work was opened. The protected Firecrawl log and
the two unrelated roadmap paths remained untouched and unstaged.

D0-B's committed evidence honestly did not contain the terminal summary's
reported `2,588/2,588` full-suite aggregate. This report does not rewrite that
historical evidence; it records the D0-C validation actually observed below.

## Packaging strategy audit

Core is strategy **B**: its existing build produces prebuilt JavaScript in
`dist` (with declarations/tests excluded from the package), but runtime imports
still require dependencies. The package therefore includes Core runtime
`package.json` and authoritative `package-lock.json` metadata for deterministic
future production dependency hydration. It does not vendor arbitrary
`node_modules` and does not claim `dist` alone is self-contained.

Console is strategy **B/C boundary resolved to standalone-traced**: the
existing Next build was audited first in normal mode, then `output: 'standalone'`
was enabled narrowly and rebuilt. The generated runtime contains its traced
dependencies, required `.next` server assets, `.next/static`, and existing
`public` assets. `.next/cache` and build traces are excluded. The old
`outputFileTracingRoot: process.cwd()` was removed because it embedded the
Office checkout path into generated server metadata. Generated absolute paths
in remaining text artifacts are normalized to `/brain-package-root` during
staging and the verifier rejects any residual personal path.

The standalone artifact was launched from an isolated package root with
temporary HOME and port `4982`; `GET /agents` returned successfully. No
checkout fallback was required. The package startup contract uses structured
references (`node core/dist/index.js` and `node console/standalone/server.js`),
not shell command strings.

## Runtime package contract

`projects/brain-core/src/agent-mode/runtime-package.ts` defines the strict
versioned `brain-runtime-package-v1` contract. It contains release revision,
platform/architecture class, Node/npm ranges, closed component/dependency
strategies, normalized relative file records, structured startup references,
the `brain-runtime-config-v1` template reference, required external secret
*names* only, optional capabilities, package ID, and manifest hash.

The package layout is:

```text
manifest.json
core/dist/*.js
core/package.json
core/package-lock.json
console/standalone/**
console/static/**
console/public/**                 (only when present)
config/brain-runtime-config.example.json
```

Core, Console, and config-template are the only package components. Personal
integrations, BrainNode binaries, voice models/audio, provider credentials,
StateStore SQLite/WAL/SHM, runtime state, logs, tests, declarations, source
trees, Git metadata, and `.next/cache` are not package contents.

## Bounds, identity, and verification

The manifest is bounded to 20,000 files, 100 MiB per file, and 500 MiB total.
Every file has a normalized package-relative path, component, SHA-256, size,
and content class. No symlinks are accepted. Copied files are normalized to
mode `0644`; the verifier rejects group/other-writable files. `.git`, cache,
logs, coverage, temporary paths, environment/key/database files, and unsafe
paths are rejected. Unexpected files, missing files, deleted files, and
symlink entries fail verification.

Package identity is deterministic SHA-256 over non-secret canonical material:
schema/revision/platform/architecture, component strategies, runtime contract,
startup/config declarations, and sorted file records. It excludes HOME,
absolute source/staging roots, timestamps, PIDs, and secrets. The manifest hash
is separately deterministic. The fixture reproducibility test produced equal
IDs, hashes, file records, and startup semantics under different output roots;
the real staged package contained 2,448 files and 64,153,288 bytes.

This is a semantically reproducible package boundary. The package builder is
deterministic for identical verified artifacts, but this report does not claim
byte-for-byte reproducibility across separate framework rebuilds where Next
may emit legitimate build variance.

## Provenance, platform, and dependencies

Packaged-release builds require explicit release/source revision material and do
not use target-host Git metadata. Git is a build-machine provenance aid only;
the package has no `.git` requirement at startup. Source-development remains
available through the explicit source root. Platform classes are typed as
`darwin`, `linux`, or `unsupported`, and architectures as `arm64`, `x64`, or
`unsupported`; this package was built for `darwin/arm64`. Core's `pg` runtime
closure is handled by production hydration metadata. Console's standalone
closure contains platform-sensitive traced packages (including Next image/SWC
support), so portability is package-platform-specific rather than universal.

The non-secret config example contains portable HOME-relative state defaults,
loopback ports, unavailable optional capabilities, and empty references. It
does not serialize packaging-machine auth presence. Required external secret
names are documented in the manifest; values remain an installation/runtime
handoff concern.

## Failure and security evidence

Focused tests cover deterministic identity, bounds, allowlists, path
normalization, fresh-target-only behavior, cleanup after build failure,
symlink rejection, tamper/hash failure, extra-file failure, missing-file
failure, unsupported platform, secret/state/personal-path exclusion, and no
shell startup authority. The real package scan found no `/Users/Office`,
`/Users/Steve`, secret files, databases, logs, or cache directories. The
Console generated metadata that referenced the Office checkout was sanitized
in the staged artifact; the source build configuration no longer sets a
host-specific tracing root.

The package builder writes only to a fresh explicitly supplied output root and
removes that exact owned root if construction fails. It never installs npm
dependencies, edits source, writes StateStore state, registers/starts an OS
service, deploys, contacts a registry/provider, or mutates Tailscale/SSH/AWS.
The verifier is read-only and works from an arbitrary cwd.

## Validation

- D0-C focused package tests: **5/5 passed**.
- D0-B bootstrap tests: **6/6 passed**; D0-A portable-config tests: **9/9
  passed** in the prior D0-B validation and remain included in the full Core
  suite.
- Real package build and verifier: **passed**.
- Isolated staged Console `/agents` startup: **passed** on temporary port
  `4982`, with clean foreground shutdown.
- Core typecheck/build: **passed** after the final implementation.
- Console typecheck/build: **passed** with Next standalone output.
- Full Brain Core suite: **2,593/2,593 passed** (the five D0-C package tests
  are included in this fresh post-change aggregate).
- `git diff --check`: **passed**.
- External effects during normal D0-C validation: network/registry/AWS/
  Bedrock/Codex/Tailscale/SSH/BrainNode/Harness/Workcells/model/provider
  calls, service registration, and deployment: **0**.

## Remaining D0 matrix and next task

- Portable configuration profiles: **COMPLETE** (D0-A).
- Bootstrap/dry-run installer plan: **COMPLETE** (D0-B).
- Portable runtime package boundary: **COMPLETE** (D0-C).
- Local macOS/Linux installation and service packaging: **READY FOR NEXT
  SLICE**; not started.
- macOS/Linux BrainNode service packaging: **DEFERRED** to that installation
  slice; no OS-specific package was created.
- VPS/Tailscale deployment: **DEFERRED / OPTIONAL**.
- StateStore migration/export/import and future Postgres/DynamoDB backends:
  **NOT STARTED**.
- AgentCore adapters and extension/plugin SDK: **DEFERRED / OPTIONAL**.
- H0 long-duration soak/release gate: **NOT STARTED** and intentionally not
  entered.

The exact next bounded task is **D0-D — Local macOS/Linux Runtime Installation
and Service Packaging Contract**. It is not started automatically.
