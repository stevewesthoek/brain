# IKHP Identity & Access — macOS Keychain adapter

**Status:** production adapter for Brain-owned secrets, activated 2026-09-07;
no real production credential is currently eligible for enrollment

This runbook defines Brain's local `SecretStoreAdapter` for macOS. It is
deliberately narrower than a credential manager: Brain owns
account identity, provider verification, lifecycle state, freshness, incidents,
and recovery guidance; Keychain owns protected item storage and access control.
Brain uses a dedicated logical namespace inside the macOS login Keychain by
default. A separate physical Brain keychain is optional, not the default
security boundary.

## Admitted scope

The adapter:

- runs only on macOS;
- uses native Security.framework APIs for generic-password metadata and
  mutation;
- uses the user's macOS login Keychain (`physicalStore=login`);
- accepts only `keychain-ref://<service>/<account>` references in the
  `tools.prochat.brain` namespace;
- reports native availability and reference existence as redacted metadata;
- provides metadata-only namespace inventory;
- supports approval-gated create/update/delete with secret input only through
  the native helper's stdin;
- supports authorized read only as bounded native-to-verifier stdin delivery;
- distinguishes present, missing, permission-denied/locked, unavailable, and
  unknown states;
- its metadata/existence probe never requests `kSecReturnData`;
- never uses Apple's `security` CLI or `-w <secret>`;
- prevents iCloud synchronization with `kSecAttrSynchronizable=false` and
  uses `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`;
- has no generic raw secret getter, export, or backup method.

The fixed synthetic smoke reference is:

```text
keychain-ref://tools.prochat.brain.synthetic.pilot/brain-synthetic-pilot
```

This reference is a namespace test, not a real account enrollment. No current
Codex, MCP, browser, desktop, or other application authentication state is
read, imported, copied, or changed.

## Ownership and account separation

Two accounts for the same provider remain two Brain account records, each with
its own opaque credential references, sessions, expected principal, and runtime
profile. The Keychain adapter sees only a validated service/account reference;
it does not infer provider identity from an email, item label, or successful
Keychain lookup. A Keychain item being present is not evidence that the
provider accepts the credential or that it belongs to the expected account.

Application-managed OAuth state remains application-owned. In particular,
Codex authentication and MCP authorization are not extracted from their
application stores by this adapter.

The generic observation/admission layer consumes only the metadata boundary:
opaque account/session/profile references, custody class, freshness, supported
health result, and recovery guidance. It does not turn Keychain presence into
provider validity, infer an account from a label, or import Codex/WebGPT OAuth.
The current/reference local custody adapter is macOS Keychain. OnePassword is
not a current source of truth; it may be evaluated later as a replaceable
adapter under the same namespace, least-privilege, redaction, and
expected-principal rules.

## Bounded verification boundary

`tools/infrastructure-identity-access/credential-verification-boundary.mjs`
is the provider-neutral Brain-side contract. It accepts an opaque credential
reference, expected principal, read-only policy, provider adapter, and
Keychain adapter. The Keychain adapter launches the native
`macos-keychain-verification-boundary.swift` process with only validated
metadata and the registered verifier command.

Inside that native boundary, Keychain Services requests the secret data and
writes it directly to the explicitly registered verifier's stdin pipe. The
Brain parent receives only the boundary's allowlisted JSON result. The
boundary never emits the secret, captures verifier stderr, accepts arbitrary
verifier output, or forwards unknown JSON fields. It rejects verifier output
that contains the exact secret bytes. The provider verifier returns only
normalized principal, scope, expiry, refreshability, rate-limit, and
result-code metadata. The synthetic verifier remains the only end-to-end
fixture in this repository.

The protected secret exists transiently in the native boundary and verifier
processes. Swift/Data and the verifier runtime may retain copies; this is an
explicit limitation, not a claim of perfect memory zeroization. The boundary
has no generic `getSecret` API and no environment, argv, temporary-file, JSON,
MCP, Git, or model-context secret transport.

## GitHub read-only verifier

