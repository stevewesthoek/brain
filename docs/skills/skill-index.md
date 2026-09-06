# Skill Index

**Purpose:** Help agents find dormant skills without keeping every skill active by default.

This index preserves existing skill names. It does not rename, delete, or merge source skills.

---

## Core Orchestrators and Routed Skills

| Skill | Role | Default Active | Profile | Notes |
|---|---|---:|---|---|
| `code` | General code work and repo implementation | Yes | default | Main engineering entry point |
| `research` | High-level research orchestration | Yes | default | Routes to web, Bible research, source synthesis, and durable research notes |
| `memory` | Memory and long-term context | Yes | default | Core context capability |
| `review` | Review and critique | Yes | default | General review entry point |
| `qa` | Quality assurance | Yes | default | General validation entry point |
| `handoff` | Handoff prompts and cross-agent work | Yes | default | Useful across Claude Code, Codex, Gemini |
| `careful` | Caution and high-risk work guardrails | Yes | default | Default safety skill |
| `capability-discovery` | Natural-language lookup for skills, CLIs, MCP servers, and runbooks | Yes | default | Shared read-only discovery entry point; users never need internal names |
| `design` | High-level design orchestration | No | design, power | Routes to dormant design subskills when needed |
| `video` | High-level video production orchestration | No | video, power | Routes to video production subskills and package workflows |
| `guard` | Guardrails and safety checks | No | design, power | Extended safety checks for specific domains |
| `gh` | GitHub CLI operations | No | deploy, power | GitHub issue/PR/workflow management |
| `firecrawl` | Web scraping and research acquisition | No | research, power | Research data scraping and web automation |
| `playwright` | Browser automation and testing | No | research, power | Web testing and complex automation |
| `ffmpeg` | Audio/video encoding and composition | No | video, power | Media format conversion and mixing |
| `n8n` | Workflow automation platform | No | deploy, power | Workflow orchestration and integration |
| `autoresearch` | Autonomous research workflows | No | research, power | Automated research iteration and optimization |
| `greploop` | Bounded review-fix-review loop for code quality gates | No | code-orchestrator | Dormant subskill used automatically by `code` when review findings should be fixed until clean; do not add to default active profile |
| `spark` | Spark email/calendar/contact CLI | No | productivity, power | Mailbox, calendar, contacts, meetings, scheduling; personal-data sensitive, not default-active |
| `stripe` | Stripe CLI for billing and payment operations | No | power | Natural-language billing route; uses `stripe` through shared PATH and the Stripe CLI runbook |

---

## Default Profile

Use for ordinary work and natural-language routing.

Path:

```text
docs/skills/profiles/default.txt
```

Target size: about 8 active skills (minimal, truly always-on).

**Philosophy:** Default includes only core orchestrators, session continuity, review/QA, memory, safety, and the compact capability-discovery entry point. Heavy domain orchestrators (`design`, `video`) and tool skills (`gh`, `firecrawl`, `playwright`, `ffmpeg`, `n8n`, `autoresearch`) remain dormant to reduce skill context pressure on Codex. They are found through query-time discovery and source documentation.

Includes:

```text
code, research, memory, review, qa, handoff, careful, capability-discovery
```

Newly installed skills do not belong here by default. Add them to the most
specific domain profile first. Promote a skill into `default.txt` only after an
explicit always-on decision, because every default skill consumes context in
Claude, Codex, Gemini, and IDE sessions.

When a user requests a domain capability, `capability-discovery` runs the
shared read-only registry query. The agent then reads the selected source
skill/runbook and uses the available CLI or MCP surface. Profile activation is
an internal optimization, not a user requirement.

If a listed skill source does not exist yet, the switcher will fail rather than silently skipping it.

## Codex Root Skills

Codex scans the live, machine-local `~/.codex/skills/` directory directly. That
root is not a profile. To keep the default profile effective, it must contain
only:

```text
.system
user
```

`user` is a managed symlink to `ai/skills/active`; `.system` is Codex-owned
machine state. Other top-level skill directories bypass
`docs/skills/profiles/default.txt` and become active in every Codex session.
Codex-only dormant skills are archived under
`operations/system-configs/codex/skills-dormant/` until explicitly promoted or
moved into the shared `ai/skills/` profile system.

