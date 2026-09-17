# Agent Mode H0-G2 External Live Acceptance Evidence — 2026-09-17

Status: **BLOCKED — provider outage and remote NodeTransport gates did not
produce valid live acceptance**

Starting HEAD: `a257e413 test(agent-mode): record disposable H0 live acceptance`

Run ID: `h0g2-20260917-140014`

## Decision

This was a corrected rerun of H0-G after the historical run was blocked by the
wrong IAM namespace. The configured provisioner successfully created the
dedicated `claude-codex-ec2-*` boundary and one disposable EC2 host. The
provider baseline produced one valid real Bedrock result, but the authorized
temporary deny-policy outage attempt unexpectedly succeeded, so outage
classification was inconclusive. The real `SshNodeTransport` path was then
verified against the disposable host and blocked before delivery because the
local machine does not have `session-manager-plugin`; no inbound SSH was
opened. The remote BrainNode domain gate therefore did not run.

H0-G2 is **BLOCKED**, not PASS. H0 remains **IN PROGRESS** and its release gate
remains incomplete. The prior historical report is unchanged.

## Reconciliation and authorized boundary

- Starting revision was `a257e413`; no K0–K4 or BrainNode production source was
  changed.
- H0-A through H0-F remain valid from committed evidence. The current
  hardening fixture has 15 fault classes: 13 non-blocked prior/structural
  results and the two external-sensitive blockers `provider_outage` and
  `host_loss_reconnect`.
- AWS account: `909439522876`; region: `us-east-1`.
- Provisioner identity was the configured `ClaudeCodexProvisioner` role;
  destroyer identity was the configured `ClaudeCodexDestroyer` role. No
  credential material was read or printed.
- The provisioner policy was verified for the dedicated
  `claude-codex-ec2-*` role/profile namespace and bounded EC2/SSM actions. The
  destroyer policy was verified for exact cleanup in the same namespace.
- Bounds were frozen before mutation: one `t3.micro`, encrypted 8-GiB gp3
  root, <=45 minutes, <=USD 2.00 total estimate, <=USD 0.25 provider
  estimate, at most three provider requests, 256 input/64 output tokens,
  zero retries/fallbacks, one stop/start maximum, two BrainNode commands, and
  zero repository writes.

## Disposable resources

| Resource | Exact value | Result |
|---|---|---|
| IAM role | `claude-codex-ec2-h0g2-20260917-140014-a257e413` | created, destroyed |
| instance profile | `claude-codex-ec2-h0g2-20260917-140014-a257e413` | created, destroyed |
| security group | `brain-h0g2-20260917-140014-a257e413` / `sg-0f7daf300e0753fb2` | created, destroyed |
| EC2 | `i-0a8277f4e65a396af` | one `t3.micro`, terminated |
| EBS root | `vol-008e52848e86b4e72` | delete-on-termination, absent |
| VPC/subnet | `vpc-014a8d5dee3a0ab05` / `subnet-0624ebcdd4bc5d8af` | shared existing, unchanged |
| S3 | none | none created |

The security group had no inbound rules. Default egress was retained because
the provisioner boundary did not authorize narrowing it; no shared route,
security group, NAT, EIP, SSH ingress, Tailscale route, or production host was
modified.

## Provider packet

The instance profile trusted EC2 only and had the standard
`AmazonSSMManagedInstanceCore` policy plus an inline allow restricted to
`bedrock:Converse`/`bedrock:InvokeModel` on the exact MiniMax M2.5 foundation
model ARN. The existing Brain `AmazonBedrockModelGateway` and managed Bedrock
executor ran on the EC2 host with model `agent-mode/minimax-m2.5` /
`minimax.minimax-m2.5`.

The valid baseline result was succeeded, 43 input tokens, 2 output tokens,
estimated cost USD 0.000015, retries 0, and fallback attempts 0. A temporary
exact inline deny policy was then installed on the same role. The second real
gateway invocation unexpectedly succeeded under that deny policy, so it is an
**inconclusive outage attempt**, not a denial pass. The allow policy was
restored before teardown. The initial package-layout error occurred before any
Bedrock call and is not counted as an inference request. Valid real Bedrock
calls: 2 of the 3-request bound. A recovery call was not spent guessing after
the outage control failed to produce a denied result. No fallback or retry
occurred.

| Provider effect | Count/result |
|---|---:|
| valid Bedrock inference requests | 2 |
| baseline live pass | 1 |
| outage attempt | 1, unexpectedly succeeded; inconclusive |
| recovery request | 0 |
| retries/fallbacks | 0/0 |
| other live model/provider calls | 0 |
| estimated provider spend | <= USD 0.000030 |

