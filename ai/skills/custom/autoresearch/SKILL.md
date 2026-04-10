---
name: autoresearch
description: Use when optimizing any bounded system — skills, apps, UI, workflows, marketing, business metrics. Autonomous loop: define scope + metric → iterate → keep improvements. Works for anything measurable.
---

# /autoresearch — Autonomous Optimization

Autonomous optimization loop for any bounded, measurable system. Define what can change, define how to measure success, run experiments autonomously overnight.

## Philosophy

Everything is improvable if you can measure it. The autoresearch pattern:

1. **Scope**: Define what the agent can modify (one file, one prompt, one workflow)
2. **Metric**: Define how to measure success (lower/higher is better, quantified)
3. **Loop**: Modify → measure → keep if improved, discard if worse → repeat
4. **Time budget**: Fixed runtime per experiment (5 min, 1 hour, overnight)

The result: wake up to a log of experiments and improvements in your codebase.

## When to use

Use autoresearch when:
- You have a bounded component to optimize (skill prompt, app endpoint, UI code, workflow config)
- You can measure improvement (test pass rate, latency, success rate, conversion rate, cost)
- You want autonomous iteration (let it run overnight, review in the morning)
- The improvement is worth the compute time

Do NOT use autoresearch for:
- Unquantified goals ("make it better" with no metric)
- Unbounded scope (entire codebase, multiple files, system design)
- High-stakes decisions (auth, security, production database changes)
- One-off manual tweaks (just do them directly)

## How it works

### Setup

You define a `program.md` file (essentially a skill for the optimization agent):

```markdown
# Optimization Target: [what we're improving]

## Scope
- Only modify: [file(s) or config that can change]
- Off-limits: [what's fixed, what breaks if changed]

## Metric
- Primary: [what we measure]
- Success: [direction — lower is better OR higher is better]
- Baseline: [current value]
- Target: [what would be a win]

## Time budget
- Per experiment: [5 min, 1 hour, etc]
- Total: [overnight, 12 hours, etc]

## Constraints
- Architecture: [what can't change]
- Dependencies: [what must remain stable]
- Testing: [how we validate]

## Success looks like
[Worked examples of what an improvement would be]
```

### The loop

1. I read `program.md` and understand the optimization target
2. I generate a hypothesis for an improvement
3. I modify the bounded scope (the one file, the one prompt, the one workflow)
4. You measure the result (run tests, deploy, measure latency, check success rate)
5. Decision: **Keep** if metric improved (commit), **Discard** if worse (git reset)
6. Repeat from step 2

### Output

You get:
- A git commit history of all experiments (keeps and discards)
- A summary log of what worked and what didn't
- The improved artifact (file, prompt, config)
- One morning to review instead of nights spent tweaking

---

## Domain catalog

### 1. Skills & Prompts

**What to optimize:** A skill's SKILL.md or prompt in brain/ai/skills/

**Scope:** The prompt/instructions only. Off-limits: the framework, the metadata, the invocation.

**Metric examples:**
- Test cases passing (0–100%, higher is better)
- Response quality score (1–5 stars rated by user, higher is better)
- Trigger false positives (count, lower is better)

**program.md template:**

```markdown
# Optimization: [skill-name] prompt quality

## Scope
- Modify: brain/ai/skills/custom/[skill-name]/SKILL.md (body only, not frontmatter)
- Keep stable: SKILL.md frontmatter, trigger description

## Metric
- Primary: user_satisfaction_score (1–5, higher is better)
- Test: run 5 test scenarios, average the ratings
- Baseline: 3.2/5
- Target: 4.5+/5

## Time budget
- Per experiment: 2 min (quick test)
- Total: 2 hours (60 experiments)

## Success looks like
- Clearer instructions
- Better examples
- Edge cases handled
- Fewer ambiguities in the prompt body
```

**How to invoke:**

```
/autoresearch

You: I want to optimize my [skill-name] skill. It's not triggering correctly. Can we run autoresearch to improve it?

I respond: Let's set up a program.md for this. I'll need:
1. How do we measure if it's better? (trigger accuracy, user ratings, etc.)
2. What metric should I track?
3. How long should each experiment run?

You provide answers → I run the loop overnight.
```

---

### 2. App Performance

**What to optimize:** Endpoint code, algorithm, database query, caching strategy

**Scope:** One function, one file, one query

**Metric examples:**
- Response latency (ms, lower is better)
- Throughput (requests/sec, higher is better)
- Memory usage (MB, lower is better)
- Error rate (%, lower is better)

**program.md template:**

```markdown
# Optimization: /api/users endpoint latency

## Scope
- Modify: src/handlers/users.ts (only the handler function)
- Keep stable: database schema, API contract, input validation

## Metric
- Primary: p99_latency_ms (lower is better)
- Test: benchmark with 1000 requests, measure p99
- Baseline: 245ms
- Target: <100ms

## Time budget
- Per experiment: 30 sec (run benchmark)
- Total: 1 hour (120 experiments)

## Constraints
- Must not increase memory beyond 512MB
- Must maintain backward compatibility
- Error rate must stay <0.1%

## Success looks like
- Fewer database queries
- Better caching
- Algorithmic improvements
- Parallelization where possible
```

