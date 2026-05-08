# Video Orchestrator — Lessons Learned from Industry Repos (Revised Context)

**Date:** 2026-05-08 (Revised with clarifications)  
**Source:** Analysis of DeerFlow, Arcads, MoneyPrinter, Wan2GP, Claude Code Video Toolkit  
**Purpose:** Extract best practices for local-first video production; clarify which principles apply to local generation vs. platform publishing

---

## Extracted Principles (Implementation Candidates)

### 1. Multi-Agent Parallelization (from DeerFlow)

**Principle:** Parallelize independent work when resources allow, but do not overload the Mac mini's 24 GB unified memory.

**Unsafe interpretation:**
```
Run SDXL + Wave + FLUX + Roop concurrently on every batch
  → memory pressure, thermal pressure, slowdowns, failures
```

**Better state (resource-aware parallelism):**
```
├─ CPU-light metadata/script jobs can run anytime
├─ Posting/analytics jobs run in a separate pool
├─ FFmpeg encodes run with limited parallelism after benchmarking
└─ Heavy model jobs (FLUX, LoRA-like, sometimes talking-head) are serialized by default
```

**Implementation:** Use resource classes and worker pools, not blind model parallelism.

**Benefit:** Better throughput without destabilizing the local machine.

**Where in Pipeline:** Workflow F (PIPELINE), Phase 2B queue, and the resource scheduler.

---

### 2. UGC / Product Photography Workflow (from Arcads)

**Principle:** "Product photo + talking head variant" is a standard workflow that should be documented and templated.

**Workflow Pattern:**
```
User: "Create e-commerce video for product X"
  ↓
[Generate product hero photo]
  └─ FLUX.1-dev (premium quality, schedule at night)
  ├─ Output: product.png (1920×1080)
  ↓
[Create talking head variant]
  └─ Wave (60–90s, consistent avatar)
  ├─ Input: avatar.png + narration.wav + background: product.png
  ├─ Output: talking_head.mp4 (talking head with product bg)
  ↓
[Compose into UGC video]
  └─ FFmpeg or Remotion
  ├─ Input: talking_head.mp4 + product.png + captions.srt
  ├─ Output: ugc_video.mp4 (vertical, TikTok/Instagram ready)
  ↓
[Package and publish]
  ├─ Generate upload-ready packages for TikTok, Instagram, and Shorts
  ├─ Publish only through authorized adapters when available
  └─ Otherwise use manual upload packages
```

**Implementation:** Add as Workflow C1f: "E-commerce Product Video" in `/video` skill.

**Benefit:** Standardizes high-value workflow; ensures consistency across executions.

---

### 3. Format Normalization (from MoneyPrinter)

**Principle:** Build a shared production source, then render or transform platform-specific variants without duplicating creative work.

**Current State (Format per Step):**
```
Compose for YouTube (1920×1080)
Compose for TikTok (1080×1920)
Compose for Instagram (1080×1080)
Compose for LinkedIn (1920×1080)
  └─ Redundant composition work
```

**Better State (Safe-Zone-Aware Normalization):**
```
Canonical timeline: script + audio + captions + assets + layout metadata
  ↓
Render variants with safe zones:
├─ YouTube / LinkedIn: 16:9
├─ TikTok / Shorts / Reels: 9:16
├─ Instagram / Facebook feed: 1:1
└─ Instagram preferred feed: 4:5
```

**Simple transform option:** For center-safe static content, a master render can be converted with FFmpeg crop/scale. Do not use this as the default for faces, text, products, or caption-heavy videos.

**Implementation:** Combine reusable templates, safe-zone metadata, FFmpeg transforms, and optionally Remotion for layout-heavy videos.

**Location:** Workflow C (COMPOSE) and Phase 2A package generation, before Workflow E publishing.

**Benefit:** Fewer redundant creative steps while preserving quality across aspect ratios.

---

### 4. Job Queue + Worker Architecture (from MoneyPrinter, Wan2GP)

**Principle:** Replace nightly scheduler batch with proper job queue + worker processes.

**Current State (Nightly Batch):**
```
03:00 AM → Run all jobs sequentially
           If crash at job 3/10 → Lost progress on 1–2
           No audit trail
           No resumability
```

**Better State (Job Queue + Workers):**
```
PostgreSQL Queue:
├─ Job 1: SDXL thumbnail (pending)
├─ Job 2: Wave talking head (running)
├─ Job 3: FLUX product photo (pending)
└─ Job 10: n8n post (pending)

Workers:
├─ Worker 1 (SDXL batch) → pulls job 1, 3, 5
├─ Worker 2 (Wave batch) → pulls job 2, 7
└─ Worker 3 (FLUX batch) → pulls job 8, 9

Benefits:
├─ Resume on crash: re-run failed job 3
├─ Audit trail: every job logged
├─ Parallel workers: faster throughput
└─ Scalable: add workers as needed
```

