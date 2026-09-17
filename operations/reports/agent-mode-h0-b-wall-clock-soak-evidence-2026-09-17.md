# Agent Mode H0-B Wall-Clock Soak Evidence — 2026-09-17

## Decision and starting state

The H0-B work started from `72689dca docs: document Mastermind tunnel hostname
transition`, a legitimate later documentation commit than the expected H0-A
baseline `f157978b`. H0-A was already COMPLETE as the deterministic fixture
foundation. H0 remains IN PROGRESS; this report records H0-B only and does not
claim the H0 release gate or live/security readiness.

The committed H0-A evidence records its final Brain Core result as **2,608/2,608
passed**, with typecheck, build, and diff checks passed. The current post-H0-B
full-suite rerun is recorded below separately.

The initial worktree contained pre-existing unrelated changes in
`operations/accounts/credentials-index.md`,
`tools/firecrawl/logs/firecrawl.log`,
`operations/specs/mindcontrol-product-roadmap.md`, and
`operations/specs/nevermind-release-pipeline-roadmap.md`. They were preserved
and excluded from this scoped change. No BrainNode implementation work was
reopened.

## Bounded wall-clock contract

H0-B uses the explicit opt-in `test:h0-soak` command and the test-only
`agent-mode-hardening-wall-clock-soak.ts` controller. It runs a dedicated
foreground controller with one session-owned child fixture process, a fresh
temporary HOME/TMPDIR, and a fresh temporary SQLite database. The child is
started with `fork`, `shell: false`, minimal environment, ignored stdio, and
IPC only. It is stopped and its exact temporary root is cleaned by the owning
controller.

The workload is one deterministic cycle per minute for 360 cycles over six
hours (`21,600,000` monotonic milliseconds). Cycles use `performance.now()` and
an absolute schedule; there is no accelerated clock, global Date patch, catch-up
burst, daemon, or unbounded loop. A 30-minute / 30-cycle preflight freezes
resource thresholds before acceptance. The final preflight passed in
`/tmp/brain-h0-b-preflight-final6-20260916.json` with threshold digest
`94a0b8d9dd8da357d6cbd0633693e6c638b0914c6fcb986a5a454ef4e9095333`.

Frozen thresholds were:

| Metric | Frozen bound |
|---|---:|
| RSS | 96,362,496 bytes |
| heap used | 15,249,828 bytes |
| active resources | 9; PipeWrap 5 |
| main SQLite file | 1,053,752 bytes |
| per-cycle main-file growth | 1,053,752 bytes |
| cycle latency | 5,000 ms |
| cycle start drift | 5,000 ms |
| scheduler events | 391 |
| audit events | 1,094 |
| evidence refs | 1 |
| missed cycles | 0 |

The resource methodology is the full preflight-sample maximum plus 50% RSS /
heap headroom, eight active-resource slots, a checkpoint-aware bounded main
file ceiling, and exactly 360 planned scheduler events. SQLite main-file size
and WAL/SHM sizes are reported separately: WAL checkpoint relocation is not
mistaken for a leak, while the absolute main-file ceiling remains enforced.

## Six-hour acceptance result

The final acceptance passed with reason `DURATION_REACHED`:

- monotonic elapsed time: `21,600,004.877417 ms`;
- scheduled/completed cycles: `360 / 360`;
- missed cycles: `0`;
- resource samples: `333` across four process generations;
- scheduled/verified fault points: `12 / 12`;
- scheduled process restarts: two at the two-hour boundaries;
- worker restarts including final clean reconstruction: `3`;
- threshold failures: `0`;
- invariant failures: `0`;
- cycle dispositions: `360 completed`, `0 missed`, `0 failed`.

Bounded milestone observations were captured at the scheduled checkpoints:

| Checkpoint | Elapsed ms | Scheduler events | Audit events | Main DB bytes |
|---|---:|---:|---:|---:|
| hour 1 / cycle 60 | 3,540,024.8 | 61 | 15 | 692,224 |
| hour 2 / cycle 120 | 7,140,019.7 | 121 | 17 | 757,760 |
| hour 3 / cycle 180 | 10,740,019.7 | 181 | 21 | 757,760 |
| hour 4 / cycle 240 | 14,340,015.2 | 241 | 23 | 806,912 |
| hour 5 / cycle 300 | 17,940,014.5 | 301 | 25 | 864,256 |
| hour 6 / cycle 360 | 21,540,020.3 | 361 | 27 | 905,216 |

Fault points were fixed at 30-minute boundaries and were all durably verified:

1. duplicate delivery;
2. provider outage and recovery using an injected transport;
3. stale lease and fencing;
4. fixture node disconnect/reconnect;
5. controlled process crash/restart;
6. stuck-agent child TTL expiry;
7. spawn admission denial;
8. restricted-profile / sandbox denial;
9. controlled process crash/restart;
10. corrupted-state rejection;
11. StateStore close/reopen;
12. capability/tool denial.

