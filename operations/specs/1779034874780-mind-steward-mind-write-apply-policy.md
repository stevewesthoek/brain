# Mind Steward Mind Write/Apply Policy

## Status

**Draft policy only. No mind-steward Mind mutation is approved or implemented by this document.**

This policy defines the gates required before the mind steward may perform any write/apply operation against the `mind` vault. Until every gate below is implemented, tested, reviewed, and explicitly approved, the mind steward remains report-only for Mind.

## Purpose

The Obsidian Mind + Mind Steward roadmap needs a safe way to move from report-only maintenance into controlled, reversible Mind updates. The first allowed mutation must be narrower than the full roadmap and must prove that previews, approval, rollback, audit, and validation all work before broader compile/archive loops are allowed.

## Non-goals

The first write/apply phase must not support:

- broad shell execution;
- recursive archive/delete operations;
- arbitrary file paths;
- `.obsidian/` plugin or local config writes;
- legacy numbered-folder archival;
- mass task rewrites;
- Brain runtime/log/report writes into Mind;
- approval store or audit JSONL writes into Mind;
- secrets, credentials, private keys, or live tokens;
- background execution without an approval record.

## Allowed roots for a future first apply action

A future first apply action may target only these Mind paths:

```text
capture/inbox/
capture/failed/
live/tasks.md
live/projects.md
live/decisions.md
sources/index.md
wiki/index.md
router/current.md
```

The first implementation should use an even narrower subset. Recommended first write action:

```text
update router/current.md from a dry-run preview
```

Reason: it is low-impact, bounded by a 150-line limit, easy to diff, and easy to roll back.

## Blocked roots

The mind steward must never write these paths without a separate policy and explicit approval:

```text
.git/
.env
.env.*
.obsidian/
node_modules/
dist/
build/
coverage/
runtime/
logs/
01-inbox/
02-strategy/
03-projects/
04-tasks/
05-areas/
06-resources/
07-templates/
08-archive/
archive/old/
```

Legacy numbered folders are read-only references during early apply phases.

## Operation classes

### Report-only

Allowed today.

Behavior:

- read stat-only metadata or explicitly allowed Markdown files;
- produce Brain-owned runtime reports under `brain/runtime/local/`;
- set `writesToMind=false`;
- set `externalSideEffects=false`.

### Preview-only

Allowed only after implementation and tests.

Behavior:

- compute proposed patches;
- write preview artifacts only to Brain-owned runtime/report paths;
- include exact target paths, old hash, new hash, and unified diff;
- no Mind writes;
- set `writesToMind=false`.

### Apply-one

Future controlled action only.

Behavior:

- apply exactly one approved patch to exactly one allowed Mind file;
- require a matching preview hash;
- require durable approval store and audit path;
- require local-only request;
- create or update no more than one Mind file;
- write an audit event after success/failure;
- run post-apply validation;
- set `writesToMind=true` only for the approved target path.

### Batch apply

Not allowed in the first write/apply phase.

### Destructive/archive apply

Not allowed in the first write/apply phase.

## Required preview fields

Every preview must include:

```json
{
  "kind": "mind-steward-mind-preview",
  "actionKind": "mind-steward-update-current-context",
  "mindRootId": "mind",
  "targetPath": "router/current.md",
  "operation": "patch|overwrite|create",
  "allowedRoot": true,
  "blockedRoot": false,
  "oldHash": "sha256-or-null",
  "newHash": "sha256",
  "lineCountBefore": 0,
  "lineCountAfter": 0,
  "maxLines": 150,
  "unifiedDiff": "...",
  "writesToMind": false,
  "externalSideEffects": false,
  "createdAt": "ISO-8601"
}
```

Previews must not include secrets or raw private material beyond the minimal diff needed for operator review.

## Approval gates

A future apply route must require all gates:

1. localhost-only request;
2. exact action kind allowlist;
3. durable approval store configured under Brain `runtime/local/`;
4. durable approval audit configured under Brain `runtime/local/`;
5. preview exists and is fresh;
6. approved approval record references the exact preview hash;
7. target path is inside an allowed root;
8. target path is not inside a blocked root;
9. operation class is `apply-one`;
10. no generated content contains live-looking secrets;
11. post-apply validation passes;
12. rollback instructions are written before apply.

## First action proposal

Recommended first future apply action:

```text
mind-steward-update-current-context
```

Target:

```text
mind/router/current.md
```

Constraints:

- maximum 150 lines;
- Markdown only;
- no frontmatter secrets;
- must retain a `Last reviewed` or equivalent timestamp line;
- must link to `HOME.md`, `TODAY.md`, and `live/dashboard.md` if useful;
- must not include runtime logs or approval/audit content;
- must be generated from a preview artifact;
- must be reversible by restoring the old hash content captured in preview.

## Validation requirements

Before apply implementation is accepted:

```bash
npm run --prefix projects/mind-steward ci
npm run --prefix projects/brain-core ci
```

Additional tests required:

- allowed-root acceptance;
- blocked-root rejection;
- line-limit enforcement;
- stale preview rejection;
- mismatched preview hash rejection;
- missing approval rejection;
- disabled feature flag rejection;
- no-secret scan rejection;
- post-apply validation failure rollback path;
- no `.obsidian/` write test;
- no legacy numbered-folder write test.

## Rollback requirements

Each apply event must record:

```text
approval id
preview id
old hash
new hash
target path
operation
operator
applied at
validation result
rollback command/instructions
```

For the first action, rollback must be a single-file restore of `router/current.md` from the old preview content.

## Required audit event

A successful apply must append a Brain-owned audit event similar to:

```json
{
  "event": "applied",
  "approvalId": "approval-1",
  "previewId": "preview-1",
  "kind": "mind-steward-update-current-context",
  "targetPath": "router/current.md",
  "writesToMind": true,
  "externalSideEffects": false,
  "status": "ok",
  "appliedAt": "ISO-8601"
}
```

Audit files must remain under Brain `runtime/local/` and must never be written to Mind.

## Expansion sequence after first action

Only after the first apply action is implemented, tested, manually reviewed, and successfully rolled back in a drill:

1. allow `live/tasks.md` append/update previews;
2. allow `live/projects.md` previewed updates;
3. allow `live/decisions.md` append-only updates;
4. allow `sources/index.md` refreshes;
5. allow selected `wiki/*.md` compile previews;
6. design a separate legacy archival policy.

Legacy folder archival remains a separate phase and must not be bundled with the first apply policy.

## Acceptance criteria for this policy document

- The policy preserves the current report-only invariant.
- The first future action is narrow and reversible.
- Allowed and blocked roots are explicit.
- Approval, audit, preview, validation, and rollback gates are explicit.
- Destructive/archive behavior remains out of scope.
