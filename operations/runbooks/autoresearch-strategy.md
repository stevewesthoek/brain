# Autoresearch Strategy

## Philosophy

**Everything measurable is improvable.**

Your business, your apps, your skills, your workflows—all are candidate optimization targets if you can define:
1. What can change (scope)
2. How to measure improvement (metric)
3. How long to let it iterate (time budget)

Autoresearch is the strategic framework for continuous autonomous improvement across all domains.

---

## The Pattern

**Karpathy autoresearch** is a lightweight framework that lets an AI agent iterate autonomously on a bounded optimization target. The core loop:

1. **Scope** — define one file (or config, or component) that can be modified
2. **Metric** — define how to measure success (lower/higher is better, quantified)
3. **Experiment** — agent modifies scope → you measure → keep if improved, discard if worse
4. **Loop** — repeat until time budget exhausted or metric plateaus
5. **Result** — git commit history of all experiments; you review and deploy the winner

**Time budget** — fix the time per experiment (5 min, 30 sec, 1 hour) and total budget (overnight, 4 hours). This lets you run 12–100+ experiments before you wake up.

---

## Why This Works

**Cost-optimal iteration:**
- Each experiment is cheap (Haiku running tight loops, no human overhead)
- Failed experiments are discarded (git reset)
- Only winners survive (committed to history)
- You review once, not 100 times

**Measurable progress:**
- Every experiment has a quantified metric
- You can track improvement over time
- You can set realistic targets
- You can know when to stop

**Low risk:**
- Single-file scope keeps changes reviewable
- Bounded scope means no unintended side effects
- Failed experiments leave no trace
- You review before deploying

---

## Domain Catalog

### 1. Skills & Prompts

**What:** Optimize a SKILL.md prompt in brain/ai/skills/

**Why:** A skill that triggers more accurately, provides better guidance, or handles edge cases better is more useful to Claude and the team.

**Scope:** The prompt body only (not metadata or frontmatter)

**Metrics:**
- Test case pass rate (0–100%, higher is better)
- User rating (1–5 stars, higher is better)
- False positive rate (%, lower is better)
- Response clarity score (subjective, 1–10, higher is better)

**Baseline:** Current skill working but sub-optimal. Target: 4.5+/5 user rating or 95%+ test pass rate.

**Time per experiment:** 2–3 minutes (quick test + rating)

**Example:**
- Current `/autoresearch` skill scores 3.8/5 on user ratings
- Run overnight experiments: 40 prompt variations
- Winner: 4.6/5 (clearer language, better examples)
- Commit and deploy

---

### 2. App Performance

**What:** Optimize an endpoint, function, algorithm, or database query

**Why:** Faster responses = better UX, lower infrastructure cost, higher throughput

**Scope:** One function or one query (not schema changes, not API contract)

**Metrics:**
- Response latency (ms, lower is better)
- Throughput (req/sec, higher is better)
- Memory usage (MB, lower is better)
- Error rate (%, lower is better)
- Cost per request (USD, lower is better)

**Baseline:** Current performance. Target: 30–50% improvement (e.g., 250ms → <150ms)

**Time per experiment:** 10–60 sec (benchmark run)

**Constraints:**
- Must not increase memory significantly
- Must maintain backward compatibility
- Must not degrade error handling

**Example:**
- Current `/api/dashboard` endpoint: 850ms p95 latency
- Run 4-hour autoresearch: 480 variations
- Winner: 320ms p95 (better caching, fewer DB queries, parallelized)
- Deploy with A/B test

---

### 3. UI/UX

**What:** Optimize component code, styling, interaction, layout

**Why:** Clearer UI = faster task completion, happier users, better engagement

**Scope:** One component or CSS module (not data schema, not accessibility spec)

**Metrics:**
- Task completion time (sec, lower is better)
- User satisfaction (1–5, higher is better)
- Click accuracy (%, higher is better)
- Engagement time (sec, higher is better)

**Baseline:** Current design works but is slow/confusing. Target: 30% faster task completion or 4.5+/5 satisfaction

**Time per experiment:** 3–5 min (user test + rating)

**Example:**
- Current dashboard sidebar takes 8.4 sec median to navigate to settings
- Run overnight: 30 UI variations
- Winner: 3.2 sec (reorganized hierarchy, clearer labels, faster targeting)
- Deploy and measure in production

---

### 4. n8n Workflows

**What:** Optimize workflow node configuration, error handling, logic flow

**Why:** More reliable workflows = fewer manual interventions, better data quality, lower cost

**Scope:** Workflow config (node params, logic, error handlers) — not data schema or API contracts

**Metrics:**
- Success rate (%, higher is better)
- Execution time (sec, lower is better)
- Error rate (%, lower is better)
- Cost per execution (USD, lower is better)

**Baseline:** Current workflow works but is flaky or slow. Target: 99%+ success rate, <2 sec execution

**Time per experiment:** 2–3 min (run 100 test iterations, collect metrics)