Restart events occurred at cycles 121 and 241, followed by the required final
clean restart at cycle 360. The post-restart probe is read-only until the
future cycle-360 event exists; after cycle 360, duplicate delivery is verified
without creating another event. This closes the crash-boundary defect found in
an earlier attempt.

## Resource and durable-state observations

Across acceptance samples, the maxima were:

- RSS `58,834,944` bytes;
- heap used `14,749,224` bytes;
- main SQLite file `950,272` bytes;
- WAL `4,136,512` bytes and SHM `32,768` bytes, tracked separately;
- cycle latency `141.116 ms`;
- cycle start drift `5.627 ms`;
- scheduler events `361`;
- audit events `27`;
- evidence refs `1`;
- foreign-key violations `0`.

For the 330 regular post-warm-up cycle samples, latency was p50 `14.600 ms`,
p95 `22.260 ms`, max `141.116 ms`; timer drift was p50 `1.007 ms`, p95
`2.348 ms`, max `5.627 ms`. These remain below the frozen 5,000 ms bounds.

The final clean reconstruction had zero active Agents and children, one
completed K4 fixture Agent lifecycle plus one expired stuck-child fixture Agent,
one Task, one Run, one Attempt, one runtime receipt, one evidence reference,
and two total child creations. The completed lifecycle was classified
`already_completed`; no runtime replay occurred. Budget used and reserved were
both `0`, under the fixture ceiling of `$0.05`. The StateStore remained
observer-readable throughout.

## Authority and side-effect boundaries

The soak composes existing K4 StateStore, scheduler, SpawnPolicy, reservation,
runtime-dispatch, MockAgentRuntime, lease/fence, node-transport, and restricted
profile fixtures. It does not add a production scheduler, alternate result
ledger, provider gateway, recovery policy, or chaos endpoint. The K4 worker is
created through the existing K4 orchestration path; the soak never directly
inserts Agents or Tasks and never calls a live provider.

All live/external effect counts for this acceptance were zero:

| Effect | Count |
|---|---:|
| AgentRuntime / MockAgentRuntime calls beyond the one fixture dispatch | 0 additional |
| ModelGateway, Bedrock, MiniMax, GLM, Opus, Codex | 0 |
| Harness processes | 0 |
| BrainNode commands | 0 |
| Workcells | 0 |
| external/provider network | 0 |
| SSH/Tailscale | 0 |
| Office StateStore or Office runtime state | 0 |
| launchctl/systemctl/service-manager mutations | 0 |
| production repository mutations | 0 |

Provider, node, and runtime references in the changed test fixture are
injected deterministic adapters used only to exercise existing contracts.
No credentials, environment values, prompts, hidden reasoning, provider
payloads, or raw logs are persisted in the bounded telemetry or evidence.

## Validation

- H0-B focused wall-clock unit suite: **5/5 passed**.
- Combined H0/K4 focused suite after the final repair: **206/206 passed**.
- Brain Core `npm run typecheck`: passed.
- Brain Core `npm run build`: passed.
- Brain Core final `npm test`: **2,613/2,613 passed**. An earlier post-soak
  run briefly reproduced the known unrelated `vo-studio-write` metadata-title
  expectation (`STB` versus `Says the Bible`); the final full rerun was green
  and no H0 or K4 test failed.
- `git diff --check`: passed.

The earlier H0-B attempts are retained as audit history, not hidden: one
failed on the SQLite checkpoint boundary, one on the warm-half RSS calibration,
and one on the post-restart future-event probe. Each repair was narrow,
retested with a fresh 30-minute preflight, and the final six-hour run passed
with frozen thresholds.

Brain Console source was not changed by H0-B. Its existing read-only validation
was not broadened into this hardening slice.

## H0 matrix after H0-B

The H0-A gate now distinguishes an isolated wall-clock result
(`wall_clock_pass`) from a live result (`live_pass`). H0-B supplies the former
only. Current bounded classification is:

- `wall_clock_pass`: provider outage/recovery fixture, host/node
  loss/reconnect fixture, process crash/restart, stale lease/fence, duplicate
  delivery, stuck-agent TTL expiry, spawn-limit denial, sandbox denial,
  tool/capability denial, corrupted-state rejection, and auditability through
  time;
- `fixture_pass`: Bedrock budget exhaustion, Codex quota exhaustion, and the
  accelerated-soak foundation;
- `live_pass`: none;
- `not_run`: live provider outage, live remote host loss, and the dedicated
  security release review;
- `blocked`: none;
- `failed`: none.

The fixture and wall-clock statuses do not satisfy the matrix's independent
live-acceptance requirements. No live provider, remote host, or security
review claim is made by this report.

## H0 decision and exact next task

**H0-B: COMPLETE** for isolated six-hour wall-clock soak and resource-stability
acceptance. The evidence proves the bounded isolated fixture, not live provider
acceptance, unattended Office operation, or the dedicated security release
review.

**H0: IN PROGRESS; release gate INCOMPLETE.** The exact next bounded task is
**H0-C — Security Release Review and Live Acceptance Audit**, covering the
remaining security-review and explicitly authorized live acceptance gates. Do
not start it automatically.
