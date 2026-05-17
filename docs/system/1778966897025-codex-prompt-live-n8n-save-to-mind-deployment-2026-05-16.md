# Codex Prompt — Live n8n Save-to-Mind Deployment and Verification

## Repo / source

Work from the `brain` repo.

Relevant connected repos:

- `brain` — executable infrastructure, n8n workflow JSON, runbooks, model-router implementation.
- `mind` — Obsidian vault and Mind OS target structure.

## Goal

Deploy and verify the live n8n Save-to-Mind workflow path migration so that the existing public webhook continues to work while successful captures land in the new Mind OS path:

```text
mind/capture/inbox/
```

The public endpoint must remain compatible:

```text
/webhook/mind-inbox
```

After success, update the handoff/docs to mark this slice verified and prepare the next safe phase.

## Current proven state

The following was already verified through BuildFlow before this prompt was created:

- `brain` and `mind` are separate repos.
- Matching handoff files were read:
  - `brain/docs/system/mind-os-migration-handoff-2026-05-16.md`
  - `mind/MIND-OS-HANDOFF-2026-05-16.md`
- Roadmap / implementation files were read:
  - `brain/docs/system/obsidian-brain-core-roadmap.md`
  - `brain/docs/system/obsidian-brain-core-implementation-plan.md`
  - `brain/docs/system/obsidian-mind-model-router-roadmap.md`
  - `mind/MIND-OS-ROADMAP.md`
  - `mind/MIND-OS-IMPLEMENTATION-PLAN.md`
- Mind OS scaffold exists in `mind`, including:
  - `capture/inbox/`
  - `capture/failed/`
  - `router/`
  - `live/`
  - `wiki/`
  - `sources/`
  - `archive/`
- Repo copy of the n8n workflow JSON validates:
  - `brain/operations/automations/n8n/workflows/mind-inbox-fixed.json`
- The workflow JSON repo copy was previously patched to write successful captures to:

```text
capture/inbox/${date}-${slug}.md
```

instead of:

```text
01-inbox/${date}-${slug}.md
```

- Model-router scaffold was advanced with a read-only contract dry-run helper:
  - `brain/projects/model-router/src/contracts.ts`
  - `brain/projects/model-router/src/jobs.ts`
  - `brain/projects/model-router/src/index.ts`
  - `brain/projects/model-router/README.md`

## Important current limitation

BuildFlow could not verify live n8n deployment or execute the production webhook test. Codex must perform the live n8n deployment/test only if it has the correct repo/tooling/environment access.

Do not claim live deployment unless Codex actually verifies it.

## Safety rules

Hard requirements:

- Do not expose, print, commit, or write secrets.
- Do not inspect `.env`, `.env.*`, private keys, credential stores, token files, browser session stores, or secret folders unless an existing safe deploy tool abstracts them without showing values.
- Do not paste tokens into logs or docs.
- Keep public webhook path stable: `/webhook/mind-inbox`.
- Do not move, archive, delete, or rewrite legacy Mind folders:

```text
mind/01-inbox/
mind/02-strategy/
mind/03-projects/
mind/04-tasks/
mind/05-areas/
mind/06-resources/
mind/07-templates/
mind/08-archive/
```

- Do not stage or commit unrelated dirty state.
- Do not commit or push unless explicitly asked by the user.
- Use explicit paths only if staging is requested later.
- Treat `mind` as human memory. Do not store machine runtime secrets or raw credentials in it.

## Known unrelated dirty state to avoid

In `brain`, unrelated/pre-existing dirty paths were observed:

```text
operations/system-configs/codex/skills/.system/openai-docs/SKILL.md
tools/firecrawl/logs/firecrawl.log
```

Do not include these in this migration unless separately reviewed and explicitly requested.

In `mind`, substantial unrelated churn was observed, including `.obsidian` changes, deleted `04-tasks/...` files, untracked inbox/base files, and other research/task folders.

Do not stage or commit those unrelated paths.

## Files to read first

Read these before changing anything:

```text
brain/docs/system/mind-os-migration-handoff-2026-05-16.md
brain/operations/runbooks/n8n-mind-inbox.md
brain/operations/automations/n8n/workflows/mind-inbox-fixed.json
brain/projects/model-router/README.md
brain/projects/model-router/src/contracts.ts
brain/projects/model-router/src/jobs.ts
brain/projects/model-router/src/index.ts
mind/MIND-OS-HANDOFF-2026-05-16.md
mind/HOME.md
mind/README.md
mind/router/model-router.md
mind/router/rules.md
mind/capture/inbox/README.md
mind/capture/failed/README.md
```

## Task 1 — Inspect deployment tooling

Find the safest existing way to deploy or update the live n8n workflow from the repo copy.

Look for repo-local scripts/runbooks/docs only. Useful likely locations:

```text
brain/operations/runbooks/
brain/operations/automations/n8n/
brain/tools/
brain/package.json
brain/projects/probot/src/scripts/
```

Determine whether the repo has a safe deploy/import path for:

```text
brain/operations/automations/n8n/workflows/mind-inbox-fixed.json
```

If safe deployment tooling is not available, stop and write a clear blocker note. Do not improvise by exposing credentials or manually editing live systems through unsafe steps.

## Task 2 — Validate repo workflow JSON before deployment

Before live deployment, validate:

- JSON syntax.
- Workflow still contains `/mind-inbox` as the public webhook path.
- Successful output path is `capture/inbox/`.
- No remaining successful write path points to `01-inbox/`.
- No secrets or live credentials are present in the workflow JSON.

Suggested safe checks:

```bash
python3 -m json.tool operations/automations/n8n/workflows/mind-inbox-fixed.json >/dev/null
rg "mind-inbox|capture/inbox|01-inbox|capture/failed" operations/automations/n8n/workflows/mind-inbox-fixed.json operations/runbooks/n8n-mind-inbox.md
```

Do not print credential values. If any credential-like content appears, redact it in notes and do not commit it.

## Task 3 — Deploy live n8n workflow path change if safe tooling exists

Deploy only the Save-to-Mind workflow change needed to make successful captures land in:

```text
mind/capture/inbox/
```

Keep endpoint compatibility:

```text
/webhook/mind-inbox
```

Do not deploy unrelated workflow changes.

Record exactly which tool/script/API/import method was used, but do not record secrets.

## Task 4 — Run a safe production webhook test

After deployment, trigger the production webhook with a harmless test capture.

Test capture content should be clearly identifiable and non-sensitive, for example:

```text
Title: Mind OS live deployment verification
Body: Safe test capture created to verify Save-to-Mind writes to capture/inbox after the Mind OS migration.
Tags: mind-os, deployment-test
```

Use the expected public endpoint shape for the live system. Keep `/mind-inbox` stable.

Do not include private data, secrets, client data, or credentials in the test.

## Task 5 — Verify the capture landed in the new path

Verify a new markdown file appears under:

```text
mind/capture/inbox/
```

Confirm:

- It was created by the live n8n workflow test.
- It does not land in `mind/01-inbox/`.
- Filename is sane and date/slug based if applicable.
- Content is safe and contains no secrets.

If the capture still lands in `01-inbox/`, do not proceed to mark live as verified. Diagnose whether live n8n did not deploy, deployed the wrong workflow, or has another active workflow handling `/mind-inbox`.

## Task 6 — Verify failure-buffer behavior if implemented

The desired failure target is:

```text
mind/capture/failed/
```

Only test failure behavior if the workflow already supports a safe failure path or if implementing it is low-risk and does not threaten successful capture behavior.

Do not intentionally break production or send malformed payloads that could cause noisy failures.

If failure-buffer behavior is not implemented or cannot be safely verified, document it as the next separate slice.

## Task 7 — Update docs and handoffs only after real verification

If live deployment and successful capture are verified, update:

```text
brain/docs/system/mind-os-migration-handoff-2026-05-16.md
mind/MIND-OS-HANDOFF-2026-05-16.md
brain/operations/runbooks/n8n-mind-inbox.md
mind/HOME.md
mind/README.md
```

Update wording from “target/pending live deployment” to “verified live” only where true.

Include:

- Absolute verification date.
- What was deployed.
- Which public endpoint was tested.
- The verified target folder.
- The test capture filename/path.
- Any remaining limitations, especially failure-buffer behavior if not tested.

Do not overstate. If only successful captures are verified, say exactly that.

## Task 8 — Optional: run model-router dry-run contract helper

If practical, create a small temporary/manual validation script or use existing test harness to exercise:

```ts
createMindContractDryRunResult(...)
```

with observed Mind OS paths.

Expected result after scaffold validation:

- No missing required Mind OS folders.
- No missing router contract files.
- No missing live cockpit files.
- Legacy numbered folders are reported as present/read-only warnings.
- `saveToMindTarget` should be `capture-inbox` only after live capture is verified.
- `liveDeploymentVerified` should be `true` only after live capture is verified.

Do not add write behavior yet.

## Validation checklist

Run and record results:

```bash
git status --short
python3 -m json.tool operations/automations/n8n/workflows/mind-inbox-fixed.json >/dev/null
rg "01-inbox" operations/automations/n8n/workflows/mind-inbox-fixed.json operations/runbooks/n8n-mind-inbox.md docs/system/mind-os-migration-handoff-2026-05-16.md
rg "capture/inbox|capture/failed|mind-inbox" operations/automations/n8n/workflows/mind-inbox-fixed.json operations/runbooks/n8n-mind-inbox.md docs/system/mind-os-migration-handoff-2026-05-16.md
```

Also verify in `mind`:

```bash
git status --short
find capture/inbox -maxdepth 1 -type f -name "*.md" -print
find capture/failed -maxdepth 1 -type f -name "*.md" -print
```

Use equivalent safe commands if the environment differs.

## Expected final response to user

Report:

1. Whether live n8n deployment was performed.
2. Whether `/webhook/mind-inbox` was tested.
3. Whether the test capture landed in `mind/capture/inbox/`.
4. Whether any capture still landed in `mind/01-inbox/`.
5. Whether failure-buffer behavior was verified or deferred.
6. Which files changed.
7. Which validations passed.
8. Any blockers.
9. Do not say committed or pushed unless explicitly done after user approval.

## Do not do

- Do not move/archive/delete old numbered folders.
- Do not run broad cleanup.
- Do not edit unrelated `.obsidian` files.
- Do not edit unrelated task files.
- Do not stage all files.
- Do not commit or push unless explicitly asked.
- Do not expose credentials.
- Do not claim live deployment from repo JSON alone.