**Example:**
- brain-inbox workflow: 92% success, occasional duplicates
- Run autoresearch: 60 workflow variations
- Winner: 99.1% success (better retry logic, idempotency checks, timeout handling)
- Deploy to production

---

### 5. Marketing & Copy

**What:** Optimize skill descriptions, call-to-action text, landing page copy, email subject lines

**Why:** Better copy = higher CTR, better engagement, more conversions

**Scope:** One section of copy (not product changes)

**Metrics:**
- Click-through rate (%, higher is better)
- Conversion rate (%, higher is better)
- Open rate (emails, %, higher is better)
- Engagement time (sec, higher is better)
- Cost per acquisition (USD, lower is better)

**Baseline:** Current copy converts at 2–3%. Target: 5–8% (2–3x improvement)

**Time per experiment:** 1–2 hours (A/B test with sample users)

**Example:**
- `/autoresearch` skill description: 3.2% CTR
- Run autoresearch: 12 variants tested overnight
- Winner: 7.8% CTR ("optimize any system" vs "improve your code")
- Deploy updated skill descriptions

---

### 6. Business Metrics & Finances

**What:** Optimize pricing tiers, discounts, trial length, churn levers, notification timing

**Why:** Better positioning = higher ARPU, lower churn, better margins

**Scope:** Configuration and logic (not product features, not billing system)

**Metrics:**
- Revenue per user (USD/month, higher is better)
- Churn rate (%, lower is better)
- Upgrade conversion (%, higher is better)
- Cost per acquisition (USD, lower is better)
- Retention at 30 days (%, higher is better)

**Baseline:** Current pricing/strategy. Target: 20–40% revenue growth or 5% churn reduction

**Time per experiment:** 4–8 hours (A/B test with real cohorts)

**Example:**
- Current pricing: $29/$99/$299 tiers → $45/user/month ARPU
- Run autoresearch: 8 pricing strategies tested over 4 days
- Winner: $29/$149/$499 tiers → $68/user/month ARPU (+51%), churn +2%
- Deploy new pricing with monitoring

---

## How to Set Up a New Optimization Target

1. **Identify the target** — what do you want to improve?
2. **Define scope** — what ONE thing can change?
3. **Define metric** — how do you measure success?
4. **Set time budget** — how long per experiment, how many experiments total?
5. **Write program.md** — document the above
6. **Invoke `/autoresearch`** — trigger the skill
7. **Review results** — git log of all experiments
8. **Deploy winner** — commit, test, monitor

---

## Integration with Brain's Systems

### Model routing

- **Haiku** — the default, runs all experiments (tight, cheap loop)
- **Gemini Flash** — preprocesses large logs or diffs from experiments (free)
- **Codex (low)** — reviews final diff before you commit (second opinion)
- **Opus** — only if the optimization is very complex (rare)

### Decision making

- **Metric is objective** — "did it improve?" is answerable by measurement, not debate
- **Keep/discard is mechanical** — if metric improves, keep; else discard
- **Human decides "good enough"** — you set the target, the loop hits it

### Logging

- **Experiment log** — git commit history (each modification is a commit)
- **Decision log** — major optimization wins recorded in `brain/operations/decision-log.md`
- **Runbook** — this document + skill-specific templates

---

## When NOT to Use Autoresearch

- **Unmeasured goals** — "make it better" with no metric is not autoresearch
- **High-stakes decisions** — auth, security, production data: review manually
- **Unbounded scope** — entire codebase or system redesign; too large
- **Unreliable metrics** — noisy or expensive-to-measure targets
- **One-off tweaks** — just do them directly, don't automate
- **Architectural changes** — use `/plan` instead

---

## Results to Expect

After running autoresearch on a target:

- **Skills:** 10–20% better user ratings or trigger accuracy
- **App performance:** 30–50% latency reduction or cost savings
- **UI/UX:** 30% faster task completion or 1–2 point satisfaction gain
- **Workflows:** 5–10% success rate improvement, reduced manual work
- **Marketing:** 2–3x CTR or conversion improvement
- **Business metrics:** 20–50% ARPU growth or 3–5% churn reduction

**But:** Results vary. If your metric is already near-optimal or your scope is too constrained, improvements will be smaller. Set realistic targets.

---

## Getting Started

1. Pick a bounded optimization target (start small: one skill, one endpoint, one workflow)
2. Define your metric clearly (quantified, measurable)
3. Invoke `/autoresearch` and describe what you want to improve
4. I'll help you set up `program.md`
5. Let it run overnight
6. Review the git log and decide what to deploy

---

## Philosophy

Autoresearch embodies the principle that **anything measurable is improvable, and anything improvable should be improved continuously and autonomously**.

Your business, your apps, your skills—none of them are static. They're all candidate optimization targets. When you can measure something, you can improve it. When you can improve it, you should.

This is how winners are built.

---

## Status

**Installed:** 2026-04-10  
**Skill:** `/autoresearch` (available in Claude Code)  
**Runbook:** This document  
**Ready to optimize:** anything with a metric and a scope
