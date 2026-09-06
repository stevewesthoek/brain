# IKHP Codex account/profile capability report — 2026-09-05

## Result

`CODEX_AUTH_PROFILE_ISOLATION=NOT_OK` for the requested multi-account
guarantee. The mechanical disposable storage/profile probe passed, but the
live configured storage mode is unspecified, active account attribution is not
available from the supported CLI status surface, and authenticated-profile
concurrency is not proven.

This is a capability boundary, not a claim that the current authenticated
native session is unhealthy.

## Read-only evidence

The refreshed observer ran at `2026-09-05T12:32:53.503Z` and reported:

- CLI `codex-cli 0.153.2`;
- native Codex/ChatGPT app `26.901.31953`;
- `codex login status` classified the current native session as
  `authenticated`;
- account identity was intentionally not returned and remains unknown;
- `cli_auth_credentials_store` was not found in the allowlisted canonical or
  live config metadata, so the effective backend is unknown;
- `~/.codex/auth.json` was observed only as metadata: present, mode `600`;
- `CODEX_HOME` was not set in the probe environment, so the documented default
  `~/.codex` applies to that CLI process;
- Web GPT production was locally healthy for doctor/bridge/proxy/tunnel but
  degraded on unknown connector attachment;
- Web GPT DEV was configured but not running and its required MCP runtime was
  not ready;
- no route, connector, application, authentication, or Keychain state was
  changed.

The auth/profile check then created disposable roots outside live profiles,
ran only `codex login status` with no credentials for `file`, `keyring`, and
`auto`, and removed the roots. Each mode stayed unauthenticated, created no
`auth.json`, honored two non-secret named configuration layers, and left the
live config metadata unchanged:

```text
PROFILE_LAYERS_HONORED=true
LIVE_CONFIG_UNTOUCHED=true
RAW_SECRETS=none
```

The experiment proves CLI state-root behavior. It does not prove two real
authenticated accounts in an OS keyring, does not test login/logout, and does
not prove Desktop isolation.

## Reused/evolved contracts

- `operations/specs/infrastructure-identity-access-v1.schema.json` remains the
  only Identity & Access catalog. It now expresses binding state,
  authentication-storage ownership/isolation metadata, and profile
  concurrency/lifecycle fields.
- `operations/specs/infrastructure-candidate-v1.schema.json` now allows a
  non-secret binding relationship on an ordinary candidate.
- `tools/infrastructure-catalog/observation-core.mjs` validates and plans
  account/profile bindings through the existing pure admission path.
- `tools/infrastructure-catalog/codex-runtime-adapter.mjs` reports only safe
  storage-key metadata and keeps native account identity unresolved.
- `tools/check-codex-auth-profile-isolation.mjs` is a deterministic
  `OK`/`NOT_OK` read-only proof script with disposable-root cleanup.
- `tools/runtime-profile-manager.mjs` now provides the repository-only,
  CLI-only list/create/doctor/login-handoff/launch surface. Its provider-neutral
  policy core consumes the same catalog, while the Codex adapter owns root,
  status, child-process, and profile-lease mechanics.

No OAuth registry, token store, cookie store, auth-file copy, or second
Identity & Access catalog was added.

## Pilot preparation state

The operator-assisted pilot infrastructure is now prepared but is not yet
accepted. The temporary candidate input contains the two opaque records
`account:openai.personal.01` / `runtime_profile:openai.personal.01.cli` and
`account:openai.personal.02` / `runtime_profile:openai.personal.02.cli`.
Their roles are fixed independently of active session state: Account A
(`account:openai.personal.01`) is the default/primary preferred account and
Profile A is its intended profile; Account B
(`account:openai.personal.02`) is the backup/secondary account and Profile B
is its intended profile. The existing/default Codex session is separately
recorded as `session:openai.codex.default.legacy`, user-attested as Account B;
it is not Profile B and is not used as Profile B's authentication proof.
Two owner-only empty roots were created at:

```text
/Users/Office/.brain/codex-runtime-profiles/openai.personal.01.cli
/Users/Office/.brain/codex-runtime-profiles/openai.personal.02.cli
```

Both passed the pre-login security gate: owner-only mode, no Git ancestor,
known cloud-sync exposure not observed, distinct roots, and no `auth.json`.
The default `/Users/Office/.codex` root was not changed. No OAuth login was
executed by Brain and no account identity has been inferred. The pilot state
is `in progress / waiting for local process quiescence before baseline`.

The machine-checkable staged runner is `tools/codex-cli-pilot.mjs`. It records
only redacted status/metadata, requires a saved pre-login baseline and both
operator attestations, checks A→B→A→B persistence, and gates sequential
launches through in-memory pilot evidence. Its reports preserve the separate
preferred-account and current-observed-session dimensions. The canonical
catalog remains unchanged. A live pre-login plan was rechecked on
2026-09-05 and returned `NOT_OK` solely for
`protected_processes_running` (`chatgpt_app`, `codex`, and `computer_use`).
The runner deliberately did not write a baseline for that failed plan. Current
state is `in progress / waiting for local process quiescence before baseline`;
it must not advance to Account A login until a fresh plan returns `OK`.

## Capability conclusion

| Question | Evidence-backed answer |
| --- | --- |
| File mode | CLI credentials are documented under `CODEX_HOME/auth.json`; distinct roots are the currently provable CLI account-cache boundary, with plaintext-token risk. |
| Keyring mode | OS credential storage is supported; per-root/profile namespacing is unknown and was not inspected. |
| Auto mode | OS store is preferred when available and file fallback exists; the selected backend is unknown without credential-store evidence. |
| `--profile` | Supported named configuration layer; not an authentication boundary by itself. |
| CLI/IDE | They share cached login details; separate runtime roots may be an adapter strategy, but multiple authenticated/concurrent accounts remain unproven. |
| Desktop | Sign-in is supported, but CLI profile/CODEX_HOME control over Desktop application/browser state is not proven. |
| Web GPT | Production and DEV are separate application-owned browser/session profiles; identity is unresolved; connector attachment uncertainty is relationship evidence. |
| Vault | macOS Keychain remains the current/reference Brain-managed secret adapter. OnePassword is future/replaceable, not active Codex auth custody. |

## Safety and next gate

Brain may keep opaque account IDs, expected principals, session/profile
references, lifecycle/recovery policies, health evidence, and expiring human
attestations. It must never receive OAuth values, `auth.json` contents,
cookies, browser storage, raw Keychain data, or authorization headers.

The manager selects an opaque profile, derives a dedicated file-mode
`CODEX_HOME`, verifies root/auth-file metadata without reading contents, scopes
process ownership with a profile lease, and fails closed on unsafe state. Its
login operation is always a human handoff; launch is child-scoped and
bootstrap-only until expected-principal and isolation evidence are accepted.
It never copies OAuth state, calls logout, mutates the parent environment, or
globally kills unrelated runtimes.

The current operator-assisted gate is the two-account CLI pilot using one
dedicated `CODEX_HOME` per opaque account, user-led login and account
confirmation, process ownership evidence, permission/recovery checks, and no
account switching during enrollment. Keyring, Desktop, and concurrent
authenticated profiles remain separate research gates. The broader vault
design is documented in
`operations/specs/infinite-brain-credential-vault-strategy.md`.

See the full contract and 16-question Definition of Done in
`operations/specs/infrastructure-codex-account-profile-capability.md`.
