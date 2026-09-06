# IKHP: Codex Lifecycle Handoff Repair — 2026-09-06

## Summary

Emergency repair of the Codex runtime tooling after multi-account profile
migration interrupted the Codex Desktop session. Root causes: stale
thread-writer locks, dead bridge proxy (`openai_base_url` pointing to stopped
codex-chatgpt-web on port 17841), and interrupted-turn auto-resume loop in the
UI.

## Timeline

- **2026-09-05**: Migration commands ran; Codex Desktop became unreachable
  ("Reconnecting... waiting for network", `code -32600` thread-writer error).
- **2026-09-05**: Session 1 fixed: killed zombie processes, cleared stale locks,
  commented out `openai_base_url`, updated 5 interrupted turns in
  `thread_history_1.sqlite` to `status=completed`.
- **2026-09-06**: `openai_base_url` re-appeared in config.toml (line 21,
  uncommented — likely the desktop app or bridge serializer re-wrote it).
  App-server.log showed continuous "Connection failed" errors from 14:24–17:16,
  then a 426 Upgrade Required at 22:34.
- **2026-09-06**: Full test regression, WebGPT verification, documentation, and
  scoped closeout completed.

## Root cause chain

1. **Stale thread-writer locks** — file-based locks in
   `~/.codex/thread-writer-locks/` are not crash-safe; zombie processes left
   locks that blocked new session writes.
2. **Dead bridge proxy** — `openai_base_url = "http://127.0.0.1:17841/v1"`
   routed all API calls through the codex-chatgpt-web bridge, which was stopped.
3. **Interrupted-turn auto-resume** — UI saw `status=interrupted` on the last
   turn, set `markedStreaming=true`, and endlessly tried to reconnect a dead
   stream.

## Repair verification matrix

| Test suite | Result | Count |
| --- | --- | --- |
| test:codex-managed-root | ALL PASS | full suite |
| codex-identity-lifecycle-handoff.test.mjs | ALL PASS | 4/4 |
| runtime-profile-manager (full matrix) | ALL PASS | 19/19 |
| test:configuration-ownership | ALL PASS | 5/5 |
| test:codex-runtime-architecture | ALL PASS | 31/31 |
| Shell syntax (codex-home-managed-root.sh + test) | CLEAN | 2 files |
| Node syntax (4 repair JS files) | CLEAN | 4 files |
| WebGPT route-status | installed, active | — |
| WebGPT doctor | ok (10/10, 1 expected warning) | — |

## WebGPT status

WebGPT bridge is now healthy. All 10 doctor checks pass. The one warning
("Local checks cannot prove ChatGPT connector is attached to this tunnel") is
expected — it requires manual browser verification at
`https://chatgpt.com/#settings/Plugins`.

The `openai_base_url` in config.toml is active and pointing to the bridge. With
the bridge now healthy, the "Connection failed" errors should resolve on the
next Codex Desktop restart.

## Files changed

- `tools/codex-toml-ownership-helper.mjs` — Node TOML helper (replaces Python 3.11 tomllib)
- `tools/codex-identity-lifecycle-handoff.mjs` + `.test.mjs` — Lifecycle handoff
- `tools/codex-webgpt-owner-cli.mjs` — WebGPT owner CLI
- `tools/inspect-codex-webgpt-cli.mjs` — WebGPT inspection
- `operations/scripts/codex-home-managed-root.sh` + test — Managed root script
- `operations/runbooks/codex-account-profile-enrollment.md` — Documentation

## Scope confirmation

No out-of-scope work performed:
- No live account onboarding, OAuth login, or Keychain enrollment
- No manual config.toml rewrite for WebGPT
- No browser auth/session state mutation
- No broad repository refactoring
- No MCP OAuth repair or hooks cleanup
- No Python or npm dependency installation

## Gate

**READY_TO_REOPEN_CODEX** — all tests pass, WebGPT healthy, documentation
updated. Restart Codex Desktop to clear the cached app-server error state.