The first provider adapter is implemented in
`tools/infrastructure-identity-access/github-provider-adapter.mjs` and
`github-provider-verifier.mjs`. Its production request is exactly one
`GET https://api.github.com/user` request. The origin and path are fixed; TLS
is required; proxy environment variables are rejected; redirects are not
followed; the request has bounded request/overall time; the response body is
bounded; and no retry or write request is made. The local test seam uses only
loopback HTTP fixtures and is never available through the production CLI.

For a successful response, the numeric GitHub `id` is the expected principal.
`login` is retained only as a display label because it can change. OAuth scope
headers are interpreted only for `classic_pat` and `oauth_access_token`.
Fine-grained PAT and GitHub App user-token scope evidence is
`not_observable` in this probe, and required scopes therefore cannot be
declared healthy without a provider-observed scope signal. Expiry remains
`unknown` unless explicit provider or human-declared metadata is added. A
`401` is an authentication rejection, not automatic proof of revocation;
permission-like `403`, rate-limit `403`/`429`, SAML/SSO `403`, network errors,
and timeouts remain distinct normalized outcomes.

The safe user-facing verifier is:

```bash
node tools/infrastructure-identity-access/github-credential-verification-cli.mjs \
  --credential-id credential:github.account.01 \
  --credential-ref keychain-ref://tools.prochat.brain.github/github.account.01 \
  --expected-principal 123456789 \
  --credential-type fine_grained_pat
```

Add `--required-scope <name>` only when the provider can actually expose that
scope for the declared credential type. The command outputs a redacted
observation only. It does not accept a token, login, endpoint, proxy, or
secret-store namespace as input.

## Human-gated GitHub enrollment

Enrollment is deliberately a separate, interactive operation. It stores one
credential in the fixed Brain Keychain service
`tools.prochat.brain.github` under a safe account slot such as
`github.account.01`. It never creates a GitHub credential, migrates Codex or
MCP OAuth, infers the account identity, or renews/rotates anything.

Run it directly in a trusted terminal with Codex and other automation closed:

```bash
/usr/bin/swift tools/infrastructure-identity-access/macos-keychain-enroll-github.swift \
  github.account.01 fine_grained_pat
```

The credential prompt is hidden by the native tool and is accepted only from
a TTY. Do not pipe the credential, place it in shell history, put it in an
environment variable, or wrap the command in a logger/recording tool. If the
slot already exists, the tool requires an explicit `y` confirmation before
updating it; any other answer leaves the existing item unchanged. The result
contains only the opaque reference and redacted metadata.

After enrollment, bind the slot to the expected numeric GitHub user ID from a
reviewed account record. Do not use the mutable login as the identity binding.
Only then run the verifier above. This real-provider step is intentionally
human-gated and has not been performed by this repository change.

## Validation

From the Brain repository:

```bash
npm run test:macos-keychain-adapter
npm run test:macos-keychain-enrollment
npm run test:credential-verification-boundary
npm run test:github-provider-verifier
```

The expected result is twelve passing adapter tests plus two skipped native
tests on a non-macOS host, and fourteen passing adapter tests on macOS, two
passing enrollment tests,
thirteen passing GitHub verifier tests, and six passing verification boundary
tests, including native lifecycle and verification coverage. A result of
`missing` is acceptable and is the expected state when the synthetic item has
never existed. Neither presence nor absence alone proves provider
authentication health.

The adapter test also proves that:

- namespace and shell-dangerous references fail closed;
- diagnostics and simulated child-process output do not escape into results;
- missing and permission-denied/locked states remain distinct;
- the public adapter exposes metadata, bounded verifier invocation, and
  approval-gated lifecycle methods; it has no generic raw secret read.
- lifecycle mutation requires explicit `operatorConfirmed=true` and never
  places the secret in argv, environment, stdout, stderr, logs, or files.
- the enrollment test exercises hidden TTY input, duplicate refusal, explicit
  overwrite, synthetic post-checks, and cleanup of one fixed test item;
- the GitHub verifier test exercises identity, failure, scope, rate-limit,
  timeout, response-size, proxy, content-type, and redirect policies without
  contacting GitHub or using a real credential.

## Scheduled read-only health evaluation

