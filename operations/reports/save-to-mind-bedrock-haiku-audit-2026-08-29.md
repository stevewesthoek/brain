# Save-to-Mind Bedrock Haiku Audit — 2026-08-29

## Result

The live workflow was exported through Brain's documented n8n Public API
wrapper before mutation and preserved byte-for-byte as the rollback artifact:

```text
operations/reports/artifacts/save-to-mind-live-pre-bedrock-deploy-2026-08-29.json
```

SHA-256: `301fc583e33a174581eb1ba98bfd2bf235d4158cd0161e43e3fa2bfe257eb77f`

The Bedrock candidate was deployed once, read back active with the protected
graph and webhook intact, then rolled back after live validation failed. The
current live workflow is active on the pre-Bedrock graph, with readback version
`3398e289-19ba-4684-978f-fd2bd3cb4474`, updated at
`2026-08-29T10:18:34.325Z`. Webhook ID remains
`e26dfdb3-670d-4ea1-973b-694ec97347eb`; path remains `mind-inbox`.

## Candidate

The paused candidate is:

```text
operations/automations/n8n/workflows/save-to-mind-bedrock-haiku-candidate-2026-08-29.json
```

SHA-256: `61356604403855fe01b268aa2c300648ce03af467100e0126d64dd56f77799f6`

It preserves the workflow identity, webhook, graph, settings, sharing, GitHub
create/update logic, response, and `inbox/new` / `inbox/failed` routing. The
candidate resolves the existing non-secret n8n credential display name
`AWS Bedrock - Brain` for the AWS credential type. The provider target is
Claude Haiku 4.5 through Amazon Bedrock InvokeModel at the
`bedrock-runtime` endpoint, with the required SigV4 signing name `bedrock`.
The parser accepts only the expected strict JSON shape and routes provider or
parse failures to `inbox/failed` without copying raw provider errors or model
output into the failure summary.

## Validation and live state

Offline checks passed:

```text
node --test tools/n8n-save-to-mind-bedrock-candidate.test.mjs tools/n8n-save-to-mind-route-proof.test.mjs
node tools/validate-save-to-mind-bedrock-candidate.mjs
```

Result: 14/14 tests passed; route proof passed; candidate structural validation
passed with `deploymentReady: true`.

The documented Workbench prepare/execute path was unavailable because no active
Workbench session could be established. The bounded n8n Public API wrapper
fallback performed the update and subsequent rollback; both requests returned
HTTP 200 and were read back without protected drift.

The first live smoke execution was `1030`. The native n8n HTTP Request signer
returned `Forbidden` because the request signature used the endpoint-derived
service `bedrock-runtime`, while AWS required signing name `bedrock`. The one
bounded repair changed the classifier to n8n's authenticated helper with an
explicit signing service, but execution `1031` failed before the request because
n8n 2.4.7 rejects `helpers.httpRequestWithAuthentication` in the Code Node as
unsupported. Both executions fail-closed into `inbox/failed`; no successful
Bedrock classification was established. The two failure artifacts remain in
Mind as evidence, and the live workflow was rolled back.

The migration remains blocked until a supported native/custom n8n signing
override or compatible n8n runtime mechanism is available. No further repair
was guessed or attempted.

## claude-watch vendor audit

The inspected upstream version is `0.2.0` at commit
`7711231e4c47e5d4e06bcf5326c4abf5b70ab4a9`, licensed under MIT. The vendor
snapshot is under:

```text
ai/skills/vendors/taoufik123-collab/claude-watch/
```

It preserves the Python acquisition, caption/VTT parsing, Groq/OpenAI Whisper
fallback, ffmpeg frame extraction, scene-change detection, pacing, hook
microscope, report generation, tests, upstream README/SKILL, authorship, and
license. The Brain delta is intentionally narrow: a provider-neutral adapter
requires preflight-only dependencies, captions by default, explicit consent
for external transcription, bounded local output, and no Mind/Obsidian writes.
The upstream plugin manifests, hooks, commands, and install path are not
activated or copied into the Brain skill surface; the upstream installer is
provenance-only and never invoked.

## Video-to-Mind boundary

The existing Brain ingestion envelope is explicitly bounded to Markdown, text,
and limited local PDF extraction. A validated video queue/dispatcher at the
requested source-type boundary was not found. Video analysis is therefore
prepared as a local report capability but is not wired into Save-to-Mind and no
second ingestion framework was introduced.

## Related migration manifest

`operations/automations/n8n/save-to-mind-bedrock-haiku-migration-2026-08-29.json`
records the old/new provider, hashes, preserved boundaries, and blockers.
