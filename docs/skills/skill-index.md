# Skill Index

**Purpose:** Help agents find dormant skills without keeping every skill active by default.

This index preserves existing skill names. It does not rename, delete, or merge source skills.

---

## Core Always-On Orchestrators

| Skill | Role | Default Active | Notes |
|---|---|---:|---|
| `code` | General code work and repo implementation | Yes | Main engineering entry point |
| `design` | High-level design orchestration | Yes | Routes to dormant design subskills when needed |
| `video` | High-level video production orchestration | Yes | Routes to video production subskills and package workflows |
| `research` | High-level research orchestration | Yes | Routes to web, Bible research, source synthesis, and durable research notes |
| `memory` | Memory and long-term context | Yes | Core context capability |
| `review` | Review and critique | Yes | General review entry point |
| `qa` | Quality assurance | Yes | General validation entry point |
| `handoff` | Handoff prompts and cross-agent work | Yes | Useful across Claude Code, Codex, Gemini |
| `careful` | Caution and high-risk work guardrails | Yes | Default safety skill |
| `guard` | Guardrails and safety checks | Yes | Default safety skill |

---

## Default Profile

Use for ordinary work and natural-language routing.

Path:

```text
docs/skills/profiles/default.txt
```

Target size: about 20 active skills.

Includes:

```text
code, design, video, research, memory, review, qa, handoff, careful,
gh, firecrawl, playwright, ffmpeg, n8n, autoresearch
```

If a listed skill source does not exist yet, the switcher will fail rather than silently skipping it.

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
| `autoresearch` | Automated research workflows |
| `firecrawl` | Web scraping/crawling |
| `media-acquisition` | Dormant yt-dlp capability for video/audio source metadata, subtitles, transcripts, thumbnails, and permitted media acquisition |
| `apify` | Apify actors and scraping |
| `notebooklm.md` | NotebookLM workflow notes |
| `playwright` | Browser automation notes |
| `web` | Web workflows |
| `gemini` | Large-context preprocessing |
| `graphify` | Structured visualization |
| `memory` | Persist findings |
| `review` | Critique research outputs |

Related architecture:

```text
operations/runbooks/research-repo-google-drive-architecture.md
operations/runbooks/media-acquisition-yt-dlp.md
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

1. Use the active orchestrator if one matches the intent.
2. If the needed subskill is not active, consult this index.
3. Recommend switching to the relevant profile, or use the dormant source documentation directly if the environment allows reading it.
4. Do not claim the skill is gone.

---

## No-Loss Guarantee

This profile system does not remove source skills. It only controls which skill symlinks are exported through `ai/skills/active/`.

A dormant skill is still available in its source location and can be restored to active through a profile.
