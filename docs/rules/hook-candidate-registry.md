# Hook Candidate Registry

**Purpose:** Track Brain rules that may move out of always-on prompt context and into deterministic hooks or CI checks.

**Status:** Phase 2 registry. This document is planning/tracking only; it does not implement hooks.

**Policy:** Use `docs/rules/rule-onboarding-and-hook-policy.md` before adding, changing, or enforcing a hook candidate.

---

## Candidate Status Values

| Status | Meaning |
|---|---|
| `candidate` | Identified as potentially hook-worthy, not implemented. |
| `designing` | Trigger/evidence/enforcement are being specified. |
| `implemented` | Hook or CI check exists. |
| `deferred` | Valid idea but not worth implementing yet. |
| `rejected` | Not deterministic enough or belongs elsewhere. |

---

## Enforcement Levels

| Level | Meaning |
|---|---|
| `warn` | Non-blocking reminder. |
| `ask` | Require confirmation before continuing. |
| `block` | Stop the action. Use only for hard invariants. |

Start new hooks at `warn` or `ask` unless the false-positive risk is proven low.

---

## Tier 1 — Implement First

### HC-001 — Generated/runtime file staging guard

| Field | Value |
|---|---|
| Status | `implemented` |
| Source rule | Do not accidentally commit generated/runtime junk. Stage exact intended paths. |
| Determinism | High |
| Destination | Hook |
| Implemented hook | `operations/system-configs/claude/hooks/check-generated-stage.sh` |
| Event/matcher | `PreToolUse` / `Bash` |
| Initial level | `ask`, with `block` possible for hard generated paths later |
| False-positive risk | Low-medium |
| Implemented in | `operations/system-configs/claude/settings.json` Bash PreToolUse hook chain |

**Trigger examples:**

```text
git add .
git add -A
git add --all
git commit
```

**Path patterns to inspect in staged files or broad staging context:**

```text
.next/
tsx-*/
graphify-out/
node_modules/
dist/
build/
coverage/
*.sqlite
*.sqlite-shm
*.sqlite-wal
*.pack.gz
*.tsbuildinfo
Codex Computer Use.app/
projects/video-orchestrator/cloud/jobs/
```

**Expected behavior:**

- Allow exact staging of normal source/docs paths.
- Ask on broad staging commands when generated/runtime paths are dirty or staged.
- Ask before commit if generated/runtime files are staged.
- Explain that exact intended paths should be staged instead.

**Evidence to allow:**

- No generated/runtime files are staged.
- User explicitly confirms staging generated artifacts.
- Future allowlist entry documents a generated artifact that is intentionally tracked.

---

### HC-002 — Active skill surface guard

| Field | Value |
|---|---|
| Status | `implemented` |
| Source rule | `active/` is the exported skill surface; dormant skills stay in `custom/` or `vendors/` unless intentionally activated. |
| Determinism | High |
| Destination | Hook |
| Implemented hook | `operations/system-configs/claude/hooks/check-active-skill-surface.sh` |
| Event/matcher | `PreToolUse` / `Edit`, `Write`, `MultiEdit`, and `Bash` |
| Initial level | `ask` |
| False-positive risk | Low |
| Implemented in | `operations/system-configs/claude/settings.json` Bash/Edit/Write/MultiEdit PreToolUse hook chains |

**Trigger path examples:**

```text
ai/skills/active/*
```

**Ask/block examples:**

```text
Write ai/skills/active/greploop/SKILL.md
mkdir ai/skills/active/new-skill
cp -R ai/skills/custom/foo ai/skills/active/foo
```

**Allow examples:**

```text
Edit ai/skills/custom/greploop/SKILL.md
Edit ai/skills/vendors/gstack/review/SKILL.md
Edit docs/skills/skill-index.md
```

**Expected behavior:**

- Prevent raw skill folders/files from being placed directly in `active/`.
- Ask before creating or changing active symlinks.
- Remind that activation is an explicit profile/export decision, not the default way to make orchestrator subskills available.

---

### HC-003 — Review-before-ship guard

| Field | Value |
|---|---|
| Status | `candidate` |
| Source rule | `/code` Law 3: review before PR creation or shipping. |
| Determinism | Medium-high |
| Destination | Hook, possibly CI too |
| Proposed hook | `operations/system-configs/claude/hooks/check-review-before-ship.sh` |
| Event/matcher | `PreToolUse` / `Bash` |
| Initial level | `ask` |
| False-positive risk | Medium |

**Trigger command examples:**

```text
git push
gh pr create
npm publish
cargo publish
wrangler deploy
vercel deploy
terraform apply
pulumi up
kubectl apply
helm upgrade
dokploy deploy
```

**Expected behavior:**

- Ask for confirmation when shipping commands run without nearby review evidence.
- Do not hard-block initially because review evidence format is not standardized yet.

**Potential review evidence:**

```text
.ai/review-ok
.ai/current.md contains recent "Review passed"
local state file under ~/.local/state/brain-hooks/
explicit user confirmation
```

