# Agent Mode H0-G External Live Acceptance Evidence — 2026-09-17

Status: **BLOCKED — disposable-boundary permissions unavailable**
Starting HEAD: `907b8f75 test(agent-mode): classify absent Harness capabilities`
Run ID: `h0g-20260917-113630`

## Decision

The explicit H0-G authorization in the current task was recognized. It
authorizes two independent disposable packets: provider outage/recovery and
remote BrainNode host-loss/reconnect, with mandatory teardown. The packets
could not proceed because the configured AWS provisioner identity denied the
first required disposable-boundary mutation, `iam:CreateRole`. No fallback to
a shared or production identity/resource was permitted. Both packets are
therefore recorded as **BLOCKED**, not `PASS`, `FAIL`, or `INCOMPLETE`.

No billable H0-G resource was created. No live Bedrock inference, EC2 host,
remote BrainNode, SSH/Tailscale route, S3 object, or H0-G IAM resource exists
from this run.

## Starting-state and safety reconciliation

- AWS caller identity was available through the configured `provisioner`
  wrapper. Account metadata was checked without reading credential files or
  `operations/accounts/credentials-index.md`.
- AWS account ID: `909439522876` (non-secret account metadata required for the
  exact effect ledger).
- The configured region and repository-authoritative Agent Mode Bedrock region
  are `us-east-1`.
- The current account is not assumed to be production or sandbox; the packet
  required every resource to be newly created, H0-G tagged, dedicated, and
  exact-ID cleaned. That boundary could not be established.
- H0-A, H0-B, H0-C, H0-D, H0-E, and H0-F remain valid from their committed
  evidence. H0-F keeps `sandbox_denial` and `tool_denial` at
  `structural_pass`; only `provider_outage` and `host_loss_reconnect` remain
  external-sensitive live blockers.
- HEAD contains H0-F and no H0-G implementation or prior live acceptance was
  present. No unexpected staged changes were introduced.
- Protected paths were not read, modified, staged, or committed.

The H0-B six-hour wall-clock gate remains valid because this run changed no
production scheduler, StateStore, runtime lifecycle, or resource-stability
behavior. H0-C remains valid because no production security-sensitive source
changed; this run attempted only the authorized disposable boundary and
stopped at denied IAM creation.

## Frozen bounds and cleanup manifest

The pre-mutation manifest was created outside Git at:

`/tmp/brain-h0g-20260917-113630-tbDJjb/cleanup-manifest.json`

It froze:

- maximum lifetime: 45 minutes;
- maximum simultaneous compute: 1;
- maximum instance class: `t3.micro` or cheaper;
- maximum root disk: 8 GiB gp3;
- maximum temporary object payload: 150 MiB;
- maximum provider spend: USD 0.25;
- maximum total estimated external spend: USD 2.00;
- worst-case pre-create estimate: USD 0.50;
- exact-ID destruction only.

The run root contained only non-secret policy documents and the cleanup
manifest. No credentials, STS material, provider responses, node secrets, or
private repository content were written.

## Provider packet

### Boundary and model selection

The intended provider boundary was one dedicated temporary IAM role trusted
only by the current provisioner role, with only `bedrock:Converse` and
`bedrock:InvokeModel` on the exact MiniMax M2.5 foundation model ARN. MiniMax
M2.5 was selected as the lowest-cost model already admitted by the Brain
ModelGateway portfolio and previously verified in `us-east-1`; its repository
pricing is USD 0.30/input million and USD 1.20/output million.

The provider packet was frozen at three maximum real requests: baseline,
outage attempt, and recovery; 256 input tokens/request; 64 output
tokens/request; zero application retries; zero fallback attempts; 180 seconds;
USD 0.25 provider spend. No model request was authorized before the disposable
role existed.

### Boundary attempt and result

The first mutation attempted was:

`iam:CreateRole` for the unique H0-G role name
`brain-h0g-provider-20260917-113630`, with H0-G tags and the narrow trust
policy. AWS returned `AccessDenied`; the role was not created. A catalog
probe also returned `AccessDenied` for `bedrock:ListFoundationModels`, so no
fresh callable-model claim was made.

Provider result: **BLOCKED** before credentials or inference.

| Provider effect | Count | Result |
|---|---:|---|
| disposable provider IAM roles created | 0 | denied before create |
| provider IAM policy mutations | 0 | not attempted |
| temporary STS credentials | 0 | not issued |
| Bedrock inference requests | 0 | not run |
| provider inference network calls | 0 | not run |
| Bedrock catalog control-plane attempts | 1 | access denied; no inference |
| input/output tokens | 0 | not measured |
| retries | 0 | 0 |
| fallback attempts | 0 | 0 |
| actual provider spend | USD 0.00 | no inference |
| Codex reserve effects | 0 | untouched |
| Brain StateStore/domain mutations | 0 | not run |