The repository now contains a provider-neutral scheduled evaluator:
`tools/infrastructure-identity-access/credential-health-orchestrator.mjs`. It
keeps one evaluation per `credentialId`, so multiple accounts of the same
provider remain separate. It records only safe identity metadata, evidence
freshness, cadence, missed scheduler intervals, transient retry backoff, and
account-aware recovery state under:

```text
runtime/local/infrastructure/credential-health-state.json
runtime/local/infrastructure/incident-state.json
runtime/local/infrastructure/incident-notification-state.json
```

Run the repository-safe no-op check from Brain with:

```bash
node tools/validate-infrastructure-credential-health.mjs
node tools/infrastructure-identity-access/credential-health-cli.mjs
```

The CLI accepts only `--notify`. The canonical catalog has admitted accounts
and application-owned sessions but intentionally has zero Brain-health
credential records, so this is a successful zero-credential pass until a
reviewed Brain-managed credential is eligible for metadata enrollment. The
typed scheduler job is report-only, credential-sensitive,
and remains behind the explicit `BRAIN_IDENTITY_ACCESS_HEALTH_ENABLED=1`
activation gate. When enabled, a missed macOS schedule is not treated as a
healthy result: the next run marks old evidence stale/overdue, records the
missed interval count, and evaluates due credentials. Provider or vault
unavailability uses bounded exponential backoff; rejected, revoked, wrong-
account, and reauthentication-required results do not cause a retry storm or
artificial keepalive traffic.

The evaluator reuses IKHP3 incident projection and CLR3 attention planning:
critical/high conditions are immediate, medium/low/unknown conditions enter a
digest, repeated transitions are deduplicated, and fresh healthy evidence
recovers the same incident. The safe notification cursor is persisted before
best-effort macOS delivery, which favors at-most-once alerts across restarts;
the incident and health state remain authoritative if delivery fails. No
notification contains a secret reference, token, provider response body, or
session credential.

The production adapter currently wired is GitHub `GET /user` through the
fixed-origin verifier and macOS Keychain boundary. Synthetic lifecycle tests
cover two same-provider accounts, healthy evidence, wrong-account detection,
provider outage/backoff, expiry warning/critical escalation, stale evidence,
dedupe, recovery, restart-safe notification behavior, and secret absence.
They do not contact GitHub or read a real credential.

## Keychain behavior and access control

The default physical store is the logged-in user's macOS `login` Keychain.
Items use the `tools.prochat.brain` service namespace, generic-password
class with the per-item `kSecAttrAccessibleWhenUnlockedThisDeviceOnly`
protection, and
`kSecAttrSynchronizable=false`. Metadata probes request attributes only and
use `kSecUseAuthenticationUIFail`, so a locked or unavailable Keychain fails
closed without an unlock prompt in background operation. Authorized provider
verification is limited to a registered verifier and may require the normal
macOS Keychain access decision for the user/session. No broad ACL weakening is
performed. The native helper's allowlisted verifier boundary remains the
application-level consumer control. The stronger `SecAccessControl` item
attribute is intentionally deferred: unsigned source-distributed Swift
helpers receive `errSecMissingEntitlement` for that insertion path on this
host, so it is not claimed as operational until a signed/entitled helper is
introduced and tested.

The adapter reports `permission_denied` for locked/denied access,
`unavailable` for unavailable storage, and `unknown` for unmapped native
errors. These states are projected as non-healthy credential-health states.
They are not reasons to fall back to plaintext, environment variables, or
application-owned stores.

Keychain Access operators can search the login Keychain for
`tools.prochat.brain` or `Brain`. Brain items are generic-password entries;
they do not belong in System Roots or certificate views.

For a metadata-only inventory from Brain:

```bash
npm run keychain:inventory
```

The command reports the selected physical store, namespace, host scope,
synchronization policy, count, and safe item metadata only. It accepts no
arguments and never prints secret data.

## Optional dedicated physical Keychain

A separate physical Brain keychain is an optional future deployment mode for
a distinct operator trust domain, unlock policy, or headless/service
identity. It is not created by this Goal. Enabling it requires explicit
design for creation, unlock custody, search-list behavior, backup, recovery,
rotation, and headless operation. Logical namespace separation in the login
Keychain is the production default.

## Recovery and portability assurance

