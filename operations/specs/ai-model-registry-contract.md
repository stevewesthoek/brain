# AI Model Registry Contract v1

**Status:** MRU0-P2.3 implementation contract

**Runtime authority:** Legacy configuration remains the candidate source. The
registry lifecycle is an admission gate for known provider/model identities;
the registry is not a replacement candidate source.

## Purpose

The registry gives Brain one provider/model lifecycle and admission vocabulary
without changing current selection behavior. It describes existing provider
and model facts, compatibility identifiers, safety constraints, and evidence
state. It does not invoke providers, perform access probes, or grant execution
authority.

## Authority boundary

During MRU0-P2.1 and MRU0-P2.2:

- `ai-providers.json` remains the provider selector source.
- `ai-bedrock-models.json` remains the detailed Bedrock model source.
- `ai-task-types.json` remains the task and private-Mind policy source.
- `ai-model-registry.json` is a parity-only canonical registry artifact.
- `core.py` loads it through `runtime/registry_shadow.py` for comparison only.
- `selector_service.py` exposes the non-authoritative `GET /registry/shadow`
  report.
- `core.py` continues to select exclusively from the legacy configuration.
- A missing, invalid, or mismatching registry cannot auto-admit a model.

During MRU0-P2.3:

- legacy configuration continues to provide candidate metadata and the
  provider inventory;
- a known registry model is selectable only in `admitted` or `preferred`
  lifecycle state;
- `enabled: false` always blocks selection, regardless of access or
  `upgrade_candidate`;
- `upgrade_candidate` remains evaluation/migration metadata and never grants
  selection authority;
- an unavailable registry preserves already-enabled legacy models during the
  compatibility rollout, but never promotes a disabled upgrade candidate.

Later packets may replace legacy candidate reads only after parity, rollback,
and acceptance gates pass.

## Provider contract

Each provider record contains:

- `provider_id`: stable Brain provider identity;
- `adapter_ref`: provider-adapter ownership reference;
- `lifecycle_state`: provider admission lifecycle;
- `access_state`: configured or observed access state;
- `supported_environments`: environments in which the adapter may operate;
- `capabilities`: existing selector capability vocabulary;
- `safety_constraints`: provider safety requirements and policy references;
- `last_verified_at`: evidence timestamp, or `null` when not live-verified;
- selection/runtime compatibility metadata needed for parity.

## Model contract

Each model record contains:

- `registry_model_id`: stable registry identity;
- `provider_id`: owning provider;
- `provider_model_binding`: the provider-specific model identifier and region;
- `capabilities`: supported selector capabilities;
- `profile_compatibility`: reserved compatibility mapping for future abstract
  profiles;
- `lifecycle_state`: `discovered`, `evaluated`, `admitted`, `preferred`,
  `deprecated`, or `retired`;
- `health_state` and `access_state`;
- `cost_metadata` and `latency_metadata`;
- `evaluation_evidence`;
- `safety_constraints`;
- `compatibility_aliases` for existing labels and IDs;
- `last_verified_at`.

Concrete provider model IDs appear only in `provider_model_binding` or
`compatibility_aliases`. They are not policy identifiers in this contract.

## Lifecycle and admission

| State | Meaning | Normal selector eligibility |
|---|---|---|
| `discovered` | Observed or declared, not yet evaluated | No |
| `evaluated` | Compatibility/evidence review completed | No by default |
| `admitted` | Explicitly approved for selection | Yes |
| `preferred` | Admitted and included in active ranking policy | Yes |
| `deprecated` | Retained for compatibility only | No by default |
| `retired` | Explicitly removed from selection | Never |

Provider access or a successful health probe never promotes a model. Admission
requires capability verification, context/tool compatibility, health/access
evidence, cost/latency metadata, evaluation evidence, provider adapter support,
and applicable safety constraints. Access and health alone never promote a
model.

Discovery may be automatic where a provider supports reliable discovery. Where
it does not, a bounded reviewed registry synchronization is required. Neither
path may auto-admit a model.

## Initial compatibility mapping

The repository currently uses capabilities such as `text/small`,
`text/medium`, `text/large`, `text/review`, `text/large-context-batch`, and
`audio/transcribe`. MRU0-P2.1 preserves these values. It does not finalize a
new `fast`/`standard`/`deep`/`specialist` profile taxonomy. The
`profile_compatibility` field exists so that a later contract decision can map
abstract profiles without putting concrete model IDs into policy.

## Safety boundaries

This registry packet:

- adds no providers or models;
- does not change provider authority;
- does not change Claude Code, Codex, or Workbench interactive authority;
- does not execute model calls or access probes;
- does not authorize automation, remediation, or infrastructure mutation;
- preserves private Mind tasks as Claude Bedrock-only and fail-closed.

The registry describes selection eligibility. Provider adapters retain any
future invocation authority, and environment adapters retain final interactive
session authority where applicable.
