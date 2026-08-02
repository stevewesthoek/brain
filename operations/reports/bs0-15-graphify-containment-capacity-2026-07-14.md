# BS0.15 Graphify Containment and Capacity — 2026-07-14

**Status:** complete — contained, disabled, and truthful pending a future
explicit contained runner. No Graphify run occurred.

## Authoritative operational truth

| Item | Decision |
|---|---|
| Canonical operational output root | `runtime/local/graphify` |
| Compatibility roots | `graphify-out`, `.graphify-out` |
| Authority | generated output is non-authoritative |
| Publication | staged atomic rename; partial failures require a receipt |
| Retention | 7 runs, 14 days; failure receipts retained 14 days |
| Corpus | explicit `brain`/`mind` allowlist with generated, vendor, runtime, backup, credential, secret, and `.env` exclusions |
| Capacity | 5,000 files; 50 MiB input; 10,000 nodes; 50,000 edges; 900 seconds; 25 MiB output |
| Full scans | disabled; no automatic full scan merely because a repository exists |
| Incremental scans | deferred, not claimed implemented |

The legacy `graphify-nightly.sh` formerly discovered repositories broadly and
wrote each repository’s `.graphifyignore`. It now exits by default before
discovery with this receipt:

```json
{"status":"blocked","reason":"bs0-15-contained-runner-required","writesPerformed":false}
```

This proves read-only analysis cannot mutate an inspected repository. Any
future runner must explicitly implement the profile; it cannot become active
through the legacy entrypoint or scheduler. The Office Scheduler already skips
Graphify pending BS0.15 containment, and the typed manifest retains it disabled.

## Mind MS0.4 handoff truth

Mind may use exactly the profile’s canonical output path, compatibility paths,
profile name (`graphify-contained-read-only`), generated/non-authoritative
classification, retention, receipt-and-source-hash freshness meaning, and
human-facing navigation-only role. Mind must not claim a graph is current when
the receipt is absent.

## Validation

```text
node tools/validate-graphify-operational-profile.mjs -> pass
node --test tools/validate-graphify-operational-profile.test.mjs \
  tools/generate-capability-manifest.test.mjs -> 5 passed
bash tools/scripts/graphify-nightly.sh -> blocked no-write receipt
bash -n tools/scripts/graphify-nightly.sh -> pass
git diff --check -> pass
```

Mind remained unchanged (status hash:
`4a865c3c81a14ca9319df2d67a10aa98edcc245baf41bb32a4941e1aaaf1f0dc`).
No deployment, live query, credential access, external write, or generated
runtime artifact occurred.

## Risks and debt

The retained legacy runner remains historical code and a future contained
runner must implement actual staged publication, cap accounting, and retention
cleanup before Graphify may be re-enabled. This is deferred implementation
debt, not an active Critical/High risk because the default entrypoint and
scheduler are fail-closed.
