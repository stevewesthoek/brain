# MCP Provider Admission Standard

**Status:** active Brain runtime standard  
**Owner:** Brain operations  
**Machine contract:** `operations/specs/mcp-provider-admission.schema.json`  
**Registry:** `operations/specs/mcp-provider-admissions.json`

## Authority boundary

An MCP provider owns its server implementation, domain contracts, authentication
validation, policy enforcement, side effects, audit records, and receipts.
Brain owns whether that provider may be consumed, the exact tools and nested
suboperations exposed to Brain, artifact admission, project registration,
revocation, and capability truth. A consumer request cannot expand either side.

MCP is an adapter, not an authority owner. A project-local TOML registration is
generated runtime configuration; it is never the admission source of truth.

Clients are replaceable. Terminals, applications, IDEs, ChatGPT, Codex, and
future LLMs consume the same admitted capability contracts; no client owns the
provider, grant, policy, or business decision.

## Identity and discovery

- Server names use a stable provider or installation identity, not a client
  brand. Capability namespaces use provider-owned domain terms and remain
  versioned independently from generated client registrations.
- Discovery may advertise only capabilities already admitted for that project.
  Discovery metadata and tool annotations never create authorization.
- Every admission source-locks a provider revision and immutable artifact
  digests. A version, schema, source lock, or digest mismatch fails closed until
  Brain records and validates a deliberate replacement.
- A gitignored generated runtime may be admitted only with a committed
  reproducible-build manifest that binds exact committed source blobs,
  toolchain identity, build commands, the runtime entrypoint, and all required
  runtime artifact digests. The admitted revision may differ from the manifest's
  source revision only by the manifest itself. Brain verifies both Git blobs and
  the actual runtime files; a random or merely hashed working-tree build is not
  runtime provenance.
- Compatibility and development adapters are labeled explicitly, disabled when
  superseded, and retained only until their evidence-backed deletion gate.

## One admission lifecycle

1. The provider publishes a bounded MCP adapter over its existing authenticated
   domain boundary. Product policy must not be reimplemented in the adapter.
2. Brain records one provider admission with provider identity, base revision,
   immutable artifact hashes, transport, authentication reference, exact tool
   and suboperation scope, limits, verification, and revocation.
3. Brain validates both the registry and the installation-local provider files.
   Any unknown field, invalid grant, missing artifact, or digest drift fails
   closed.
4. Brain generates a project-scoped client registration. Credentials remain in
   owner-only storage outside repositories and enter stdio servers by an
   environment reference, never as committed values.
5. The provider enforces the admitted tool and suboperation scope at runtime.
   Mutation-capable calls retain their provider-owned confirmation, replay,
   ambiguity, readback, rollback, audit, and receipt requirements.
6. Drift pauses admission. Revocation removes the generated registration and
   credential reference while preserving source and evidence.

## Transport and authentication profiles

- Local stdio: the client launches a fixed, digest-pinned entrypoint without a
  shell. Credentials are retrieved from an owner-only file via a named
  environment reference. Downstream HTTP, if any, stays loopback-only and still
  requires provider authentication; localhost is not authentication.
- Remote HTTP: use the MCP authorization specification, OAuth protected-resource
  metadata, audience-bound tokens, and resource indicators. Token passthrough is
  forbidden. This profile is not yet admitted for Brain runtime use.

## Scope rules

- Project-scoped by default. Global registration requires its own explicit Brain
  admission and evidence.
- Exact tool names and nested command kinds are allowlisted. Tool annotations are
  hints, not authorization.
- Read, write, and external-mutation risks are explicit. Mutation cannot use
  `approval: none`.
- No arbitrary executable, argv, shell, environment, source root, credential,
  endpoint, or retry policy may come from the MCP caller.
- Ambiguous mutation transport is never blindly retried. Reconciliation and a
  durable operation receipt are required before any next mutation decision.

## Invocation and output rules

- Read and mutation capabilities are separate allowlisted tools or nested
  operations. A read grant never implies a write grant.
- Mutation requires provider-owned confirmation bound to exact source,
  operation, scope, expiry, and replay protection. The MCP client cannot supply
  or broaden approval identity.
- Installation-controlled values—source identity, executable, working root,
  endpoint, credential reference, network target, limits, and retry policy—are
  fixed by provider and admission configuration. Caller-controlled values are
  schema-validated and limited to the admitted operation payload.
- Outputs are typed, size-bounded, secret-redacted, and explicit about
  configured, deployed, observed, verified, blocked, and unknown state. A
  repository artifact cannot be reported as live evidence.
- Mutation results include durable operation and audit receipt identifiers.
  Receipt absence, timeout, malformed output, partial dispatch, or uncertain
  readback is an ambiguous failure that requires provider reconciliation.

## Network, credentials, and fallback

- Network reach is the minimum required by the provider transport and admitted
  operation. Loopback narrows reach but does not replace authentication or
  authorization.
- Credentials remain behind provider-owned abstraction. They are never caller
  inputs, tool output, committed configuration, or client-visible raw values.
- Brain and clients must not bypass Workbench with direct n8n, webhook, raw HTTP,
  shell, fixture, or alternate-server fallbacks when Workbench owns the action.
  Provider unavailability is a blocked capability, not permission to improvise.

## Runtime registration and testing

- Runtime registrations are generated per project from the admission registry;
  global installation is exceptional and separately admitted. Registration
  status is not proof of runtime health or mutation readiness.
- Provider tests prove schema enforcement, authentication, authorization,
  confirmation, lease/dispatch/reconciliation, rollback, bounded output, and
  audit behavior. Brain tests prove admission schema, exact scope, source locks,
  digest drift, registration generation, revocation, and client neutrality.
- Negative fixtures must reject unknown tools, nested-operation expansion,
  caller-controlled infrastructure, missing confirmation, replay, ambiguous
  transport, unsafe output, and stale provider artifacts.
- Failures are typed and fail closed. Unsupported, unavailable, unauthorized,
  expired, ambiguous, and partially observed states remain distinct; clients do
  not translate any of them into success or automatic fallback.

## Workbench vertical slice

Workbench remains provider-owned. Brain admits only
`getWorkbenchStatus`, `readWorkbenchContext`, and
`runWorkbenchCommand.n8n_workflow_migration` for B1.0a. File mutation, commit,
push, arbitrary commands, and unrelated Workbench command kinds are not admitted.
The legacy B1.0a-specific server remains as historical source but is disabled as
an active registration after the admitted Workbench provider passes validation.

B1.0a live prepare/execute, fixtures, and rollback remain a separate explicit
operator authorization. Provider admission does not perform or authorize them.
