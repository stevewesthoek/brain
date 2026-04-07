---
name: skill-prune
description: Monthly skill library pruning. Reviews all active skills for staleness, overlap, and quality-gate failures, then proposes and executes deletions and consolidations.
---

# Skill Prune

Run this once a month to keep the skill library sharp and the token overhead low.

## Step 1 — Inventory

```bash
ls /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/ | sort
```

Count total. Flag concern if > 60 non-tool skills.

## Step 2 — Stale check

```bash
find /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/learned \
  -name "SKILL.md" -printf "%T@ %p\n" | sort -n | \
  awk '{print strftime("%Y-%m-%d", $1), $2}'
```

Any skill not touched in 6+ months that is also project-specific is a
deletion candidate unless it describes a recurring platform gotcha.

## Step 3 — Overlap scan

Read SKILL.md for each skill and group by domain. Current known clusters
to evaluate for consolidation:

- **Dokploy cluster**: `dokploy`, `dokploy-nixpacks-env-leak`,
  `dokploy-save-environment-full-replace`, `dokploy-swarm-deploy-stale`
  → consider merging into one `dokploy-gotchas` skill
- **Next.js build cluster**: `nextjs-buildtime-module-eval-env`,
  `nextjs-next-public-dockerfile-real-value`, `nextjs-sqlite-buildtime-crash`,
  `nextjs-fixed-header-hero-flex-overflow`
  → evaluate if any can be merged
- **Meta/Facebook cluster**: `meta-app-review-copy-facebook-page-posting`,
  `meta-app-shape-empty-me-accounts`, `meta-oauth-scope-failure`

## Step 4 — Quality gate recheck

For each learned skill, reconfirm it passes all three:
1. Not Googleable
2. Codebase/stack-specific (not generic advice)
3. Describes a recurring problem, not a one-off fix

Fail on any one → deletion candidate.

## Step 5 — Present findings

Show the user a table:

| Skill | Action | Reason |
|-------|--------|--------|
| `foo` | Delete | One-off fix, hasn't recurred |
| `bar` + `baz` | Merge → `qux` | 80% overlap |
| `old-thing` | Keep | Still triggers regularly |

Wait for confirmation before making any changes.

## Step 6 — Execute

For each deletion:
```bash
rm /Users/Office/Repos/stevewesthoek/brain/ai/skills/active/<name>
rm -rf /Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/learned/<name>
```

For each merge: write the consolidated SKILL.md, create new symlink,
then delete the old ones.

## Target steady state
- Operational tools (dokploy, gh, aws, etc.): keep all, they're thin
- Learned gotchas: aim for < 20, each describing a distinct recurring problem
- Design/review process skills: keep, they're intentional workflow tools

## Context
Owner: Steve Westhoek
Cadence: monthly (fires ~7th of each month)
Area: brain/ai/skills/
