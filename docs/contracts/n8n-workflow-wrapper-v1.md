# n8n Workflow Wrapper Contract v1

Status: authoritative external adapter contract
Contract version: 1
Compatibility verdict: `product_agnostic_with_installation_adapter`
Native compatibility verdict: `native_ready_with_adapter_replacement`

## Scope and ownership

This document defines a generic process contract for one n8n workflow adapter.
It is not a product identity, capability grant, credential store, deployment
topology, or universal dependency. A product host binds a concrete wrapper path
and digest through its own versioned grant. Installation configuration supplies
the API base URL and credential at runtime.

The contract has two operations:

```text
get-workflow <workflowId>
update-workflow <workflowId> -
```

No source identity, real workflow ID, API origin, repository path, customer name,
credential location, or deployment topology is part of the operation contract.
Pre-existing manual compatibility commands are outside this contract and must
not be exposed by Workbench.

## 1. Read operation

`get-workflow <workflowId>` performs one fixed `GET` against
`/workflows/{workflowId}`. It accepts no payload or extra argument and retains
the legacy raw workflow JSON response needed by the existing read adapter.

The workflow ID is a separate positional argument. It must be 1–128 characters,
begin with an ASCII letter or digit, and contain only ASCII letters, digits,
`.`, `_`, `~`, or `-`. This prevents path, query, fragment, and argument
injection.

## 2. Mutation operation and transport

The normative mutation invocation is:

```text
update-workflow <workflowId> -
```

The wrapper reads the payload from stdin, snapshots it into private temporary
storage, validates that snapshot, and sends exactly those bytes once with a fixed
`PUT /workflows/{workflowId}` request. The caller cannot select the method,
path, URL, headers, or transport.

`update-workflow <workflowId> <json_file>` remains available only for manual
compatibility. It applies the same byte limit, validation, single-request, and
result rules, but it is not an approved Workbench argv form.

## 3. Bounded input contract

The maximum payload size is exactly 500,000 bytes. The wrapper reads at most
500,001 bytes and rejects an oversized payload before starting the HTTP client.

The payload must:

- be valid JSON;
- be a JSON object, not an array, scalar, or null;
- contain an `id` string exactly equal to the separate `workflowId` argument;
- contain `nodes` as an array, `connections` as an object, and `active` as
  a boolean;
- contain no top-level transport envelope such as `body`, `payload`,
  `workflow`, `request`, `transport`, `method`, `url`, `path`, or
  `headers`;
- contain no authorization header object, Bearer/Basic authorization string, or
  raw credential-like key such as API key, token, password, client secret,
  private key, or raw credential data;
- represent any node `credentials` value only as a reference map whose entries
  contain a bounded synthetic-safe `id` and optional bounded `name`.

These are wrapper transport and safety rules, not a claim to reproduce n8n's
complete server-side workflow schema. Workbench remains responsible for its
stricter artifact, topology, canonicalization, and configured-credential checks.

## 4. Runtime configuration

The implementation receives the API base URL and API key from validated
installation-local process configuration. It does not load or assume a
credential file. The base URL must use HTTPS and must not contain user info,
whitespace, a query, or a fragment. Credentials must come from installation-local
secret storage and must never be committed.

Configuration is not caller-controlled operation data. Workbench must not place
the API origin, credential, credential location, or arbitrary environment fields
in repository artifacts or operation argv.

## 5. Timeout and HTTP-client contract

| Limit | Default | Maximum |
|---|---:|---:|
| Connection timeout | 5 seconds | 30 seconds |
| Total request timeout | 60 seconds | 300 seconds |
| Captured response body | 500,000 bytes | 500,000 bytes |

The total timeout must be greater than or equal to the connection timeout.
Invalid configuration fails before transmission.

The HTTP client is invoked with ambient configuration disabled, HTTP/1.1,
redirect following disabled, proxy use disabled, an explicit retry count of
zero, an empty `Expect` header, fixed headers, and fixed method/path
construction. The credential header is supplied through private temporary
storage rather than command-line text and is removed from the child environment.

```text
automaticRetries: 0
maximumRemoteMutationRequestsPerInvocation: 1
```

One wrapper invocation contains exactly one mutation-client execution path and
no retry loop. Redirects and authentication negotiation cannot issue a second
mutation request.

## 6. Structured mutation result

Every mutation that reaches contract handling emits one bounded JSON object to
stdout. It never emits the server body, authorization headers, credentials,
environment values, or unrestricted client errors.