**Implementation:** PostgreSQL + Python worker processes (or n8n flows).

**Schema:**
```sql
CREATE TABLE generation_jobs (
  id UUID PRIMARY KEY,
  status ENUM (pending, running, complete, failed, skipped),
  model VARCHAR (sdxl, wave, flux, roop, compose, post),
  task_config JSONB,  -- model-specific params
  output_path VARCHAR,
  error_message TEXT,
  created_at TIMESTAMP,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  retry_count INT DEFAULT 0
);
```

**Location:** Replace `office-nightly-scheduler.sh` with job queue runner.

**Benefit:** Resumable, auditable, scalable batch processing.

---

### 5. Dynamic Composition with Remotion (from Claude Code Video Toolkit)

**Principle:** Use Remotion (React-based) for programmatic, dynamic video composition instead of just FFmpeg CLI.

**Current State (FFmpeg):**
```bash
ffmpeg -i background.png -i narration.wav \
  -vf "scale=1920:1080,fade=t=in:st=0:d=1" \
  -c:v libx264 -c:a aac output.mp4
```

**Better State (Remotion):**
```javascript
export const VideoComposition = ({ backgroundUrl, narrationUrl, title }) => (
  <Composition id="hero" component={HeroScene} />
);

const HeroScene = ({ backgroundUrl, narrationUrl, title }) => (
  <div style={styles.container}>
    <Background src={backgroundUrl} />
    <Title text={title} delay={0} duration={30} />
    <FadeOut from={90} to={100} />
    <Audio src={narrationUrl} />
  </div>
);
```

**Benefits:**
- React familiarity (composable components)
- Dynamic: props-driven composition
- Debuggable: React dev tools
- Testable: Jest unit tests
- Maintainable: version control for templates

**When to Use:**
- Complex layouts with multiple elements
- Reusable templates (title cards, intros, outros)
- A/B testing variations (change props, re-render)

**When NOT to Use:**
- Simple operations (single audio + image) → use FFmpeg
- Large batches (overhead) → use FFmpeg

**Implementation:** Optional composition layer in Workflow C1f (E-commerce video) and C3 (Complex compositions).

**Benefit:** Better DX for templated videos; more maintainable than scripts.

---

### 6. Persistent Lifecycle Tracking (from Claude Code Video Toolkit)

**Principle:** Track video state across the entire pipeline. Enable mid-pipeline resume and audit trail.

**State Machines:**
```text
video_state:
planned → scripted → voiced → assets_ready → captions_ready → composed → variants_ready → ready_to_post → partially_posted → posted → archived

job_state:
pending → leased → running → succeeded | failed | cancelled | dead

posting_state:
draft → scheduled → uploading → processing → published | failed | needs_manual
```

**Implementation:** Keep durable production state separate from execution jobs. Videos, packages, captions, renders, and posting targets are durable entities. Jobs only represent work execution and retries. Use posting idempotency keys to prevent duplicate uploads after worker retries.

**Location:** Workflow F (PIPELINE) → F1 (Preconditions).

**Benefit:** Mid-pipeline recovery; audit trail; transparent progress.

---

### 7. Screen Recording Integration (from Claude Code Video Toolkit)

**Principle:** Capture screen walkthroughs programmatically using Playwright + FFmpeg.

**Use Cases:**
- Software tutorials (how to configure X)
- Product demos (showing feature walkthrough)
- UI walkthroughs (step-by-step guide)

**Implementation Pattern:**
```javascript
// 1. Record screen with Playwright
const browser = await chromium.launch();
const context = await browser.newContext({ recordVideo: { dir: 'videos/' } });
const page = await context.newPage();

// 2. Automate clicks, waits, interactions
await page.goto('https://app.example.com/demo');
await page.click('button.start-demo');
await page.waitForTimeout(2000);
await page.click('button.next-step');

// 3. Output: video.webm

// 4. Convert to MP4 + add narration (FFmpeg + Wave)
// (existing pattern)
```

**Location:** Add Workflow C1d (Audio-first) sub-pattern for "Narrated screen walkthroughs".

**Benefit:** Automates demo content; enables tutorial video generation.

---

### 8. Brand/LoRA Customization (from Wan2GP)

**Principle:** Fine-tune models per brand for consistent, branded visuals.

**Advanced Use Cases:**
- Generate images in your exact brand style
- Create character-specific avatars (train on faces)
- Apply domain knowledge (e.g., architecture renders vs. product photos)

**Implementation:** (Phase 4+ research)
- Train FLUX.1-dev LoRA on 20–50 brand images
- Use trained model for all future generations
- Ensures visual consistency across library

**Location:** Phase 4+ documentation.

**Benefit:** Production-grade brand consistency.

---

