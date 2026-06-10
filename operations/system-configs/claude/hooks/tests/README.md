# Claude Hook Behavior Tests

**Purpose:** Standardize expected behavior for Brain's deterministic Claude hooks.

These are lightweight behavior examples for manual or future automated testing. Hook implementation lives one directory up in `operations/system-configs/claude/hooks/`.

**Policy reference:** `docs/rules/rule-onboarding-and-hook-policy.md`  
**Candidate registry:** `docs/rules/hook-candidate-registry.md`

---

## Hook Payload Shape

Claude hook scripts receive JSON on stdin. Most Brain hooks inspect `tool_input.command`, `tool_input.file_path`, or `tool_input.path`.

Example Bash payload:

```json
{
  "tool_input": {
    "command": "git push origin main"
  }
}
```

Example edit/write payload:

```json
{
  "tool_input": {
    "file_path": "ai/skills/active/greploop/SKILL.md"
  }
}
```

Expected ask response shape:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "ask",
    "permissionDecisionReason": "..."
  }
}
```

Expected allow response shape:

```json
{}
```

---

## HC-001 — Generated/runtime file staging guard

Hook:

```text
check-generated-stage.sh
```

### Allow examples

| Payload command | Repo state | Expected |
|---|---|---|
| `git add docs/rules/hook-candidate-registry.md` | Any | allow |
| `git commit -m "docs: update rules"` | No generated/runtime files staged | allow |

### Ask examples

| Payload command | Repo state | Expected reason |
|---|---|---|
| `git add .` | Dirty `.next/` or `tsx-*` or SQLite runtime file exists | Ask to stage exact intended paths. |
| `git add -A` | Dirty generated/runtime path exists | Ask to avoid broad staging. |
| `git commit -m "x"` | Generated/runtime file is staged | Ask to confirm generated artifact commit or unstage. |

Generated/runtime patterns include:

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

---

## HC-002 — Active skill surface guard

Hook:

```text
check-active-skill-surface.sh
```

### Allow examples

| Payload | Expected |
|---|---|
| `{"tool_input":{"file_path":"ai/skills/custom/greploop/SKILL.md"}}` | allow |
| `{"tool_input":{"file_path":"docs/skills/skill-index.md"}}` | allow |

### Ask examples

| Payload | Expected reason |
|---|---|
| `{"tool_input":{"file_path":"ai/skills/active/greploop/SKILL.md"}}` | Ask because raw `SKILL.md` under `active/` is not the source location. |
| `{"tool_input":{"command":"mkdir ai/skills/active/new-skill"}}` | Ask because active skill surface creation should be intentional. |
| `{"tool_input":{"command":"cp -R ai/skills/custom/foo ai/skills/active/foo"}}` | Ask because source should stay in `custom/` or `vendors/`. |
| `{"tool_input":{"command":"ln -s ../custom/foo ai/skills/active/foo"}}` | Ask because activation must be an explicit profile/export decision. |

---

## HC-003 — Review-before-ship guard

Hook:

```text
check-review-before-ship.sh
```

### Allow examples

| Payload command | Repo/state evidence | Expected |
|---|---|---|
| `git status --short` | Any | allow |
| `git push origin main` | `.ai/review-ok` exists | allow |
| `gh pr create` | `.ai/current.md` contains `Review passed` | allow |
| `npm publish` | `~/.local/state/brain-hooks/review-ok` exists | allow |

### Ask examples

| Payload command | Repo/state evidence | Expected reason |
|---|---|---|
| `git push origin main` | No review marker | Ask to run `/review` or confirm proceeding. |
| `gh pr create` | No review marker | Ask to run `/review` or confirm proceeding. |
| `wrangler deploy` | No review marker | Ask to run `/review` or confirm proceeding. |
| `terraform apply` | No review marker | Ask to run `/review` or confirm proceeding. |

---

## HC-004 — Sensitive edit guard expansion

Hook:

```text
check-sensitive-edit.sh
```

### Allow examples

| Payload path | Expected |
|---|---|
| `.env.example` | allow |
| `.env.sample` | allow |
| `.env.template` | allow |
| `docs/rules/hook-candidate-registry.md` | allow |

### Ask examples

| Payload path | Expected reason |
|---|---|
| `.env.local` | Ask before editing environment config. |
| `.env.production` | Ask before editing environment config. |
| `secrets/client_secret.json` | Ask before editing credential material. |
| `.kube/config` | Ask before editing local cluster credentials/config. |
| `.docker/config.json` | Ask before editing Docker auth/config. |
| `ios/app.mobileprovision` | Ask before editing signing/profile material. |
| `certs/prod.p12` | Ask before editing certificate material. |

---

## HC-005 — Risky command guard expansion

Hook:

```text
check-risky-command.sh
```

### Allow examples

| Payload command | Expected |
|---|---|
| `git status --short` | allow |
| `git diff -- docs/rules/hook-candidate-registry.md` | allow |
| `docker compose ps` | allow |
| `supabase db push --local` | allow only when command clearly targets local DB context already recognized by the hook |

### Ask examples

| Payload command | Expected reason |
|---|---|
| `git clean -fdx` | Ask before destructive git cleanup. |
| `git branch -D old-branch` | Ask before destructive branch delete. |
| `git tag -d v1.0.0` | Ask before tag delete. |
| `git push origin --delete old-branch` | Ask before remote delete. |
| `docker compose down -v` | Ask before removing volumes. |
| `docker system prune -a` | Ask before system cleanup. |
| `supabase db reset` | Ask before DB reset unless local context is explicit and safe. |
| `drizzle-kit drop` | Ask before DB/schema drop. |

---

## Manual Test Procedure

1. Construct a payload JSON matching the example.
2. Pipe it into the hook script from the repo root.
3. Confirm output is `{}` for allow cases or contains `permissionDecision: ask` for ask cases.
4. For stateful tests, create temporary markers such as `.ai/review-ok` only in disposable test repos or remove them after testing.
5. Never create real secrets or generated artifacts solely to test hooks in the Brain repo.

---

## Future Automation

When adding an automated harness, keep it local and deterministic:

- use temporary directories for Git state;
- do not require network access;
- do not mutate real credentials or production config;
- assert only JSON response shape and decision level;
- keep fixtures small and text-only.
