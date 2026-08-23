# AI Conversation Evidence Foundation

MRU0-P3.16 provides an explicit, bounded evidence artifact for selected Claude Code, Codex, or Workbench session references.

## Boundary

The module accepts a session identity and optional structured candidate signals. It reads only metadata when a local session path is explicitly provided. It does not scan session directories, copy full transcripts, call providers, create a transcript database, or promote insights.

Candidate categories are:

- decision;
- architecture;
- lesson;
- unresolved question;
- changed file;
- validation;
- recurring problem;
- improvement.

Every candidate retains session provenance, confidence, uncertainty, restricted privacy, freshness, and mandatory human review.

## Output

Evidence artifacts are written only under:

```text
runtime/local/mind-steward/conversation-evidence/
```

They are ingestion evidence and review inputs. Durable Mind meaning, importance, priorities, and memory decisions remain human-owned. Accepted candidates require the existing decision and bounded promotion flow.

## Supported session references

- Claude: explicit files under `~/.claude/projects/`;
- Codex: explicit files under `~/.codex/sessions/`;
- Workbench: explicit metadata reference; no local path convention is assumed.

No automatic provider activation is enabled. Video, audio, GitHub, and autonomous memory extraction remain outside this packet.
