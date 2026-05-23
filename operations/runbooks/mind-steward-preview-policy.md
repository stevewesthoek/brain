# Mind Steward Preview Policy

This runbook documents the read-only preview policy surface for the first Mind apply path.

## Inspect

Use the Brain Core metadata endpoint:

```bash
curl -fsS http://127.0.0.1:4877/execution/mind-preview-policy
curl -fsS http://127.0.0.1:4877/execution/mind-previews
curl -fsS http://127.0.0.1:4877/execution/mind-previews/latest
```

Expected fields:

- `status: preview-only`
- `firstProposedAction: mind-steward-update-current-context`
- `firstProposedTarget: router/current.md`
- `applyRouteEnabled: false`
- `writesToMind: false`
- `externalSideEffects: false`

## Interpret

- `preview-only` means the policy is informational only.
- `applyRouteEnabled: false` means there is no enabled Brain Core apply route.
- `writesToMind: false` means no Mind mutation is authorized by the metadata surface.
- `blockedPrefixes` identifies paths that remain off-limits, including `.obsidian/` and legacy numbered folders.
- Preview artifacts live under `runtime/local/mind-steward/previews/` and are Brain-owned only.
- `previewId` values are deterministic from safe preview fields and can be used for approval references later.

## Related docs

- `docs/system/1779034841996-obsidian-mind-steward-handoff.md`
- `operations/specs/1779034874780-mind-steward-mind-write-apply-policy.md`
- `operations/runbooks/brain-core-approval-gates.md`

## Required gates for any future apply route

No future apply route should be enabled until all of these are proven:

1. localhost-only requests.
2. Exact action kind allowlist.
3. Durable approval store under `runtime/local/`.
4. Durable approval audit under `runtime/local/`.
5. Matching preview hash in the approval record.
6. Unexpired approved record.
7. Post-apply validation.
8. Rollback instructions captured before apply.

## Safety

- Do not add mutation commands here.
- Do not store secrets or runtime logs in Mind.
- Do not enable any Mind write route from this policy.