## Remote BrainNode packet

SSM reached the instance and delivered the minimal compiled BrainNode runner,
node enrollment, a read-only fixture file, and Node 22.23.2. The real
repository `SshNodeTransport` was configured with the disposable enrollment,
exact resource binding, `repo.read` only, and AWS Systems Manager's
`AWS-StartSSHSession` proxy document. The proxy could not start because the
local host lacks `session-manager-plugin`; the typed result was
`NodeTransportError(kind=transport_disconnected, deliveryState=transport_unavailable)`.

This is a pre-delivery transport blocker. BrainNode domain commands: 0;
repository reads/writes: 0/0; EC2 stop/start cycles: 0/0. No public SSH or
inbound rule was introduced. Because the real supported transport could not be
used without an unavailable local plugin, no same-host substitute was counted
as host-loss evidence.

## Effect ledger

| Effect | Count |
|---|---:|
| EC2 instances | 1 created, 1 terminated |
| SSM provisioning commands | 18 delivered, setup only |
| BrainNode domain commands | 0 |
| NodeTransport successful connections | 0 |
| EC2 stop/start | 0/0 |
| repository reads/writes | 0/0 |
| AgentRuntime/Harness/Workcells | 0/0/0 |
| ModelGateway calls from Brain Core | 0 |
| Bedrock calls from disposable EC2 | 2 |
| MiniMax/GLM/Opus/Codex calls outside the one Bedrock model | 0 |
| network/prod repository mutations | 0/0 |

SSM and EC2 control traffic was management traffic, not model execution.

## Cleanup and verification

The exact-ID destroyer sequence terminated the instance, waited for
`terminated`, removed the role from its profile, deleted the profile, deleted
both exact inline policies, detached `AmazonSSMManagedInstanceCore`, deleted
the role, and deleted the exact security group. Verification returned the
instance terminated, role/profile/security group absent, root volume absent,
no S3 resources, and zero remaining disposable AWS resources. The local
temporary run root was removed after recording the exact IDs. Protected
unrelated worktree paths were not read, modified, staged, or committed.

## Security and validation disposition

No direct AgentRuntime, Harness, BrainNode production operation, Workcell,
ModelGateway, Bedrock-from-Brain, provider fallback, policy widening,
shared-IAM mutation, public SSH, repository mutation, credential output, raw
provider response, or private repository transfer occurred. The temporary EC2
package used only existing Brain gateway/perimeter code and did not change
repository source.

The disposable packet changed no production Brain Core or Console source. The
post-run focused regression selection passed 181/181 and the full Brain Core
suite passed 2,627/2,627 in the prior H0-G baseline; typecheck, build, and
`git diff --check` were green. No unrelated timing failure recurred and no
Console source was changed. H0-B soak and H0-C security-review validity are
unchanged.

## Hardening decision

| Fault class | Status after H0-G2 |
|---|---|
| `provider_outage` | BLOCKED — deny-policy attempt inconclusive |
| `bedrock_budget_exhaustion` | prior fixture PASS |
| `codex_quota_exhaustion` | prior fixture PASS |
| `host_loss_reconnect` | BLOCKED — local SSM session plugin unavailable |
| `process_crash_restart` | prior live/local PASS |
| `stale_lease` | prior live/local PASS |
| `duplicate_delivery` | prior live/local PASS |
| `stuck_agent` | prior live/local PASS |
| `spawn_limit` | prior fixture PASS |
| `sandbox_denial` | H0-F structural_pass |
| `tool_denial` | H0-F structural_pass |
| `corrupted_state` | prior fixture PASS |
| `accelerated_soak` | H0-B wall_clock_pass |
| `security` | H0-C PASS |
| `auditability` | prior fixture PASS |

H0-G2 status: **BLOCKED**. H0 status: **IN PROGRESS / RELEASE GATE
INCOMPLETE**.

## Exact remaining prerequisite

Make the approved local AWS Systems Manager Session Manager plugin available,
then explain why the exact role deny policy did not deny the instance-profile
call before spending more provider requests. Rerun only the bounded provider
outage/recovery and remote BrainNode stop/start/reconnect packet. Do not open
inbound SSH, use a shared/production identity, or change the provisioner
policy. The exact next task is **H0-G3 — rerun the two external live gates after
restoring the approved SSM session boundary and resolving the exact deny-policy
evaluation**. Do not start it automatically.
