---
name: notebooklm
description: Use when the user asks for NotebookLM, deep research across many sources, building a research notebook from web URLs or Brain excerpts, querying an existing notebook for answers, or generating source-grounded outputs such as briefing docs, study guides, slide decks, mind maps, and source summaries. Prefer for research-heavy strategy and planning work, multi-source comparison, and synthesis tasks. Optimized for ProBot while remaining usable as a shared cross-tool research workflow.
---

# NotebookLM

## What this skill is for
- Use NotebookLM as the research and synthesis layer.
- Treat the Brain repo as canonical truth.
- Use this skill when the task needs source-grounded synthesis, not just a quick answer.

## Use this skill when
- The user explicitly asks for NotebookLM.
- The task is research-heavy and involves many sources.
- The task needs comparison across multiple sources.
- The task is strategy or planning work that benefits from structured research.
- The task needs a dedicated research notebook built from:
  - web URLs
  - pasted Brain excerpts
  - YouTube
  - PDFs
- The task needs outputs such as:
  - direct answers
  - briefing docs
  - study guides
  - slide decks
  - mind maps
  - source summaries

## Do not use this skill when
- The answer is already directly available in the Brain repo and no real synthesis is needed.
- The task is a quick factual lookup with only one simple source.
- The task is operational, local, or code-specific rather than research-heavy.

## Canonical truth rule
- The Brain repo is canonical.
- NotebookLM is a research, synthesis, and retrieval layer.
- If NotebookLM output conflicts with the Brain repo, prefer the Brain repo and treat NotebookLM as derived context.

## Preferred source order
Use sources in this order by default:
1. Web URLs
2. Pasted text from the Brain repo
3. YouTube
4. PDFs
5. Google Drive only after explicit user confirmation

When pulling Brain content into NotebookLM:
- Prefer focused canonical excerpts over large bulk dumps.
- Add only the files or sections needed for the current research task.

## Default notebook model
- Default to one notebook per research task.
- Prefer many focused notebooks over a few overloaded notebooks.
- Reuse an existing notebook only when the task is a direct continuation of the same topic.
- Assume NotebookLM organization is flat; use naming discipline instead of relying on subfolders.

## Naming convention
Use:
`YYYY-MM-DD - <topic>`

Examples:
- `2026-03-24 - ProChat positioning research`
- `2026-03-24 - Bible product competitor scan`
- `2026-03-24 - SaaS onboarding pattern research`

Keep titles short, specific, and tied to one research objective.

## Priority domains
Optimize this workflow first for:
- ProChat growth and positioning
- Steve’s personal knowledge base
- Theology and Bible products/projects
- Product and SaaS research
- Client research

## Tool selection
Read `tools.md` when you need the exact NotebookLM MCP tool names.

Use this mapping:
- Need to discover new external sources:
  - `research_start`
  - `research_status`
  - `research_import`
- Need a new notebook:
  - `notebook_create`
- Need to query an existing notebook:
  - `notebook_query`
- Need to add Brain excerpts or other direct text:
  - `notebook_add_text`
- Need to add a direct public source:
  - `notebook_add_url`
- Need to add a Drive source:
  - `notebook_add_drive` only after explicit confirmation
- Need to inspect existing imported sources:
  - `source_get_content`
  - `source_describe`
- Need to generate artifacts:
  - use the relevant report/studio tool listed in `tools.md`
- Need to fix auth:
  - `refresh_auth`
  - `save_auth_tokens` only when necessary

## Default workflow
1. Decide whether the task is research-heavy enough for NotebookLM.
2. If the user already has the right notebook, use it.
3. Otherwise create a new notebook named `YYYY-MM-DD - <topic>`.
4. Gather sources in the preferred order.
5. For new external discovery:
   - use fast research for narrower or lighter tasks
   - use deep research for major strategy or source-comparison tasks
6. Import only the most relevant sources.
7. Add focused Brain excerpts when canonical context from the repo should shape the research.
8. Query the notebook with concrete, outcome-driven questions.
9. Return the useful output directly, and generate richer artifacts when appropriate.
10. Record or summarize the notebook used if it matters for continuity.

## ProBot operating stance
- This skill is shared across tools, but optimize behavior first for ProBot.
- Favor workflows that expand Steve’s business and personal knowledge in a way ProBot can later reuse.
- When useful, connect NotebookLM research back to canonical Brain files rather than leaving knowledge stranded only inside NotebookLM.

## Autonomy rules
Allowed by default:
- create notebooks
- run web research
- import sources
- add URLs
- add pasted Brain text
- query notebooks
- generate non-destructive research outputs

Require explicit confirmation:
- any delete action
- any Google Drive access

When using Google Drive:
- tell the user you are using Drive
- ask first

When a NotebookLM studio/report tool requires an explicit confirmation flag in the client, obtain that confirmation before running it.

## Output priorities
Prefer these outputs in this order unless the user asks otherwise:
1. Direct answers
2. Briefing docs
3. Study guides
4. Slide decks
5. Mind maps
6. Source summaries

## Query style
- Ask concrete, bounded questions.
- Prefer synthesis questions over vague brainstorming.
- Ask for comparisons, tradeoffs, themes, and decision-ready summaries.
- Anchor outputs to sources whenever possible.

Good examples:
- Compare the top 5 positioning patterns across these sources.
- Summarize the strongest objections and counter-messaging.
- Extract the recurring product gaps and turn them into roadmap implications.
- Build a briefing on this market with risks, opportunities, and recommended next steps.

## Practical rules
- Do not treat NotebookLM as canonical memory.
- Do not dump large unrelated Brain files into a notebook.
- Do not create omnibus notebooks for unrelated topics.
- Do not use Drive silently.
- Do not delete notebooks, sources, or artifacts without confirmation.

## If NotebookLM is unavailable
- Report that the MCP server or auth is unavailable.
- Fall back to direct web/document analysis if possible.
- Keep the same source-of-truth rule: Brain first, research layer second.
