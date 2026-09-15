# Agent Mode D0-D Local Install and Service Packaging Evidence — 2026-09-15

## Decision and reconciliation

D0-D is **COMPLETE**. D0 remains **IN PROGRESS**. Starting HEAD was
`9eba7c7c feat(agent-mode): add portable runtime packaging`.

D0-A, D0-B, and D0-C are landed. D0-C's committed evidence truthfully records
the fresh full Core aggregate `2,593/2,593`; its D0-B discrepancy note remains
unchanged. The top-level D0 roadmap status is normalized to D0-A/B/C/D
complete, with D0 still in progress. The protected Firecrawl log and two
unrelated roadmap paths were not edited, staged, or committed.

## Existing service surface audit

The current host-activation packet is personal Office/MacBook migration
material. It explicitly does not call `launchctl`, and is not reused as an
installer. Existing `ssh:macbook` BrainNode deployment and node-local paths are
implementation-instance state, not portable service identity. No portable local
installer, LaunchAgent/systemd integration, or D0 service package existed at
the starting boundary. Existing Core/Console startup remains the D0-C
structured package contract; BrainNode remains optional.

## Local installation contract

`projects/brain-core/src/agent-mode/local-install.ts` defines
`brain-local-install-v1`. A verified `brain-runtime-package-v1` is mandatory
before apply. The layout is:

```text
<install-root>/
  releases/<package-id>/       immutable verified payload
  state/                       mutable Brain state, outside release
  config/brain-runtime-config.json
  services/                    inert descriptors
  install.json                 bounded deployment metadata
```

The deterministic install identity uses package identity, versioned release
root, state/config contract, platform, architecture, Node executable, and
service strategy; it excludes secrets, PID, timestamp, HOME, and Office
identity. A fresh target only is accepted. Same verified package reapplies
idempotently and does not rerun the fake hydrator; unknown/non-empty targets
fail closed. Existing state/config/secrets are not deleted or overwritten.
Failed construction removes only an installer-created fresh root.

The install receipt contains no Agent/Task/Run/Attempt state, provider data,
credentials, full environment, or secret values. Before activation rollback is
discarding the unactivated release/descriptors while preserving state, config,
and secrets. Upgrade cutover, uninstall, state migration, and active-version
switching remain out of scope.

## Dependency and secret contracts

Core remains strategy B from D0-C. The exact future production hydration
contract is the fixed allowlisted command `npm ci --omit=dev` in the versioned
release root, using the committed lockfile; no `npm install`, global prefix,
source checkout `node_modules`, or lockfile mutation is allowed. A live fresh
hydration may require npm registry/network access. D0-D plan and standard tests
use a fake hydrator and make zero registry/network calls. Console's
standalone-traced closure requires no additional hydration.

Node is an external prerequisite, validated at `>=22.5.0`; no Node bundle or
download is claimed. A target node executable is injected into generated
service metadata, never hard-coded to an Office version-manager path.

Required secret names remain external. Service descriptors refer to a
mode-protected host-local secret file path via Node's `--env-file` argument and
environment reference metadata; values never enter package, descriptor,
receipt, Git, or CLI output. D0-D does not generate secrets or act as a secret
manager.

## User service package

`brain-service-package-v1` contains component, platform, generic label,
structured executable/argv, working directory, config/secret references,
bounded on-failure restart policy, user scope, inert activation state, and
descriptor path. It has no arbitrary caller-selected executable, shell body,
dynamic environment names, or service-manager operation.

macOS renders generic user-level LaunchAgent plist descriptors with
`com.brain.core` and `com.brain.console`, structured `ProgramArguments`, no
LaunchDaemon/sudo, and `activation: not-registered`. Linux renders generic
systemd-user units with structured `ExecStart`, `WorkingDirectory`,
`Environment`, `Restart=on-failure`, `RestartSec=5`, and
`WantedBy=default.target`; no `/etc`, root, or sudo is required. The descriptors
do not reference Office, Steve, MacBook, personal Tailscale, or current repo
paths in the fixture. BrainNode service packaging remains a generic optional
boundary and is not falsely claimed complete because its current deployment
topology is not portable package content.

Service shutdown is ordinary process termination. It is not a Brain cancel,
kill, replay, or database operation. Restart policy is process supervision only
and does not replay uncertain domain effects. Registration/start, health
activation, launchctl/systemctl calls, service cutover, and H0 unattended
resilience remain later explicit work.

## Fixture and verification evidence

Temporary macOS and Linux installs use fake package fixtures, temporary install
roots, external fixture secret references, and fake hydration. They prove
separation, descriptor syntax/content, no service-manager invocation,
idempotent reapply, verified-package gating, conflict rejection, and cleanup.
The installed-release verifier rechecks the copied payload and service refs.
The D0-C real package was also verified and its standalone Console served
`/agents` from an isolated foreground process; D0-D adds no current-host
activation.

## Effect and security counts

Normal D0-D validation performs zero npm registry/general network, AWS,
Bedrock, Codex, Tailscale, SSH, launchctl, systemctl, sudo, service
registration/start, BrainNode remote, Harness, Workcell, model/provider, or
current Office runtime mutations. It does not copy or manipulate SQLite state.
Descriptor/package scans reject secret-like files, personal paths, databases,
logs, caches, symlinks, unsafe paths, shell interpolation, and unverified
payloads. No current Office services, ports, state, secrets, BrainNode, or
activation packet were modified.

## Validation

- D0-D install/service focused tests: **3/3 passed**.
- D0-C package tests: **5/5 passed**.
- D0-B bootstrap tests: **6/6 passed**.
- D0-A portable-config tests: **9/9 passed**.
- Combined focused D0 set: **23/23 passed**.
- Full Brain Core suite: **2,596/2,596 passed**.
- Brain Core typecheck/build: **passed**.
- Brain Console typecheck/build: **passed**.
- `git diff --check`: **passed**.

## Remaining D0 matrix and next task

- Portable configuration profiles: **COMPLETE**.
- Bootstrap/dry-run installer: **COMPLETE**.
- Portable runtime package: **COMPLETE**.
- Local runtime installation contract: **COMPLETE**.
- macOS user-service packaging: **COMPLETE — contract-tested**, not activated.
- Linux user-service packaging: **COMPLETE — contract-tested**, not live-tested
  on Linux.
- Generic BrainNode packaging: **DEFERRED / BLOCKED** by the current
  instance-specific `ssh:macbook` deployment topology; no personal identity is
  encoded.
- VPS/Tailscale deployment: **DEFERRED / OPTIONAL**.
- StateStore export/import and relocation: **READY FOR NEXT SLICE**.
- Postgres/DynamoDB, AgentCore, and extension/plugin SDK: **NOT STARTED /
  DEFERRED**.
- H0 long-duration hardening: **NOT STARTED**.

The exact next bounded task is **D0-E — StateStore Export/Import and
Control-Plane Relocation Contract**. D0-D does not start it automatically.
