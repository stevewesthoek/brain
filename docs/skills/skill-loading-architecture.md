# Skill Loading Architecture

**Status:** Implemented as profile + index system  
**Goal:** Keep all skills available while reducing the always-active skill surface for Claude Code, Codex, Gemini, Cursor, Kiro, and Antigravity.

---

## Core Rule

Do not delete, rename, or merge source skills as the first optimization step.

The safe optimization is:

```text
Many source skills remain in ai/skills/custom and ai/skills/vendors
↓
Small active profile exports only the most important orchestrators/tools
↓
Domain profiles activate larger sets when needed
↓
A skill index tells agents where dormant skills live
```

New skills are not default-active by default. Installing a skill means adding or
updating its source under `ai/skills/custom`, `ai/skills/vendors`, or another
documented dormant source location, then adding it only to the relevant
non-default profile unless Steve explicitly approves always-on activation.

---

## Why this exists

`ai/skills/active/` is exported to all AI/IDE consumers by `tools/scripts/sync-ai-skills.mjs`. A large active directory creates metadata overhead and noisy skill routing.

The repository previously had 119 active skill entries. This architecture keeps those skills available but avoids loading all of them by default.

---

## Files

- `docs/skills/profiles/default.txt` — compact always-on profile
- `docs/skills/profiles/video.txt` — video production profile
- `docs/skills/profiles/design.txt` — design/web-design profile
- `docs/skills/profiles/deploy.txt` — deployment/infrastructure profile
- `docs/skills/profiles/research.txt` — research/scraping/synthesis profile
- `docs/skills/profiles/full-current.txt` — recovery snapshot of the original active set
- `docs/skills/skill-index.md` — human-readable index of orchestrators, profiles, and dormant skills
- `tools/scripts/switch-skill-profile.mjs` — conservative profile switcher
- `tools/scripts/sync-ai-skills.mjs` — existing exporter to Claude Code, Codex, Gemini, Cursor, Kiro, and Antigravity

Codex has one extra sharp edge: it scans the live `~/.codex/skills/` directory
directly. The live directory must be real and contain only Codex-owned system
skills plus the managed user export:

```text
.system/  # Codex-owned, machine-local system skills
user -> /path/to/brain/ai/skills/active
```

`operations/system-configs/codex/skills/user` remains a repository projection
used by skill synchronization checks; the managed-home linker creates the live
`~/.codex/skills/user` link. Do not install user, vendor, or curated skills as
other top-level directories in the live skills root. Doing that bypasses the
default profile and makes the skill default-active in every Codex session.
Codex-only dormant skills belong outside the scanned root, currently under:

```text
operations/system-configs/codex/skills-dormant/
```

---

## Profiles

A profile is a newline-delimited list of skill names. Comments begin with `#`. Blank lines are ignored.

Profiles live in:

```text
docs/skills/profiles/<profile>.txt
```

Example:

```text
video
viral-flow
ffmpeg
stb-pipeline
design
n8n
stable-diffusion-local
wave-local
flux-local
roop-local
video-generation-smart-router
```

---

## Switching Profiles

Preview:

```bash
node tools/scripts/switch-skill-profile.mjs default --dry-run
```

Apply:

```bash
node tools/scripts/switch-skill-profile.mjs default --apply
```

Check active set against a profile:

```bash
node tools/scripts/switch-skill-profile.mjs default --check
```

After applying a profile, the script calls:

```bash
node tools/scripts/sync-ai-skills.mjs
node tools/scripts/sync-ai-skills.mjs --check
```

This keeps all AI/IDE consumers aligned with the new active surface.

---

## Safety Guarantees

The switcher script is intentionally conservative:

- It does not delete source skills.
- It does not rename source skills.
- It only changes `ai/skills/active/` symlinks.
- It refuses to remove real directories or real files from `ai/skills/active/`.
- It backs up the current active list before applying a profile.
- It can restore the original surface using `full-current.txt`.
- It resolves skill sources from existing active symlinks first, then searches `ai/skills/custom` and `ai/skills/vendors`.
- It fails if a profile references a skill that cannot be resolved.

---

## Natural Language Routing Standard

The default profile should keep high-level orchestrators active. Orchestrators must not assume that every subskill is active. Instead, they should use this pattern:

1. Interpret the user's natural-language request.
2. Route to the active high-level orchestrator.
3. Consult `docs/skills/skill-index.md` if a sub-capability is needed.
4. Load or activate the appropriate profile when deeper work is needed.
5. Never claim a dormant skill is unavailable merely because it is not in `ai/skills/active/`.

Example:

```text
User: "Make a video package for TikTok and YouTube."
Default route: capability discovery finds the video profile.
Profile skill: video
Dormant subskills: ffmpeg, viral-flow, stable-diffusion-local, wave-local
Action: load the video profile intentionally, then let the video orchestrator route to needed sub-capabilities.
```

---

## Orchestrator Rules

High-level orchestrators such as `video`, `design`, `code`, and deployment/research skills should remain stable by name.

Do not rename these without updating every reference:

- `video`
- `design`
- `code`
- `review`
- `qa`
- `handoff`
- `memory`

When a subskill is moved out of default active, update the orchestrator documentation so it says the subskill may be dormant and can be found through `docs/skills/skill-index.md` or activated through a profile.

---

## Recovery

To restore the original active surface:

```bash
node tools/scripts/switch-skill-profile.mjs full-current --apply
```

Then verify:

```bash
node tools/scripts/sync-ai-skills.mjs --check
```

---

## Recommended Default Policy

Keep the default profile small, currently about 7 skills:

- high-level orchestrators
- core review/QA/safety skills
- very common tools
- profile/index management skills

Move learned incident skills, vendor-specific tools, and domain-specific subskills into domain profiles unless they are used constantly.

For routine installs, the default answer is "source installed, dormant by
default, available through a domain profile." Add a skill to
`docs/skills/profiles/default.txt` only after an explicit always-on decision.

---

## What This Does Not Do

This does not implement automatic runtime skill loading inside Claude Code or Codex. Instead, it creates a safe repo-level profile system and a skill index. Agents can use natural language through active orchestrators and consult the index when deeper dormant skills are needed.

This also does not remove any historical skill. All source skills remain available.
