# Identity & Access Production Closeout — 2026-09-06

**Status:** NOT_COMPLETE — repository foundation verified; live account/profile
admission, canonical runtime placement, and final application acceptance remain
open gates.

**Canonical comparison:** `main` at
`f5c0cb4fbc47a4fe446ef07d38a7f862eff46915`, equal to `origin/main` at the
time of this report.

**Safety:** no OAuth value, authentication-file content, cookie, browser
storage, Keychain value, API key, authorization header, WebGPT source, MCP
state, hook trust state, or live configuration was read, copied, printed, or
changed by this closeout pass.

## Executive result

The repository architecture and deterministic safety boundaries are healthy.
The requested guarantee that multiple OpenAI accounts remain independently
saved and usable is not yet proven and must not be claimed. The canonical
Identity & Access catalog remains intentionally empty:

| Canonical collection | Records |
| --- | ---: |
| Accounts | 0 |
| Credentials | 0 |
| Sessions | 0 |
| Surface bindings | 0 |
| Runtime profiles | 0 |
| Secret-store adapters | 0 |
| Lifecycle policies | 0 |
| Verification policies | 0 |

This is a safe fail-closed state, not a completed enrollment.

## Live evidence

### Native Codex

- The official App Server observer read `account/read` with
  `refreshToken: false` against the shared native root.
- The session was authenticated with `chatgpt` mode and `plus` plan metadata.
- Private matching did not resolve the provider identity to the known preferred
  account, so the result remained `identityMatch=unknown`.
- No email or provider identity value was persisted or emitted.
- The shared `/Users/Office/.codex` root remained observe-only.

### Dedicated CLI profile roots

The two pre-created owner-only roots are distinct and outside Git:

```text
/Users/Office/.brain/codex-runtime-profiles/openai.personal.01.cli
/Users/Office/.brain/codex-runtime-profiles/openai.personal.02.cli
```

The App Server observer returned `not_authenticated` for both. The CLI pilot
plan returned `CODEX_CLI_PILOT=OK` for the two-profile collection, proving the
metadata and isolation plan. The bounded profile check correctly returned
`NOT_OK` because authentication and profile-local configuration have not yet
been established. No `auth.json` exists in either dedicated root.

### Observer residue correction

The first observer implementation started Codex directly in the target roots
and created application SQLite/WAL/SHM runtime files despite not creating auth
or config files. This was a real non-secret mutation-contract defect, not a
credential exposure. All handles were confirmed closed and the exact residue
was moved recoverably to
`/Users/Office/.brain/observer-quarantine/codex-app-server-20260906/`.
Observer version 1.1.0 now uses an ephemeral shadow root and, on macOS, a
write-denying sandbox for the target root; real disposable subprocess probes
confirmed both the target directory and auth bytes remained unchanged.

The next step is a human-operated official login, one account at a time,
followed by private identity confirmation, profile-specific checks, complete
attestation, and an A→B→A persistence/recheck sequence. Brain must not perform
login, logout, OAuth copying, or account switching.

### WebGPT and MCP separation

The WebGPT production application and DEV harness remain separate application
surfaces. The native profile manager does not target the WebGPT repository or
application home. MCP authorization remains owned by the MCP/application
surface; the `codex_apps` 401 and Stitch timeout are not repaired by native
profile enrollment. No MCP state was changed in this pass.

## Deterministic verification

All selected gates passed on clean `main`:

- infrastructure catalog, governance, observation/admission, identity/access,
  credential-health, health, incident, action, action-receipt, and contract
  validators;
- catalog, governance, observation, identity/access, Keychain adapter and
  enrollment, verification boundary, GitHub verifier, runtime architecture,
  runtime profile, CLI pilot, managed-root, infrastructure health, incident,
  and action tests;
- Infinite Brain contract registry, contract layers, and cross-repo contract.

The validator outputs consistently reported no raw secrets and no execution or
mutation. The catalog still reports stale-provenance warnings for older
infrastructure evidence; these are visible warnings and do not become healthy
by assumption.

## Repository and worktree disposition

The clean integration checkout is the current safe `main` base:

```text
/Users/Office/Repos/stevewesthoek/brain-main-integration-2026-09-01
```

The path `/Users/Office/Repos/stevewesthoek/brain` is still the active dirty
Codex worktree on `codex/cloudflare-tooling-normalization` and currently has
live Codex/ChatGPT/Computer Use/SSH-related processes associated with the
session. It was not reset, switched, cleaned, or moved. The Video, launcher,
Supabase, detached `.codex`, and detached `brain-runtime` worktrees remain
protected because they contain dirty, unique, detached, or runtime-coupled
state. No unexplained worktree was silently deleted.

Running the managed-root checker from the integration path reports symlink
target differences because the live links intentionally point at the active
`/Users/Office/Repos/stevewesthoek/brain` path. That is a path-placement issue,
not permission to rewrite the shared root. The final canonical placement must
be performed only after the active task and related processes are quiescent,
with a reversible worktree/linker operation and a fresh check from the final
`/Users/Office/Repos/stevewesthoek/brain` `main` checkout.

## Remaining production gates

1. Admit two real OpenAI account records using opaque IDs and private matching;
   do not place email addresses or OAuth material in Git.
2. Materialize only the two dedicated, owner-only profile configurations.
3. Perform human official login for each profile separately and record only
   redacted identity/health evidence.
4. Prove profile isolation, restart persistence, correct account attribution,
   and sequential A→B→A behavior. Do not infer concurrency from the schema.
5. Keep native Codex, WebGPT production/DEV, and MCP authorization as separate
   application-owned surfaces and re-run their independent acceptance checks
   from an idle state.
6. Enroll only clearly Brain-owned reusable credentials through the bounded
   Keychain boundary. Do not migrate Codex, WebGPT, MCP, browser, or provider-
   managed OAuth/session state into a universal vault.
7. Move the validated `main` worktree into the canonical path only when the
   active task is stopped and no protected worktree ownership is ambiguous;
   then re-run the final audit, commit, push, and retire only proven refs.

Until these gates pass, the correct status is `NOT_COMPLETE`, with health
notifications limited to evidence-backed observations and no generic token
refresh or keepalive behavior.
