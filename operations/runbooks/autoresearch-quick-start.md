# Autoresearch Quick Start

This is the companion to the full strategy runbook. Use this to get started immediately.

---

## One-Minute Pitch

Autoresearch is an autonomous optimization loop. You define:
1. **Scope** — what one thing can change (a skill prompt, an endpoint, a workflow config)
2. **Metric** — how to measure improvement (test pass rate, latency, conversion rate)
3. **Time** — how long to iterate (overnight, 4 hours, etc)

Then autoresearch runs experiments autonomously. Each cycle: modify → measure → keep if better, discard if worse. You wake up to a git log of all experiments and an improved artifact.

---

## Domains You Can Optimize

| Domain | What | Metric | Time | Example |
|--------|------|--------|------|---------|
| **Skills** | Prompt clarity, trigger accuracy | User rating (1–5) or test pass % | 2–4 hours | `/autoresearch` skill: 3.8 → 4.6/5 |
| **Apps** | Latency, throughput, cost | Response time (ms), requests/sec | 30 min–2 hours | `/api/users`: 250ms → 120ms |
| **UI/UX** | Navigation speed, clarity, satisfaction | Task completion time (sec), user rating | 1–4 hours | Dashboard sidebar: 8.4s → 3.2s |
| **n8n** | Reliability, speed, cost | Success rate (%), execution time (sec) | 2–4 hours | Brain inbox: 92% → 99% success |
| **Marketing** | Click-through rate, conversion | CTR (%), conversion rate (%) | 4–8 hours overnight | Skill description: 3.2% → 7.8% CTR |
| **Business** | Revenue, churn, ARPU | ARPU ($), churn (%), upgrade rate (%) | Overnight | Pricing: $45 → $68 ARPU |

---

## How to Start

### Step 1: Pick a Target

Choose one thing you want to improve. Make sure it:
- Has a bounded scope (one file, one prompt, one workflow config)
- Has a clear metric (quantified, measurable)
- Would be worth optimizing (better UX, more revenue, faster, cheaper, etc)

### Step 2: Invoke `/autoresearch`

```
/autoresearch
```

I'll ask you:
1. What are you optimizing?
2. How do you measure success?
3. What's the time budget?

### Step 3: Define `program.md`

Together, we write a `program.md` file that documents:
- **Scope** — what can change
- **Metric** — primary success measure
- **Time budget** — per experiment and total
- **Constraints** — what's off-limits, what must stay stable

Example:

```markdown
# Optimization: API latency

## Scope
- Modify: src/handlers/users.ts (handler function only)
- Keep: database schema, API contract, input validation

## Metric
- Primary: p99_latency_ms (lower is better)
- Target: <100ms (baseline: 245ms)

## Time budget
- Per experiment: 30 sec
- Total: 1 hour (120 experiments)
```

### Step 4: Let It Run

I generate hypotheses, modify the scope, you measure the result, I decide keep/discard.

Each cycle takes 30 sec to 5 min (depending on domain). I iterate autonomously.

### Step 5: Review Results

When done, you get:
- **Git commit log** — every experiment (keeps and discards)
- **Winner** — the best-performing variant
- **Summary** — what worked, what didn't, the improvement

You review, decide whether to deploy.

---

## Domain-Specific Quickstart Templates

### Skills/Prompts

```markdown
# Optimization: [skill-name] prompt

## Scope
- Modify: brain/ai/skills/custom/[name]/SKILL.md (body only)

## Metric
- Primary: user_satisfaction_score (1–5, higher is better)
- Test: 5 test scenarios, average the ratings
- Baseline: 3.2/5
- Target: 4.5+/5

## Time
- Per experiment: 2 min
- Total: 2 hours
```

### App Performance

```markdown
# Optimization: [endpoint] latency

## Scope
- Modify: src/handlers/[file].ts (only the function)

## Metric
- Primary: p99_latency_ms (lower is better)
- Test: 1000 requests, measure p99
- Baseline: 245ms
- Target: <100ms

## Time
- Per experiment: 30 sec
- Total: 1 hour
```

### UI/UX

```markdown
# Optimization: [component] usability

## Scope
- Modify: src/components/[name].tsx (layout, styling, interaction)

## Metric
- Primary: task_completion_time_sec (lower is better)
- Test: 5 users, median time
- Baseline: 8.4 sec
- Target: <4 sec

## Time
- Per experiment: 3 min
- Total: overnight
```

### n8n Workflows

```markdown
# Optimization: [workflow] reliability

## Scope
- Modify: workflow config (node params, logic, error handling)

## Metric
- Primary: success_rate (%, higher is better)
- Test: 100 runs
- Baseline: 92%
- Target: 99%+

## Time
- Per experiment: 2 min
- Total: 4 hours
```

### Marketing Copy

```markdown
# Optimization: [copy section] CTR

## Scope
- Modify: [field] in [location]

## Metric
- Primary: click_through_rate (%, higher is better)
- Test: A/B with 200 users per variant
- Baseline: 3.2%
- Target: 8%+

## Time
- Per experiment: 1 hour
- Total: overnight
```

### Business Metrics

```markdown
# Optimization: [strategy] ARPU

## Scope
- Modify: config/[file].json (pricing, discounts, thresholds)

## Metric
- Primary: arpu ($/user/month, higher is better)
- Test: A/B with 1000 users
- Baseline: $45
- Target: $60+

## Time
- Per experiment: 4–8 hours
- Total: overnight
```

---

## Expected Results

**Skills:** 10–20% improvement (rating or accuracy)  
**Apps:** 30–50% improvement (latency, cost)  
**UI/UX:** 30% faster task completion  
**Workflows:** 5–10% reliability improvement  
**Marketing:** 2–3x CTR / conversion improvement  
**Business:** 20–50% ARPU growth or churn reduction  

(Results vary. Your baseline and constraints matter.)

---

## Before You Start

Make sure you have:
- [ ] One clear optimization target
- [ ] A measurable metric (quantified, testable)
- [ ] Boundaries on what can change
- [ ] Time to let it run (30 min to overnight)
- [ ] Confidence the metric won't mislead

If any of these is missing, read the full strategy runbook first:  
`brain/operations/runbooks/autoresearch-strategy.md`

---

## Go

```
/autoresearch
```

Pick a target. Define your metric. Let it improve overnight.

This is how winners are built.