Current Brain evidence does not explicitly cover restoration of the user's
login Keychain, item access controls, or application entitlements. The
assurance state is therefore **unknown**. Repository backup success and cloud
infrastructure recovery must not be treated as proof that local Keychain
contents or application authorization will recover on another Mac.

Before any real credential migration or automated refresh is considered, a
separate recovery-evidence task must, using only a namespaced synthetic item:

1. create the item through an approved native test harness;
2. verify metadata-only discovery from the intended Brain runtime;
3. verify behavior while the keychain is locked and after unlock;
4. verify the intended application identity/entitlements can access it;
5. restore or recreate the test on a replacement profile/Mac;
6. remove the synthetic item deterministically; and
7. record which real provider credentials require human reauthentication or
   provider-side reissue instead of assuming portability.

The production adapter's native lifecycle test temporarily creates, verifies,
updates, and removes only the fixed synthetic fixture above on macOS. A
replacement-machine restoration exercise remains separate and has not been
claimed as complete.

## Threat-model findings

- **argv:** only validated non-secret service/account metadata and verifier
  configuration cross argv; mutation secrets are never arguments.
- **environment:** the native boundary uses a minimal inherited environment;
  no secret is placed in it.
- **stdout/stderr:** mutation secrets travel only on the native helper stdin;
  verification secrets travel only on the verifier stdin pipe; stderr is
  discarded and all parent-facing output is allowlisted.
- **exceptions/crashes:** parent-facing errors are fixed codes; the native
  boundary can still retain transient in-memory data during a crash.
- **child inheritance/cancellation:** the verifier is a short-lived registered
  child; the Node adapter launches the native boundary in its own process group
  and kills that group on timeout. A hard kill still cannot guarantee
  zeroization or prove that every operating-system crash artifact is absent.
- **temporary files/shell expansion:** no temporary files or shell are used.
- **verifier compromise:** output is schema/allowlist filtered and compared
  against the secret before release; the verifier remains a trusted, scoped
  execution component and must stay locally registered.
- **Keychain prompts/permissions:** locked or denied access becomes a
  non-healthy `secret_store_locked` result; unavailable storage becomes
  `secret_store_unavailable`; no unlock or retry mutation occurs.
- **concurrency:** same-reference mutation is approval-gated; callers must
  serialize lifecycle operations and version replacements before cutover.
- **memory lifetime:** the native boundary makes best-effort `Data` cleanup;
  Swift and Node runtimes do not provide a perfect zeroization guarantee.
- **LLM visibility:** no raw secret is returned in observations, logs, CLI
  output, MCP/tool responses, fixtures, snapshots, or repository files.

## Future admission gates

The next gates are separate and require explicit approval:

- enrollment of reviewed account/credential records;
- provider-specific read-only verification with expected-principal matching;
- human-gated enrollment of a reviewed provider credential into the fixed
  Brain Keychain namespace;
- provider-neutral scheduled freshness, incident, notification, and backoff integration is now synthetic-tested in `credential-health-orchestrator.mjs`; live activation still requires reviewed enrollment and separate runtime evidence;
- a real-provider verifier only after the synthetic boundary remains clean
  under review and its provider-specific failure semantics are admitted;
- provider-authorized refresh/rotation with policy, rollback, post-check, and
  audit receipt.

No generic key-keepalive traffic, browser automation, vault export, or
credential janitor is permitted.

## Authority references

- [Apple: Keychain Services](https://developer.apple.com/documentation/security/keychain-services)
- [Apple: Using the keychain to manage user secrets](https://developer.apple.com/documentation/security/using-the-keychain-to-manage-user-secrets)
- [Apple: `kSecClassGenericPassword`](https://developer.apple.com/documentation/security/ksecclassgenericpassword)
- [Apple: Restricting keychain item accessibility](https://developer.apple.com/documentation/security/restricting-keychain-item-accessibility)
- [GitHub: Users REST API (`GET /user`)](https://docs.github.com/en/rest/users/users?apiVersion=2022-11-28)
- [GitHub: OAuth scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- [GitHub: REST API rate limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GitHub: REST API authentication](https://docs.github.com/en/rest/authentication/authenticating-to-the-rest-api)