---

### 3. UI/UX

**What to optimize:** Component code, styling, interaction logic, layout

**Scope:** One component file or CSS

**Metric examples:**
- Usability test score (1–10, higher is better)
- Task completion time (sec, lower is better)
- Click accuracy (%, higher is better)
- User satisfaction (1–5, higher is better)

**program.md template:**

```markdown
# Optimization: Dashboard sidebar navigation

## Scope
- Modify: src/components/Sidebar.tsx (layout, styling, interaction)
- Keep stable: API contract, data structure, accessibility compliance

## Metric
- Primary: user_task_completion_time_sec (lower is better)
- Test: 5 users complete "navigate to settings" task, measure median time
- Baseline: 8.4 sec
- Target: <4 sec

## Success looks like
- Clearer visual hierarchy
- Better information architecture
- Faster navigation
- Reduced cognitive load
```

---

### 4. n8n Workflows

**What to optimize:** Workflow nodes, logic, configurations, error handling

**Scope:** One workflow or one set of nodes

**Metric examples:**
- Success rate (%, higher is better)
- Execution time (sec, lower is better)
- Error rate (%, lower is better)
- Cost per execution (USD, lower is better)

**program.md template:**

```markdown
# Optimization: brain-inbox n8n workflow reliability

## Scope
- Modify: workflow config JSON (node params, logic, error handling)
- Keep stable: input/output schema, external API contracts

## Metric
- Primary: success_rate (%, higher is better)
- Test: run workflow 100 times, measure success rate
- Baseline: 92%
- Target: 99%+

## Time budget
- Per experiment: 2 min (100 test runs)
- Total: 4 hours (120 experiments)

## Constraints
- Must handle network failures gracefully
- Must not create duplicate records
- Must log all failures
```

---

### 5. Marketing & Copy

**What to optimize:** Skill descriptions, messaging, call-to-action text, email copy, landing page text

**Scope:** One section of copy or one set of variations

**Metric examples:**
- Click-through rate (%, higher is better)
- Conversion rate (%, higher is better)
- Open rate for emails (%, higher is better)
- User engagement (time on page, higher is better)

**program.md template:**

```markdown
# Optimization: Skill description CTR

## Scope
- Modify: brain/ai/skills/custom/[name]/SKILL.md description field
- Keep stable: skill name, implementation

## Metric
- Primary: click_through_rate (%, higher is better)
- Test: A/B test with 200 users per variant
- Baseline: 3.2%
- Target: 8%+

## Time budget
- Per experiment: 1 hour (100 user sample)
- Total: overnight (10+ variants tested)

## Success looks like
- Clearer value proposition
- Better target audience language
- Stronger call-to-action
- Removed jargon
```

---

### 6. Business Metrics & Finances

**What to optimize:** Pricing, feature flags, discount strategy, notification timing, churn reduction

**Scope:** Configuration, thresholds, logic (not schema changes)

**Metric examples:**
- Revenue (USD, higher is better)
- Churn rate (%, lower is better)
- Conversion to paid (%, higher is better)
- Cost per acquisition (USD, lower is better)

**program.md template:**

```markdown
# Optimization: Pricing tier strategy

## Scope
- Modify: config/pricing.json (tier definitions, discounts, trial length)
- Keep stable: billing infrastructure, product features

## Metric
- Primary: revenue_per_user (USD, higher is better)
- Test: A/B test with 1000 users each
- Baseline: $45/user/month
- Target: $60+/user/month

## Constraints
- Churn must not increase >5%
- Keep at least one free tier
- Maintain market competitiveness

## Success looks like
- Better tier positioning
- Higher upgrade rate
- Reduced churn
- Increased ARPU
```

---

## How to invoke

When you want to optimize something:

```
/autoresearch

You: Let's optimize [target]. Here's what I want to measure...

I respond:
1. Read your program.md (or help you write one)
2. Set up the optimization loop
3. Run experiments autonomously
4. Each cycle: modify → measure → keep/discard → repeat
5. Summary at the end: what worked, what didn't, the improved artifact

You: Looks good, let's deploy the winner.
```

---

## Integration with brain's systems

- **Haiku** runs the tight loop (modify, test, iterate — cost-optimized)
- **Gemini Flash** preprocesses large diffs or logs (free preprocessing)
- **Codex** reviews final diff before you commit (second opinion on improvements)
- **Decision log** tracks major optimization wins

---

## How to apply results

After autoresearch completes:

1. **Review the log** — git commit history of all experiments
2. **Check the diff** — what changed from baseline to best?
3. **Decide**: `git commit` the winner or `git reset --hard` if nothing improved
4. **Deploy or test** — push the improved artifact to production/staging
5. **Monitor** — watch the metric in production to confirm the improvement holds

---

## Related

- **Karpathy autoresearch** — original LLM training optimization framework. We adapted the methodology for general use.
- **Caveman** — compresses output (different lever). This optimizes the artifact itself.
- **Model routing** — Haiku-first for cost. Autoresearch is the improvement framework.

---

## Status

Live as of 2026-04-10. Use `/autoresearch` to start an optimization loop on any bounded, measurable system in your business, apps, skills, or workflows.