```json
{
  "contractVersion": 1,
  "operation": "update-workflow",
  "classification": "succeeded",
  "workflowId": "workflow-example-001",
  "requestSent": true,
  "responseReceived": true,
  "httpStatus": 200,
  "responseWorkflowId": "workflow-example-001",
  "failurePhase": "none",
  "errorCode": "NONE"
}
```

Allowed classifications and process exits are:

| Classification | Exit | Meaning |
|---|---:|---|
| `succeeded` | 0 | A bounded 2xx JSON object was received with the exact workflow ID. |
| `definitively_failed` | 10 | Validation/configuration failed before transmission, connection was never established, or a completed 4xx rejection was received. |
| `ambiguous` | 20 | Transmission may have begun and application cannot be disproved. |
| `timed_out` | 21 | The client timed out; mutation application is unknown. |

Argument-shape errors that cannot identify a valid mutation invocation use exit
64 and do not start the HTTP client.

## 7. Ambiguity rules

The wrapper distinguishes:

- validation or configuration failure before client execution:
  `definitively_failed`, `requestSent: false`;
- DNS/proxy resolution or connection failure proven by client exits 5, 6, or 7
  before any response: `definitively_failed`, `requestSent: false`;
- completed 4xx response: `definitively_failed`, with the status recorded;
- timeout after client execution starts: `timed_out`;
- other transport failure after client execution starts: `ambiguous`;
- redirect or 5xx response: `ambiguous`;
- oversized, malformed, missing-ID, or wrong-ID 2xx response:
  `ambiguous`.

If the wrapper process is terminated or no valid envelope is available after
dispatch begins, the caller must classify the result as ambiguous or timed out.
It must never infer definitive failure from a missing or malformed result.

## 8. Protected-field policy

The wrapper forwards the validated complete payload snapshot byte-for-byte. It
does not independently alter, omit, merge, restore, or infer:

- activation;
- settings;
- tags;
- sharing;
- credential references;
- webhooks;
- schedules.

The wrapper does not read hidden server state and makes no claim that the server
preserves omitted fields. A successful mutation is not a completed migration.
Workbench must always perform readback, canonical comparison, workflow-identity
verification, and protected-state comparison before declaring completion.

## 9. Duplicate and replay behavior

The wrapper provides no idempotency key or duplicate detector. A second wrapper
invocation is a second mutation request and is not intrinsically safe.

Callers must use a durable replay-safe dispatch reservation bound to the
operation, workflow identity, mutation kind, artifact digest, wrapper digest,
and opaque authorization digest. Ambiguous and timed-out results require
readback reconciliation, never blind retry.

## 10. Twelve contract facts and conformance evidence

| # | Contract fact | Version 1 value | Offline proof |
|---:|---|---|---|
| 1 | Exact mutation subcommand | `update-workflow`; fixed `PUT /workflows/{workflowId}` | argv/method/path tests |
| 2 | Exact argv ordering | `update-workflow <workflowId> -` | accepted/rejected argv tests |
| 3 | Workflow-ID delivery | second positional argument and fixed path segment | exact synthetic URL test |
| 4 | Workflow-JSON delivery | stdin snapshot; legacy path only outside Workbench | byte-for-byte capture tests |
| 5 | Accepted input schema | bounded object, exact ID, minimal workflow shape, no envelope/auth/raw credentials | negative validation tests |
| 6 | Expected success response | bounded 2xx object with matching ID and structured envelope | success-envelope test |
| 7 | Definitive failure response | structured pre-send/connection/4xx failure | definitive-failure tests |
| 8 | Ambiguous cases | transport uncertainty, redirect/5xx, malformed/oversized/wrong-ID response | ambiguity tests |
| 9 | Timeout behavior | explicit 5/60 defaults, 30/300 maxima, `timed_out` | argv and timeout tests |
| 10 | Retry/request count | zero retries; at most one remote mutation request per invocation | fake-client counts and option tests |
| 11 | Protected-field preservation | byte-for-byte forwarding; mandatory Workbench readback comparison | protected-payload capture tests |
| 12 | Duplicate behavior | no intrinsic replay safety; separate invocations are separate mutations | duplicate invocation and documentation tests |

Run the committed offline conformance suite with:

```bash
bash tests/n8n-api-contract.sh
```

The suite places a fake HTTP client first on `PATH`; it does not contact n8n or
any network service.

## 11. Host and native migration boundary

The reusable core is this versioned request/result metadata and its conformance
behavior. The shell implementation, local process runner, temporary-file
mechanism, environment reader, and HTTP client are replaceable host adapters.
A future native host can implement the same contract and pass the same
conformance cases without reproducing repository- or installation-specific
policy.

Any incompatible change requires a new contract version and new committed
conformance evidence.
