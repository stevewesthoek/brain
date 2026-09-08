# Agent Mode K1.1 Evidence — 2026-09-08

## Result

**K1.1 PASS.** The Brain-owned Amazon Bedrock ModelGateway and the
identity/region/route-scoped access evidence gate are implemented and verified.
K1 remains in progress; K1.2 routing, budget, health, and escalation policy was
not started.

## Scope and authorization

The live AWS work was limited to the existing CLI/account configuration,
identity discovery, Bedrock catalog/profile reads, and exactly one tiny
`bedrock-runtime converse` probe for each of the three fixed Agent Mode target
models. Each probe used the fixed trivial prompt `Reply with exactly: OK` and
`maxTokens=16`. No IAM, billing, Marketplace, quota, organization, launcher,
host, DeepSeek Harness, or OmniRoute changes were made.

## Identity and region evidence

| Field | Redacted evidence |
|---|---|
| AWS CLI | `aws-cli/2.34.16` |
| Account | `9094••••2876` |
| Principal | IAM user `claude-code` (ARN/account redacted) |
| Region | `us-east-1` |
| Evidence observed | 2026-09-08, UTC |
| Freshness window | 2026-09-08T22:31:00Z → 2026-09-09T22:31:00Z |

The account and region were obtained from `sts get-caller-identity` and the
configured AWS region. Raw identity output is not stored in this repository.

## Current AWS model metadata

The AWS `list-foundation-models` and `get-foundation-model` results were
reconciled with the current AWS model cards. All three exact foundation model
IDs were catalog-visible and `ACTIVE` in `us-east-1`.

| Agent Mode model | Exact model ID | Limits | Bedrock/API evidence | Route |
|---|---|---:|---|---|
| MiniMax M2.5 | `minimax.minimax-m2.5` | 196K / 8K | `bedrock-runtime`, Converse, on-demand | direct in-region |
| GLM-5 | `zai.glm-5` | 200K / 128K | `bedrock-runtime`, Converse, on-demand | direct in-region |
| Claude Opus 4.6 | `anthropic.claude-opus-4-6-v1` | 1M / 128K | `bedrock-runtime`, Converse, inference-profile-backed | preferred US profile |

AWS sources: [MiniMax M2.5 model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-minimax-minimax-m2-5.html), [GLM 5 model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-zai-glm-5.html), [Claude Opus 4.6 model card](https://docs.aws.amazon.com/bedrock/latest/userguide/model-card-anthropic-claude-opus-4-6.html), and [Bedrock API compatibility](https://docs.aws.amazon.com/bedrock/latest/userguide/models-api-compatibility.html).

The configured `us.anthropic.claude-opus-4-6-v1` profile was separately
returned by `get-inference-profile` as `ACTIVE`, `SYSTEM_DEFINED`, and mapped
to the Opus foundation model in `us-east-1`, `us-east-2`, and `us-west-2`.

## One-probe access evidence

The following is the redacted, route-scoped summary of the one authorized
probe per target. `callable` means the Converse request returned a structured
successful response. It does not claim that a 16-token smoke probe is a
quality benchmark.

| Model | Probe route | Catalog | Callable | Usage (input / output / total) | Final text |
|---|---|---|---|---:|---|
| MiniMax M2.5 | direct `minimax.minimax-m2.5` | visible, ACTIVE | yes | 43 / 16 / 59 | empty: probe budget exhausted on reasoning |
| GLM-5 | direct `zai.glm-5` | visible, ACTIVE | yes | 10 / 2 / 12 | `OK` |
| Claude Opus 4.6 | US profile `us.anthropic.claude-opus-4-6-v1` | profile ACTIVE; base model visible, ACTIVE | yes | 12 / 4 / 16 | `OK` |

No target route was blocked by AWS access. MiniMax's empty final-text field is
recorded as a response-shape observation from the deliberately tiny probe; the
gateway does not leak its reasoning-content block into final text.

## Brain implementation

- `projects/brain-core/src/agent-mode/model-gateway.ts` defines the fixed
  three-model route contract, access-evidence shape, normalized result/usage,
  cost receipt placeholder, and bounded failure vocabulary.
- `projects/brain-core/src/adapters/amazon-bedrock-model-gateway.ts` enforces
  canonical provider/account/region/model/profile identity, fresh verified
  evidence, deadlines, output bounds, operation/attempt correlation, and
  vendor-neutral final-text/usage normalization. It performs no selection,
  fallback, retry, or escalation.
- `projects/brain-core/src/adapters/managed-provider-executor.mjs` now exposes
  the reusable bounded Bedrock CLI transport while retaining the legacy
  managed-text compatibility path. Prompt/model payloads remain in private
  `0600` temporary files and are removed in `finally`.
- `operations/system-configs/model-selector/config/agent-mode-model-portfolio.json`
  records the verified metadata and redacted evidence reference. Selection
  remains disabled until K1.2 defines the tier policy.

## Validation

- K1.1 ModelGateway, portfolio, and managed-provider tests: **12 passed**.
- Deterministic mocked coverage includes exact routes, Opus profile/direct
  handling, override rejection, stale/wrong-account/wrong-region evidence,
  unavailable access, timeout, throttling/provider classification, text and
  reasoning normalization, usage, and private artifact cleanup.
- Model-selector Python suite: **55 passed**; existing selection purity
  regression remains green.
- Registry validator: **valid** (16 models).
- Local-text policy validator: **valid**.
- Brain Core TypeScript check: **passed**.
- Scoped whitespace check: **clean**.

## K1.1 decision and next step

K1.1 is complete for the native gateway/access gate. K1 is not complete and no
live Jarvis/worker execution was started.

Exact next task: **K1.2 — model-tier routing, budget, health, and escalation
policy**, including deterministic admission over the verified K1.1 routes and
explicit Codex resource/quota separation. Do not execute it automatically from
this evidence.

## Blockers

None for K1.1. The only operational note is that a 16-token MiniMax smoke
probe can spend its output budget on reasoning before emitting final text; no
additional probe was run because the authorization allowed one tiny probe per
target.
