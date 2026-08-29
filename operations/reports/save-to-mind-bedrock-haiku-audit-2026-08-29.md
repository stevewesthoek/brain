# Save-to-Mind Bedrock Haiku Audit — 2026-08-29

## Result

The live workflow was exported through Brain's documented n8n Public API
wrapper before any mutation. The export is preserved as the new rollback
artifact at:

```text
operations/reports/artifacts/save-to-mind-live-rollback-2026-08-29.json
```

SHA-256: `301fc583e33a174581eb1ba98bfd2bf235d4158cd0161e43e3fa2bfe257eb77f`

The live workflow is active, has 10 nodes, keeps webhook ID
`e26dfdb3-670d-4ea1-973b-694ec97347eb`, and was last updated at
`2026-07-22T09:11:34.235Z`. It is the Gemini classifier graph. The older
tracked rollback artifact and topology manifests describe a materially older
graph/version and were not overwritten.

## Candidate

The new paused candidate is:

```text
operations/automations/n8n/workflows/save-to-mind-bedrock-haiku-candidate-2026-08-29.json
```

SHA-256: `3d16a2713a9c03288f78fbbbfcde24ef4f2decfa1400ceb829b596e7f0bd2031`

It preserves the workflow identity, webhook, node IDs/names, graph, settings,
sharing, GitHub create/update logic, response, and `inbox/new` / `inbox/failed`
routing. Only the classification request/transport/parser portion changes.
The transport is n8n's AWS predefined credential signer and the model is the
Brain-pinned Claude Haiku 4.5 Bedrock ID. The parser accepts only the expected
strict JSON shape, strips a single accidental Markdown fence defensively, and
routes transport/parse failures to `inbox/failed` without copying raw provider
errors or model output into the failure summary.

The candidate intentionally contains no credential mapping because the exact
existing n8n AWS credential reference could not be obtained through the live
public API. No credential ID was invented, no credential backup was read, and
no credential was created or changed.

## Validation and live state

Passed:

```text
node --test tools/n8n-save-to-mind-bedrock-candidate.test.mjs
```

The structural validator also confirms the preserved boundaries, canonical
paths, graph, Bedrock request shape, and no Gemini transport in the active
candidate nodes. It returns deployment readiness as false because the AWS
credential reference is unresolved:

```text
node tools/validate-save-to-mind-bedrock-candidate.mjs
```

No live update, activation change, webhook request, GitHub write, or Mind write
was performed. A live fixture test is therefore intentionally not claimed.
The existing fixture adapter remains write-boundary aware, but it cannot make
an un-deployed candidate executable.

The live mutation is blocked until Brain's controlled n8n mutation surface is
available and an operator-approved exact existing AWS credential reference can
be resolved without exposing credential values.

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
