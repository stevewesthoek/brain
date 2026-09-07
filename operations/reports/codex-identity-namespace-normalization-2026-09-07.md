# Codex Identity Namespace Normalization — 2026-09-07

## Outcome

The profile-local Codex CLI identity migration is accepted for the two
operator-attested OpenAI accounts. The canonical Identity & Access catalog now
contains:

- `account:openai.01` → `runtime_profile:openai.01.cli`
- `account:openai.02` → `runtime_profile:openai.02.cli`

The mutable policy remains separate from identity: account 01 is preferred and
account 02 is the overflow-capacity account. Neither canonical ID contains
`personal`, `primary`, `secondary`, or another mutable role label.

## Evidence

The live, owner-only evidence is retained under
`/Users/Office/.brain/codex-identity-handoff/`:

- `codex-cli-pilot-acceptance-20260907-2.json` — both profile roots authenticated,
  distinct, safe, and explicitly operator-attested.
- `codex-cli-pilot-launch-check-openai-01-20260907.json`
- `codex-cli-pilot-launch-check-openai-02-20260907.json`
- `codex-cli-pilot-finalize-20260907-2.json` — finalized profile-scoped proof.
- `codex-profile-admission-result-20260907.json` — canonical admission result.

The required coexistence sequence passed:

```text
account 01 → account 02 → reverify account 01 → reverify account 02
```

The sequential CLI status proof also passed:

```text
account 01 → account 02 → account 01
```

Every observation reported authenticated status, owner-only auth-file
permissions, no profile process or lease, distinct `CODEX_HOME` roots, and a
forbidden route mutation. The supported `account/read(refreshToken:false)`
observer did not request refresh tokens and did not persist auth contents.

The provider exposes an email but no stable non-personal principal identifier.
Therefore the final account-to-profile mapping is explicitly
`operator_attested`, not falsely represented as machine-verifiable provider
identity. Raw email, OAuth tokens, and auth-file contents were not persisted.

## Boundary and custody decisions

- Brain owns only non-secret profile configuration and ownership metadata.
- Codex OAuth remains application-owned in each dedicated profile root.
- WebGPT source and production runtime were not touched by this migration.
- MCP-owned OAuth remains with its owning MCP application.
- No Brain-managed credential was selected for this milestone, so no live
  Keychain enrollment was performed.
- Credential health remains read-only and fail-closed; it reports unknown,
  expired, revoked, wrong-account, and provider-outage states without
  artificial keepalive or automatic secret renewal.

## Root cleanup

The unauthenticated legacy roots were archived recoverably, with owner-only
retirement evidence, under:

`/Users/Office/.brain/codex-runtime-profile-retirements/`

The historical v1 packet `91992` was not reused and remains unchanged.

## Validation

Passing gates on 2026-09-07:

- infrastructure catalog validation
- Identity & Access catalog validation
- credential-health validation
- governance validation
- Codex runtime architecture tests: 35/35
- identity handoff tests: 8/8
- runtime profile tests: 12/12
- Codex CLI pilot tests: 6/6
- Codex profile admission tests: 5/5
- Identity & Access tests: 9/9
- Keychain adapter tests: 10/10
- Keychain enrollment tests: 2/2
- credential verification boundary tests: 6/6
- credential-health orchestrator tests: 5/5

The infrastructure catalog emitted 22 pre-existing stale-provenance warnings;
it returned exit code 0 and no validation errors. Governance also returned
`OK` with its existing coverage warnings.

## Implementation correction

The pilot acceptance gate had been incorrectly serializing the asynchronous
app-server account observation as `{}`, causing a false
`authentication_not_confirmed` result. The runtime profile manager now always
awaits the adapter observation result, and a regression test covers asynchronous
observer evidence. Finalize evidence now carries the isolation proof required
by canonical admission.
