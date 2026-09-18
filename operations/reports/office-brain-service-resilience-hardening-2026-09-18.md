# Office Brain Production Service Resilience Hardening — Evidence

Date: 2026-09-18
Starting HEAD: `9acf346d ops(mac): reconcile Moonlock Genieo detection`

## Outcome

The bounded resilience hardening slice is implemented and the live production
doctor passes without changing the running RC.6 services. The selected strategy
is `Candidate A`: retain the external Homebrew Node dependency, but verify the
executable, version, immutable release identity, launchd descriptors, process
ownership, and StateStore before service installation or operational acceptance.

Release decision: `NO_NEW_RELEASE_REQUIRED`.

No production restart, release replacement, database write, provider call, or
network operation was performed by this work.

## Starting-state and production health gate

The starting state was reconciled before editing. The protected unrelated paths
were left unchanged and unstaged:

- `operations/accounts/credentials-index.md` (pre-existing user modification)
- `tools/firecrawl/logs/firecrawl.log` (pre-existing user modification)
- `operations/specs/mindcontrol-product-roadmap.md` (pre-existing untracked file)
- `operations/specs/nevermind-release-pipeline-roadmap.md` (pre-existing untracked file)

The production health gate passed:

- Core PID `72595`, launchd-owned, HTTP `4877` healthy.
- Console PID `75201`, launchd-owned, HTTP `4881` healthy.
- Active immutable RC.6 package:
  `brain-runtime-package:sha256:ff5809be3a48b01cd393e1817241f19e9b79556117b17035ce044090cfda3cfe`.
- Canonical StateStore exists at
  `/Users/Office/Library/Application Support/Brain/agent-mode/state/agent-mode/agent-mode.db`.
- StateStore schema version is `10`; SQLite integrity and foreign-key checks
  are clean.
- `/status`, Agent Mode observer, Agent Mode console projection, scheduler
  status, and the `/agents` Console page returned HTTP 200.

## Drift audit

The active services use production labels `com.office.brain-core` and
`com.office.brain-console`. Their descriptor files are the physically deployed
files `com.brain.core.plist` and `com.brain.console.plist` under the managed
Agent Mode services directory. Both descriptors now point to the exact RC.6
release root and use `/opt/homebrew/bin/node`, which resolves to Homebrew Node
`v26.8.2` at `/opt/homebrew/Cellar/node/26.8.2/bin/node`.

The recovery evidence identified the earlier outage conditions as:

- `LAUNCHD_SERVICE_UNLOADED`: supported production labels were absent from the
  user launchd domain.
- `DEPENDENCY_FAILURE` / `MISSING_RUNTIME_FILE`: `/opt/homebrew/bin/node`
  referenced the absent Node `25.9.0_1` Cellar path.
- `BROKEN_SERVICE_DESCRIPTOR`: production descriptors referenced the rollback
  baseline instead of RC.6.

The bounded evidence did not establish why the labels were unloaded. The
doctor therefore treats unload, dependency drift, descriptor drift, and
StateStore drift as independent fail-closed conditions.

## Runtime strategy

The current RC.6 package declares an external Node contract of `>=22.5.0` and
does not embed Node. The host policy for the repaired production machine is
stricter and requires Node major `26`, minimum `26.8.2`, with the executable
resolved and hashed during inspection.

The considered strategies were:

1. External Homebrew Node with bounded verification — selected. This is the
   smallest change and preserves the immutable RC.6 package; it remains
   exposed to Homebrew unlink/upgrade drift, which is now detected before
   acceptance.
2. A Brain-owned immutable Node installation — stronger host independence but
   a larger packaging and lifecycle change, out of scope for this slice.
3. Embed Node in a future signed runtime package — strongest release coupling,
   but requires a new package format/release and is not needed to repair the
   current host.

No active RC.6 package or source release was modified.

## Service doctor contract

`projects/brain-core/src/agent-mode/service-resilience.ts` adds the bounded,
read-only `brain-service-resilience-v1` contract and doctor. It verifies:

- absolute non-checkout, non-rollback release root;
- expected package identity and source revision;
- executable existence, realpath, version, major, and minimum version;
- production launchd labels, descriptor labels, arguments, working directory,
  lifecycle policy, runtime environment, and external secret-file reference;
- one loaded Core process and one loaded Console process;
- StateStore existence, schema version, SQLite integrity, and foreign keys.

`brain-agent local install apply` now inspects the actual selected Node
executable before writing descriptors. Missing, non-executable, wrong-major,
or below-minimum Node fails closed. The existing same-identity local install
path remains idempotent; the doctor itself is read-only.

The live command completed with `PASS` for every check, including both
descriptors, both launchd labels, the RC.6 package, Node `v26.8.2`, one process
per service, and the StateStore.

## Tests and validation

Focused tests passed:

- service resilience tests: `6/6`;
- local-install, release-maintenance, and service-resilience combined focus:
  `14/14`.
- Brain Core typecheck: passed.
- Brain Core build: passed.
- `git diff --check`: passed.

The full Brain Core suite was also started. It reached the historically
problematic live-model/restricted-Harness area and exited nonzero after the
bounded observation window. The reported failures were outside the
service-resilience code path, including:

- E2 positive scheduler/restricted-Harness path;
- ten redeliveries;
- concurrent scheduler claimers;
- crash after child creation/assignment;
- crash after assignment;
- uncertain Harness execution;
- unsupported reconciliation;
- crash after worker settlement.

The run also reported the existing restricted-Harness runtime failure
(`dsh profile "sdk-minimal"` / plugin-tree loading) and live Minimax test
failures. The long-running run was then interrupted after it stopped making
progress in the same Harness subprocesses; it was not repaired or broadened
into this goal. The focused service-resilience and release-maintenance tests
remained green.

## Operational handoff

The release-maintenance and runtime-surfaces runbooks now document the doctor
command, production label/descriptor distinction, install-root versus release
root, Node/Homebrew drift risks, outage classifications, and the no-restart
acceptance procedure. The runbooks explicitly keep repair authorization separate
from read-only diagnosis.

The prior Moonlock false-positive remains an operational observation: do not
whitelist or disable detection; capture the exact path and timestamp and
reconcile it through the existing endpoint/security procedure.

## Mutation ledger

For this slice:

- Core stop/start: `0`
- Console stop/start: `0`
- StateStore writes: `0`
- release activation/rollback: `0`
- model/provider/AWS/Bedrock calls: `0`
- SSH/Tailscale operations: `0`
- BrainNode/Workcell operations: `0`
- public publish/deploy: `0`

## Exact next task

No additional production mutation is authorized by this slice. The next task is
separately authorized host maintenance if Node/Homebrew drift recurs, or a
future release slice to embed the doctor/preflight contract in an immutable
runtime package. Do not start either automatically.