---

## Power Profile

Use for general power-user sessions where skill context budget warnings are acceptable.

Path:

```text
docs/skills/profiles/power.txt
```

This is the previous broader "default" set: all core orchestrators + heavy tool skills. Use this profile when you need to work across design, video, research-acquisition, and DevOps simultaneously, and don't mind the context pressure warning.

Includes:

```text
code, design, video, research, memory, review, qa, handoff, careful,
gh, firecrawl, playwright, ffmpeg, n8n, autoresearch
```

---

## Productivity Profile

Path:

```text
docs/skills/profiles/productivity.txt
```

Use when working with email, calendar, contacts, meetings, scheduling, or Spark mailbox data.

Key skills:

| Skill | Use |
|---|---|
| `spark` | Spark CLI for email, calendar, contacts, meetings, availability, and scheduling |
| `memory` | Remember communication preferences and follow-up context |
| `review` | Review drafted replies and scheduling decisions |
| `handoff` | Prepare handoff prompts or summaries for another agent |
| `careful` | Personal-data and credential-boundary guardrails |

Important: `spark` is a real source skill at `ai/skills/custom/spark/SKILL.md`. It is intentionally dormant in the default profile because it is large and personal-data sensitive. It is preserved in the `productivity` and `power` profiles.

---

## Video Profile

Path:

```text
docs/skills/profiles/video.txt
```

Use when doing video production, local AI media generation, captions, package generation, or publishing-adapter work.

Key skills:

| Skill | Use |
|---|---|
| `video` | Main orchestrator |
| `viral-flow` | Strategy, topics, angles, hooks, scripts |
| `media-acquisition` | Dormant yt-dlp capability for online video/audio metadata, subtitles, transcripts, thumbnails, and permitted media acquisition |
| `watch-video` | Provider-neutral multimodal video analysis with bounded frames, captions/explicit Whisper fallback, and local reports |
| `ffmpeg` | Encoding, captions, format transforms |
| `stb-pipeline` | Narrated slideshow / TTS pipeline patterns |
| `design` | Thumbnails and visual polish |
| `n8n` | Optional workflow adapter wrapper |
| `stable-diffusion-local` | Fast local image generation |
| `wave-local` | Talking-head generation |
| `flux-local` | Premium image generation |
| `roop-local` | Avatar/face consistency where permitted |
| `video-generation-smart-router` | Local media model routing |
| `mlx-pipeline-memory-safety` | Mac local model memory guardrails |
| `meta-*` learned skills | Meta app review/OAuth gotchas |

Important: `video` must not assume all subskills are active in the default profile. It should refer to this index and the video profile when deeper execution is needed.

---

## Design Profile

Path:

```text
docs/skills/profiles/design.txt
```

Use for web design, brand systems, frontend polish, UI/UX review, and visual taste review.

Key skills:

| Skill | Use |
|---|---|
| `design` | Main design orchestrator |
| `design-system` | Persistent design systems and brand specs |
| `web-design` | Web/SaaS implementation-ready design specs |
| `awesome-design-md` | Public-brand DESIGN.md reference library for style candidates, token cues, and reference-brand inspiration |
| `design-review` | Design critique |
| `design-motion-principles` | Motion/animation review |
| `taste-skill` | Premium taste and anti-slop checks |
| `redesign-skill` | Existing-project redesign |
| `huashu-design` | HTML-native visual artifacts |
| `impeccable` | Tactical frontend polish |
| `ui-ux-pro-max` | UI/UX intelligence |
| `dembrandt` | Visual/brand support |
| `media-acquisition` | Dormant yt-dlp capability for permitted video/motion reference acquisition, thumbnails, subtitles, and metadata |
| `graphify` | Visual graphing/diagram support |

Design architecture: `design` is the orchestrator. The other design-profile skills are subskills with specific functions. `web-design` produces implementation-ready web, SaaS, dashboard, landing page, funnel, and marketing-site specs.

---

## Deploy Profile

Path:

```text
docs/skills/profiles/deploy.txt
```

Use for deployment, hosting, infrastructure, CI/CD, Docker, cloud, and Dokploy work.

Key skills:

| Skill | Use |
|---|---|
| `deploy` | General deployment orchestration if present |
| `setup-deploy` | Deploy setup patterns |
| `land-and-deploy` | Landing and deployment flow |
| `ship` | Shipping workflow |
| `dokploy` | Dokploy operations |
| `dokploy-*` | Specific Dokploy gotchas |
| `docker-*` | Docker gotchas |
| `cloudflare` | Cloudflare work |
| `hetzner` | Hetzner hosting |
| `aws` / `azure` | Cloud provider tasks |
| `supabase` | Supabase tasks |
| `tailscale` | Tailscale networking |
| `orbstack` | Local container runtime |
| `gh` | GitHub CLI |
| `forge` | Forge workflows |
| `nextjs-*` | Next.js deployment gotchas |

---

## Research Profile

Path:

```text
docs/skills/profiles/research.txt
```

Use for web research, scraping, source synthesis, browser automation, large-context preprocessing, and domain-specific research.

Key skills:

| Skill | Use |
|---|---|
| `research` | General research orchestrator; source: `ai/skills/custom/research/SKILL.md`; runbook: `operations/runbooks/research-orchestrator.md` |
| `bible-research` | Specialist Scripture/theology research; source: `ai/skills/custom/bible-research/SKILL.md`; runbook: `operations/runbooks/bible-research.md` |
| `scripture-sources` | Dormant Bible text/source retrieval layer for API.Bible, verse lookup, translation comparison, Greek/Hebrew, Strong's-style data, and Bible proof maps; source: `ai/skills/custom/scripture-sources/SKILL.md`; runbook: `operations/runbooks/scripture-source-stack.md` |
| `autoresearch` | Automated research workflows |
| `firecrawl` | Web scraping/crawling |
| `media-acquisition` | Dormant yt-dlp capability for video/audio source metadata, subtitles, transcripts, thumbnails, and permitted media acquisition |
| `watch-video` | Provider-neutral multimodal video analysis; source: `ai/skills/custom/watch-video/SKILL.md`; runbook: `operations/runbooks/watch-video.md` |
| `apify` | Apify actors and scraping |
| `notebooklm` | NotebookLM CLI workflows; source: `ai/skills/custom/notebooklm/SKILL.md`; runbook: `operations/runbooks/notebooklm.md` |
| `playwright` | Browser automation notes |
| `web` | Web workflows |
| `gemini` | Large-context preprocessing |
| `graphify` | Structured visualization |
| `memory` | Persist findings |
| `review` | Critique research outputs |

Related architecture:

```text
operations/runbooks/skill-profile-onboarding.md
operations/runbooks/research-repo-google-drive-architecture.md
operations/runbooks/media-acquisition-yt-dlp.md
operations/runbooks/scripture-source-stack.md
operations/standards/human-writing-guardrails.md
operations/runbooks/human-writing-guardrails-adoption.md
```

Human-writing guardrails are a shared final-stage standard, not a separate always-on humanizer skill. Use them for final human-facing research, apologetics, Bible stories, marketing copy, and video scripts only after the relevant domain checks are complete.

Do not add `bible-research` to the default profile unless it becomes a frequent always-on skill. `research` is intentionally in the default profile; `bible-research` is intentionally limited to the research profile to avoid bloating the always-on surface.

---

## Recovery Profile

Path:

```text
docs/skills/profiles/full-current.txt
```

This is the observed 119-skill active set from 2026-05-08. Use it to recover the prior behavior:

```bash
node tools/scripts/switch-skill-profile.mjs full-current --apply
```

---

## Natural-Language Routing Rule

Agents should not force the user to remember commands.

When a user asks in natural language:

1. Use the active `capability-discovery` entry point for any request that may use tooling.
2. Query `tools/discover-capabilities.mjs` against the natural-language request.
3. Read the selected source skill/runbook and check actual CLI/MCP availability.
4. Do not ask the user to name or activate a profile, and do not claim a dormant skill is gone.

The discovery script scans all `SKILL.md` sources, profile aliases, CLI manifest
entries, MCP admissions, and client configuration names at query time. This is
the complete source inventory; this index remains the compact human routing
map.

---

## No-Loss Guarantee

This profile system does not remove source skills. It only controls which skill symlinks are exported through `ai/skills/active/`.

A dormant skill is still available in its source location and can be restored to active through a profile.
