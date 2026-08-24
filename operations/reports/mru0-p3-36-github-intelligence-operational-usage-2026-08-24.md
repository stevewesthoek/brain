# MRU0-P3.36 GitHub Intelligence Operational Usage Report

**Date:** 2026-08-24
**Status:** COMPLETE — operational validation with real public candidates

## Method

Five public repositories were evaluated through the existing path:

`GitHub URL → ingestion evidence → public metadata enrichment → fit assessment → human review`

No repository was cloned, executed, installed, imported, adopted, or modified. Metadata requests were read-only public GitHub API requests. The existing Brain capability manifest was used as the comparison projection.

## Candidate results

| Candidate | Role in sample | Metadata | Fit result | Human-useful finding |
|---|---|---|---|---|
| `n8n-io/n8n` | automation/workflow orchestration | available, fresh; TypeScript; active push signal | `potentially_useful` (0.55) | Quickly exposed automation, AI, MCP, integration, and workflow signals; no confirmed Brain capability match was found. |
| `modelcontextprotocol/servers` | AI tool/context interoperability | available, fresh; TypeScript; active push signal | `potentially_useful` (0.55) | Identified a plausible interoperability candidate, but repository purpose and ecosystem detail were limited without README/content inspection. |
| `langfuse/langfuse` | LLM observability/evaluation | available, fresh; TypeScript; active push signal | `likely_overlap` (0.65) | Surfaced possible overlap with the existing `evaluation-loader` capability; correctly retained uncertainty that term overlap is not equivalence. |
| `prefecthq/prefect` | workflow orchestration | available, fresh; Python; active push signal | `potentially_useful` (0.55) | Provided clear purpose, language, orchestration, and maintenance signals; no matching capability evidence was found. |
| `octocat/Hello-World` | low-signal control | available, fresh; minimal description; no language/topics | `potentially_useful` (0.55) | Correctly exposed sparse evidence, but the disposition was too positive for a low-signal control. |

## Usefulness assessment

The current capability is already useful for first-pass triage:

- It answers what a repository appears to provide when the GitHub description and topics are informative.
- It exposes current activity, language, topics, license, and release signals without repository access.
- It identifies possible overlap without claiming equivalence.
- It makes missing README, documentation, pull-request, and dependency evidence explicit.
- It reduces the need for an initial manual API lookup and establishes a source-linked review record.

It does not yet answer integration fit or “worth investigating” with high confidence. Those remain human judgments because content, dependency, architecture, and security evidence are intentionally absent.

## Decision quality

- Useful findings: purpose/activity/technology triage for n8n, MCP servers, Langfuse, and Prefect.
- Possible overlap: Langfuse → `evaluation-loader`; this was appropriately marked possible rather than confirmed.
- False-positive signal: Hello World received `potentially_useful` despite insufficient substantive evidence.
- False-negative check: no candidate was marked low value, so the sample did not demonstrate a robust low-value disposition.
- Confidence calibration: 0.55 communicated that results were tentative, but the disposition vocabulary still needs stronger evidence gates.
- Unknown handling: README/documentation, pull-request activity, and dependency details remained unknown as required.

## Answers to operator questions

| Question | Current answer quality |
|---|---|
| What is this repository? | Good when description/topics/language are present; weak for sparse repositories. |
| Why could it matter? | Moderate; inferred from public purpose and topics, still advisory. |
| Do I already have similar capability? | Useful possible-overlap signal; not equivalence proof. |
| What gap could it fill? | Only a possible gap; absence of a match is not proof. |
| Is it worth investigating? | Not reliably enough for automatic or strong disposition; human review remains necessary. |

## Safety result

No execution, cloning, installation, credential use, repository mutation, adoption, task creation, roadmap mutation, Mind write, or Brain canonical write occurred.
