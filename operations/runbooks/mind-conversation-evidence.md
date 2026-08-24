# AI Conversation Evidence Foundation

## MRU0-P3.42 activated path

The existing foundation now has an explicit bridge into the existing daily review. Create a bounded evidence artifact from a selected session reference and structured candidate signals, then pass that artifact to the review workflow:

```js
import { createConversationEvidence, extractConversationCandidates, writeConversationEvidence } from './tools/scripts/mind-steward-conversation-evidence.mjs';

const session = { provider: 'codex', session_id: 'session-id', repository: 'brain', workspace: 'brain', timestamp: new Date().toISOString(), freshness: 'fresh', transcript_read: false };
const candidates = extractConversationCandidates({ session, records: [{ category: 'decision', statement: 'A bounded human-review decision.' }] });
const artifact = createConversationEvidence({ session, candidates });
writeConversationEvidence({ envelope: artifact, repoRoot: '/Users/Office/Repos/stevewesthoek/brain' });
```

Run the normal review workflow with the explicit artifact path:

```bash
MIND_STEWARD_MIND_ROOT=/Users/Office/Repos/stevewesthoek/mind \
node tools/scripts/mind-steward-daily-review.mjs \
  --conversation-evidence-file /Users/Office/Repos/stevewesthoek/brain/runtime/local/mind-steward/conversation-evidence/<artifact>.json
```

The artifact must be under Brain runtime-local conversation evidence. The command projects it into the same unified review inbox and daily decision workflow used by other evidence producers. It does not scan session roots, read all transcripts, or promote candidates.

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

## Historical session capability assessment

Metadata-only inspection on 2026-08-24 found local Claude Code and Codex session roots with JSONL records. Their existence is evidence that selected local references are available, not authorization for bulk ingestion. Workbench application/runtime roots are present, but repository and Workbench documentation state that the admitted Workbench surface is a guarded repository/action bridge, not a passive ChatGPT-history exporter. Workbench therefore remains explicit-metadata-only until a supported export/event/capture surface is admitted.

Privacy rule: do not copy raw session content into Brain or Mind, do not commit runtime artifacts, and do not persist secrets. Infrastructure-related session statements remain non-canonical evidence and require IKHP/provider verification.
