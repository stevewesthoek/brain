# IKHP Runtime Ownership and Onboarding Acceptance

**Date:** 2026-09-05
**Status:** repository-only proof accepted; live integration remains separately gated

## Decision

Runtime ownership is an extension of IKHP and I&A, not a new ownership plane.
The catalog is the authoritative non-secret model for resources, relationships,
service bindings, environment/isolation references, and governance metadata.
I&A remains authoritative for account, credential, session, runtime-profile,
secret-store, lifecycle, and verification entities. Application-managed
sessions and provider-managed credentials remain outside Brain custody.

## Machine-readable answers

1. **What is the resource?** A catalog resource with `resourceClass` plus an
   open `resourceKind` such as runtime, configuration, route, connector, or
   browser session.
2. **Which application/runtime is it?** Resource relationships and governance
   runtime/profile bindings identify the consumer and adapter without treating a
   local directory, browser profile, or port as the identity.
3. **Which account is expected?** A stable I&A `account:` reference; multiple
   account references are allowed when adapter capacity is `many`.
4. **Where is the credential?** A separate I&A credential with an opaque store
   reference, lifecycle policy, and verification policy; no value is catalogued.
5. **Who owns session state?** The owner declared by the I&A session and
   resource governance. Application-managed sessions stay application-owned.
6. **Who owns runtime/profile state?** The runtime adapter declares isolation,
   process ownership, concurrency, and capacity; Brain records and checks the
   declaration.
7. **Who owns mutable configuration?** Exactly one confirmed authoritative
   owner, with custody and mutation actors separately declared. Conflicts fail
   closed.
8. **Who owns a route?** Each active `routes_to` relation must declare one
   route owner and its writers. Multiple writers require an explicit transfer
   policy.
9. **What does it depend on?** Active `depends_on` relations declare required
   versus optional dependency, availability phase, disruption risk, and
   recovery reference.
10. **Can it be changed now?** Only after health, dependency, revision,
    approval, rollback, and—when required—observed quiescence evidence pass.
    Active or unobservable workloads block governed mutation.
11. **Is production isolated from development?** Explicit environment and
    isolation boundary references are required. Sharing a boundary across
    environments fails unless `shared-approved` is explicit.
12. **How does a new consumer enter?** `discover → candidate → classify →
    validate → resolve ambiguity → admit → participate`. Discovery produces
    evidence/candidates only; the admission planner is pure and non-mutating.

## Proof fixtures

- `operations/fixtures/infrastructure-onboarding-alternate-v1.json` proves the
  same contract for two hypothetical consumers, including admitted and
  unresolved candidate states.
- `operations/fixtures/infrastructure-codex-web-gpt-metadata-v1.json` maps a
  Codex Web GPT production/development runtime, application-owned browser
  session, connector, loopback/API bridge, route owner, two opaque account
  references, and `many` account capacity. Credential custody remains unknown
  until evidence. The fixture has no cookies, OAuth values, tokens, or provider
  payloads.

Native Codex CLI/IDE and Codex Web GPT are separate adapters. `CODEX_HOME`,
browser profiles, ports, tunnels, and connectors are implementation evidence,
not canonical identity or a reason to copy authentication state.

## Validation

Passed:

```text
npm run validate:infrastructure-governance
npm run test:infrastructure-governance
npm run test:infrastructure-actions
npm run validate:infrastructure-actions
npm run test:infrastructure-catalog
node tools/validate-infinite-brain-contract-registry.mjs
```

The Brain Core projection is read-only and reports governance coverage through
`readInfrastructureGovernance`; action preflight consumes optional workload
evidence while retaining `executionEnabled=false` and `actualEffects=[]`.

The active consumer/observation/catalog checks were aligned to the current
canonical `host:vm-supabase` identifier; historical reports may still mention
the superseded display identifier.

## Next gate

Create an account-neutral runtime-adapter observation contract and perform one
human-approved, read-only observation of a real consumer's process/profile/
session boundary. Resolve ownership and capacity from evidence before any
credential enrollment, live provider probe, guided reauthentication, or
application-managed session recovery.