No outage deny policy was attached, no recovery call was made, and no false
success or fallback was possible.

## Remote BrainNode packet

The remote packet required one dedicated instance IAM role/profile for SSM,
one EC2 `t3.micro` or cheaper instance with an 8 GiB-or-smaller gp3 root,
read-only `repo.read`, a disposable fixture repository, and a genuine EC2
stop/start host-loss cycle. It would have used at most two domain commands,
one stop, one restart, 180 seconds, and zero repository writes.

The required dedicated instance role could not be created under the same
provisioner identity (`iam:CreateRole` is denied). The remote packet therefore
stopped before EC2 creation. No shared instance profile, public SSH, personal
MacBook node, Office node, production BrainNode identity, or Tailscale route
was used.

Remote result: **BLOCKED** before node or compute creation.

| Remote effect | Count | Result |
|---|---:|---|
| EC2 instances created | 0 | not attempted |
| EC2 stops/starts | 0 | not run |
| S3 buckets/objects | 0 | not attempted |
| SSM provisioning commands | 0 | not run |
| NodeTransport connections | 0 | not run |
| BrainNode domain commands | 0 | not run |
| repository reads | 0 | not run |
| repository writes | 0 | 0 |
| SSH operations | 0 | 0 |
| Tailscale operations | 0 | 0 |
| provider calls | 0 | 0 |

## Cleanup and verification

There were no H0-G-created AWS resources to destroy, so the dependency-safe
destroyer sequence had no AWS deletion step. Exact-name and exact-run-tag
queries verified:

- provider role: absent (`NoSuchEntity`);
- node instance profile: absent (`NoSuchEntity`);
- H0-G-tagged EC2 instances: 0;
- H0-G-tagged EBS volumes: 0;
- H0-G node security group: 0;
- H0-G S3 bucket/object: none created; the account-wide bucket listing itself
  was permission-denied and no bucket mutation was attempted.

No local H0-G child process was started. The temporary run root was removed
after these checks using its exact path. Remaining disposable resources: **0**.
Cleanup status: **PASS (nothing created)**.

## Security and authority review

The run preserved all hard boundaries:

- no production/shared IAM role, policy, security group, VPC route, provider
  configuration, credential, BrainNode, Office StateStore, scheduler, or
  repository was modified;
- no live model, ModelGateway, Bedrock inference, MiniMax, GLM, Opus, Codex,
  Harness, BrainNode domain, Workcell, repository-write, or external remote
  effect occurred;
- no secret value was printed or persisted;
- no provider fallback, retry, quota change, marketplace enrollment, or
  network fault was manufactured;
- no protected unrelated worktree path was touched.

H0-C security-review validity: **unchanged and valid**.
H0-B soak validity: **unchanged and valid**.

## H0 matrix after this run

The repository's current hardening matrix has 16 enumerated classes; the
historical report's exact rows are retained here rather than silently
compressing that matrix to 15:

| Fault class | Current status |
|---|---|
| `provider_outage` | BLOCKED — live disposable role unavailable |
| `bedrock_budget_exhaustion` | PASS — prior fixture evidence |
| `codex_quota_exhaustion` | PASS — prior fixture evidence |
| `host_loss_reconnect` | BLOCKED — live disposable node boundary unavailable |
| `process_crash_restart` | PASS — prior live/local evidence |
| `stale_lease` | PASS — prior live/local evidence |
| `duplicate_delivery` | PASS — prior live/local evidence |
| `stuck_agent` | PASS — prior live/local evidence |
| `spawn_limit` | PASS — prior fixture evidence |
| `sandbox_denial` | `structural_pass` — H0-F |
| `tool_denial` | `structural_pass` — H0-F |
| `corrupted_state` | PASS — prior fixture evidence |
| `accelerated_soak` | PASS — H0-B wall-clock gate |
| `security` | PASS — H0-C audit |
| `auditability` | PASS — prior fixture evidence |

H0-G status: **BLOCKED**.
H0 status: **IN PROGRESS / RELEASE GATE INCOMPLETE**.

## Validation disposition

This run changed no Brain Core or Console source. After cleanup, the focused
H0/K4/NodeTransport/K5 regression selection passed **181/181** tests. The full
Brain Core suite passed **2,627/2,627** tests with zero failures, cancellations,
skips, or todos. `npm run typecheck` passed and `npm run build` passed. `git
diff --check` passed. No Console revalidation was required because Console
source was unchanged.

The full suite's existing diagnostic-only error-recovery log lines were
expected test fixtures; they did not fail tests. No historical unrelated
failure recurred in this run.

## Exact next prerequisite

The exact remaining blocker is AWS authorization for a dedicated disposable
H0-G IAM boundary: `iam:CreateRole` (and the corresponding narrow policy,
instance-profile, and cleanup permissions). Once that capability is granted
through the approved non-production provisioning path, rerun this same bounded
H0-G packet. Do not use a shared or production identity/resource.