**Open design decision:** Define the review evidence marker before implementation.

---

## Tier 1 Extensions — Existing Hooks

### HC-004 — Expand sensitive edit guard

| Field | Value |
|---|---|
| Status | `candidate` |
| Existing hook | `operations/system-configs/claude/hooks/check-sensitive-edit.sh` |
| Determinism | High |
| Initial level | `ask` |

**Add candidate path patterns:**

```text
.env.local
.env.production
*.mobileprovision
embedded.provisionprofile
*.p12
*.cer
*.crt
*.kube/config
*.docker/config.json
*token*
*secret*
*private*
*credential*
*keychain*
```

**Notes:** Keep `.env.example`, `.env.sample`, and `.env.template` allowed.

---

### HC-005 — Expand risky command guard

| Field | Value |
|---|---|
| Status | `candidate` |
| Existing hook | `operations/system-configs/claude/hooks/check-risky-command.sh` |
| Determinism | High |
| Initial level | `ask` |

**Add/verify command patterns:**

```text
git clean -fd
git clean -fdx
git branch -D
git tag -d
git push --delete
docker compose down -v
docker system prune
dropdb
psql ... DROP
supabase db reset
prisma migrate reset
drizzle-kit drop
```

---

## Tier 2 — Warnings First

### HC-006 — Truncated code warning

| Field | Value |
|---|---|
| Status | `candidate` |
| Source rule | `/code` Law 4: never truncate code. |
| Determinism | Medium |
| Destination | Hook warning or review check |
| Proposed hook | `operations/system-configs/claude/hooks/check-truncated-code.sh` |
| Event/matcher | `PreToolUse` / `Edit`, `Write`, `MultiEdit` |
| Initial level | `warn` or `ask` |
| False-positive risk | Medium |

**Candidate markers:**

```text
// ... rest of file
# ... rest of file
/* omitted */
rest unchanged
placeholder implementation
TODO: implement later
```

**Notes:** Start as a warning because docs/tests can legitimately mention these strings.

---

### HC-007 — Memory bulk-read warning

| Field | Value |
|---|---|
| Status | `candidate` |
| Source rule | Use memory index entrypoints instead of reading all memory files. |
| Determinism | Medium |
| Destination | Hook warning |
| Proposed hook | Extend Bash safety hook or new `check-memory-bulk-read.sh` |
| Event/matcher | `PreToolUse` / `Bash` |
| Initial level | `warn` |

**Trigger command examples:**

```text
cat ai/memory/*
grep -R . ai/memory
find ai/memory -type f -exec cat
```

**Suggested replacement:**

```text
mem-search
mem-search <keyword>
mem-search --id <id>
```

---

### HC-008 — Dry-run/plan evidence before risky mutations

| Field | Value |
|---|---|
| Status | `candidate` |
| Source rule | Prefer previews/diffs/read-only inspection before risky mutations. |
| Determinism | Medium |
| Destination | Hook |
| Proposed hook | `operations/system-configs/claude/hooks/check-dry-run-required.sh` |
| Event/matcher | `PreToolUse` / `Bash` |
| Initial level | `ask` |
| False-positive risk | Medium |

**Candidate commands:**

```text
terraform apply
pulumi up
kubectl apply
helm upgrade
dokploy deploy
wrangler deploy
```

**Open design decision:** Define evidence markers for plan/dry-run results.

---

## Rejected / Keep in Orchestrators

These are important rules, but they are not good hook candidates because they require judgment, intent classification, or semantic understanding.

| Rule | Destination | Reason |
|---|---|---|
| Map before refactoring | `/code` | Requires intent classification and knowing what counts as refactor/improve. |
| Plan before implementation | `/code` | Multi-file detection is deterministic, but plan quality/existence is not yet standardized. |
| GrepLoop routing | `/code` + dormant `greploop` | Requires interpreting review findings and user intent. |
| Reuse existing patterns | `/code` / `graphify` | Requires semantic codebase understanding. |
| Scope discipline | `/code` | Requires comparing user intent with diff semantics. |
| Root cause first | `/code` / `investigate` | Requires debugging reasoning. |
| Extract non-obvious fixes | `/code` / `learner` | Requires knowing whether a fix was hard-won and reusable. |

---

## Implementation Order

1. HC-001 `check-generated-stage.sh`
2. HC-002 `check-active-skill-surface.sh`
3. HC-003 `check-review-before-ship.sh`
4. HC-004 expand `check-sensitive-edit.sh`
5. HC-005 expand `check-risky-command.sh`
6. HC-006/007/008 only after Tier 1 is stable

---

## Registry Maintenance

When adding a new candidate:

1. Fill out the fields above.
2. Link to the source rule or doc section.
3. Classify determinism using `rule-onboarding-and-hook-policy.md`.
4. Choose initial enforcement level.
5. Document false-positive risk and allow examples.
6. Do not implement the hook until the candidate has at least one allow example and one ask/block example.
