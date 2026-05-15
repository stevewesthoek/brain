# Skill Profile Onboarding and Maintenance Runbook

## Purpose

Keep the Brain skill system fast, AI-agnostic, and usable through natural language while preventing Codex/Claude/Gemini context bloat.

The system has three layers:

1. **Source skills** live in `ai/skills/custom/**` or `ai/skills/vendors/**`.
2. **Profiles** live in `docs/skills/profiles/*.txt` and decide which source skills become active for a session type.
3. **Active skills** live in `ai/skills/active/` and are synced to AI/IDE consumers by `tools/scripts/sync-ai-skills.mjs`.

The user should not need to remember skill names. Orchestrators and the skill index must route natural-language requests to the right profile or dormant capability.

---

## Default architecture

### Default profile

`docs/skills/profiles/default.txt` is intentionally small. It should contain only the minimal always-on surface:

```text
code
research
memory
review
qa
handoff
careful
```

Do not add heavy domain orchestrators or tool skills to default unless there is a strong reason. Large skills such as `design`, `video`, `firecrawl`, `playwright`, `ffmpeg`, `n8n`, and `autoresearch` should stay in domain profiles.

### Power profile

`docs/skills/profiles/power.txt` preserves the old broader default profile. Use it only when a session needs many domains at once and context budget warnings are acceptable.

### Domain profiles

- `research.txt` for research, source acquisition, browser/scraping, Bible research, Scripture sources, and media source retrieval.
- `video.txt` for video production, metadata/transcript acquisition, rendering, and publishing preparation.
- `design.txt` for web/UI/UX/brand/motion/reference work.
- `deploy.txt` for infrastructure, deployment, cloud, Docker, GitHub, and hosting workflows.

---

## New skill onboarding checklist

When adding a new skill, complete every step below.

### 1. Add the source skill

Place the skill in one of:

```text
ai/skills/custom/<skill-name>/SKILL.md
ai/skills/vendors/<vendor>/<skill-name>/SKILL.md
```

Use a concise frontmatter description. The description should explain when the skill should activate, not duplicate the whole skill body.

### 2. Decide whether it is always-on or dormant

Default answer: **dormant**.

Add to `default.txt` only if all are true:

- It is used in ordinary daily sessions.
- It is small enough not to hurt Codex skill budget.
- It is needed before any domain profile can be selected.
- It cannot be reliably routed through an existing orchestrator.

Most skills should be added to a domain profile instead.

### 3. Add the skill to the right profile

Choose one or more:

```text
docs/skills/profiles/research.txt
docs/skills/profiles/video.txt
docs/skills/profiles/design.txt
docs/skills/profiles/deploy.txt
docs/skills/profiles/power.txt
```

Do not add to every profile by default. Add only where natural-language workflows actually need it.

### 4. Update the skill index

Update `docs/skills/skill-index.md` with:

- skill name
- profile location
- natural-language use case
- source path
- related runbook, if any
- whether it is dormant or default active

The index is what allows AI agents to discover dormant skills without the user knowing skill commands.

### 5. Update orchestrator routing where needed

If the new skill should be used implicitly, update the relevant orchestrator skill, usually one of:

```text
ai/skills/custom/code/SKILL.md
ai/skills/custom/research/SKILL.md
ai/skills/custom/video/SKILL.md
ai/skills/custom/design/SKILL.md
```

Add a short routing rule only. Do not paste the entire subskill into the orchestrator. The orchestrator should know when to route, not become the subskill.

### 6. Add a runbook when the skill has operational behavior

Create a runbook under:

```text
operations/runbooks/<skill-or-capability>.md
```

Use a runbook when the skill has:

- external tools
- credentials
- source acquisition
- network behavior
- side effects
- generated artifacts
- safety boundaries
- repeatable procedures

### 7. Validate profiles

Run dry-run validation before applying anything:

```bash
node tools/scripts/switch-skill-profile.mjs default --dry-run --verbose
node tools/scripts/switch-skill-profile.mjs power --dry-run --verbose
node tools/scripts/switch-skill-profile.mjs research --dry-run --verbose
node tools/scripts/switch-skill-profile.mjs video --dry-run --verbose
node tools/scripts/switch-skill-profile.mjs design --dry-run --verbose
```

If the skill belongs to deploy, also run:

```bash
node tools/scripts/switch-skill-profile.mjs deploy --dry-run --verbose
```

All referenced skills must resolve. The switcher should fail rather than silently skipping missing skills.

### 8. Apply only the intended profile

For normal Codex work, apply default:

```bash
node tools/scripts/switch-skill-profile.mjs default --apply
```

For a domain-specific session, apply the domain profile:

```bash
node tools/scripts/switch-skill-profile.mjs research --apply
node tools/scripts/switch-skill-profile.mjs video --apply
node tools/scripts/switch-skill-profile.mjs design --apply
```

The apply command syncs `ai/skills/active/` to configured AI/IDE consumers.

### 9. Check active state

After applying:

```bash
node tools/scripts/switch-skill-profile.mjs default --check
node tools/scripts/sync-ai-skills.mjs --check
find ai/skills/active -maxdepth 1 -mindepth 1 | sort
```

Expected default active count: 7.

### 10. Commit only intended files

Profiles and docs are source-of-truth changes. Active symlink changes may also appear after applying a profile. Commit them only when the intended repository default active state should change.

Never accidentally commit unrelated local state such as logs, model tracking, editor cache, SSH config, generated Cursor files, or temporary tool output.

---

## Natural-language routing requirement

Every new skill must be reachable without the user naming it.

A good onboarding answer for any new skill should be:

- What natural-language request should trigger it?
- Which active orchestrator notices that request?
- Which profile contains the skill if dormant?
- Which runbook explains safe operation?
- What output or artifact should it produce?

If those questions are not answered, the skill is not fully onboarded.

---

## Context-budget rule

The default profile is optimized for Codex context budget. Keep it small.

If Codex warns that skill descriptions were shortened, first check:

1. `ai/skills/active/` count
2. large active orchestrator sizes
3. whether default accidentally contains domain/tool skills
4. whether `power`, `research`, `video`, or `design` is active instead of default

Do not solve context pressure by deleting skills. Use profiles.

---

## Known Kiro behavior

Kiro uses entry symlinks rather than a root symlink. `sync-ai-skills.mjs` may warn about stale Kiro entries that no longer correspond to active skills. The sync check can still pass if every active skill is reachable.

If stale Kiro entries become confusing, clean them deliberately in a separate maintenance pass. Do not mix Kiro cleanup with unrelated skill onboarding.