### 9. Persistent Learning (from DeerFlow)

**Principle:** Learn from execution; remember what works.

**Examples:**
```
Learning: "YouTube Shorts uploads at 9 AM get 2x CTR vs 3 PM"
  → Future action: Always schedule YouTube Shorts for 9 AM

Learning: "FLUX product photos convert better than SDXL on TikTok"
  → Future action: Always use FLUX for product videos on TikTok

Learning: "Avatar character X gets 3x engagement on Instagram"
  → Future action: Prioritize character X for Instagram posts
```

**Implementation:** (Phase 3+ enhancement)
```sql
CREATE TABLE performance_metrics (
  video_id UUID,
  platform VARCHAR,
  posted_at TIMESTAMP,
  views INT,
  engagement_rate FLOAT,
  estimated_roi FLOAT
);

-- Query: Which video style performs best per platform?
SELECT style, platform, AVG(engagement_rate) FROM performance_metrics
GROUP BY style, platform ORDER BY AVG(engagement_rate) DESC;
```

**Location:** Phase 3+ analytics dashboard.

**Benefit:** Data-driven optimization; continuous improvement.

---

## Architecture Principles (Distilled)

### **Principle 1: Parallelization**
Run independent tasks concurrently. Especially for batching at night.

### **Principle 2: Normalization**
Generate once → convert to multiple formats. Don't re-render per platform.

### **Principle 3: Job Queue**
Replace scheduler scripts with proper job queue. Enable audit, resume, scale.

### **Principle 4: Lifecycle Tracking**
Every video has a state. Track it end-to-end. Enable mid-pipeline resume.

### **Principle 5: Composition Choice**
Use Remotion for complex, templated videos. Use FFmpeg for simple compositions.

### **Principle 6: Automation Breadth**
Support screen recording, TTS, image gen, video gen, posting. Full pipeline.

### **Principle 7: Learning Loop**
Track what works. Optimize future batches based on performance data.

### **Principle 8: Customization**
Support LoRA fine-tuning for brand consistency (future).

---

## Anti-Patterns to Avoid

❌ **Don't:** Use cloud APIs for generation (violates constraints)  
❌ **Don't:** Generate per-platform (use normalization instead)  
❌ **Don't:** Run batches sequentially (parallelize instead)  
❌ **Don't:** Have no state tracking (use job queue)  
❌ **Don't:** Mix FFmpeg with Remotion haphazardly (choose per use case)  
❌ **Don't:** Hardcode platform logic (keep platform-agnostic)  
❌ **Don't:** Ignore performance data (track metrics)

---

## Summary: What We're Adopting (Revised Scope)

**LOCAL PRODUCTION (Phases 2–4):**

| From | Principle | Phase | Scope |
|------|-----------|-------|-------|
| DeerFlow | Parallel agents | Phase 3 | Smart scheduling (don't overload 24GB) |
| Arcads | UGC workflow | Phase 2A | Template for product + talking-head |
| MoneyPrinter | Format normalization | Phase 2A–2B | Master → multiple safe-zone variants |
| MoneyPrinter | Job queue | Phase 2B | PostgreSQL + worker, local resumability |
| Toolkit | Lifecycle tracking | Phase 2B | State machine for mid-pipeline resume |
| Toolkit | Screen recording | Phase 2A | Playwright (optional, for tutorials) |

**PUBLISHING (Phase 3+, Authorization-Dependent):**

| From | Principle | Phase | Scope | Dependency |
|------|-----------|-------|-------|------------|
| n8n | Workflow automation | Phase 3 | Optional adapter wrapper | User configures n8n |
| Toolkit | Distributed posting | Phase 4 | Multi-account scheduler | User provides credentials |
| DeerFlow | Learning loop | Phase 5 | Local metrics + recommendations | User collects snapshots |

**NOT ADOPTING (Out of Scope):**

| From | Why Not |
|------|---------|
| DeerFlow full framework | Too complex; extract patterns only |
| Wan2GP server | Not needed; Mac mini sufficient for target throughput |
| Toolkit cloud APIs | FLUX.2, LTX-2, ElevenLabs (use local alternatives) |
| Arcads platform | Paid; violates local-first constraint |

---

## What We're NOT Adopting

❌ **DeerFlow full framework** — Too complex; extract patterns only  
❌ **Arcads platform** — Paid APIs (violates constraints)  
❌ **MoneyPrinter tool** — YouTube-only; we need multi-platform  
❌ **Wan2GP server** — Requires NVIDIA GPU (we have Mac mini)  
❌ **Toolkit cloud APIs** — FLUX.2, LTX-2, ElevenLabs (use local alternatives)

---

## Next: Holistic Review

With these principles, we now review the Video Orchestrator for:
- Platform agnosticity
- File format agnosticity  
- Account agnosticity
- Vertical and horizontal scalability
