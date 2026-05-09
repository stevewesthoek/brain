# Research Repo + Google Drive Architecture

**Status:** Recommended architecture  
**Scope:** General research and Bible research workflows

---

## Recommendation

Use both Git and Google Drive.

```text
Git repo = canonical research knowledge base
Google Drive = collaboration, import/export, and source inbox
```

Do not replace Git with Google Drive if the goal is durable, reviewable, iterated research. Do not replace Google Drive with Git if the workflow needs shared Docs, comments, scans, PDFs, and non-technical collaboration.

---

## Why Git Should Remain Canonical

Git is best for curated research because it provides:

- full version history
- readable diffs for Markdown
- branches for experimental research lines
- reviewable changes
- rollback
- reproducible source organization
- local-first access
- clear provenance and auditability

For Bible research especially, Git helps track interpretive changes over time: when a passage note changed, why a conclusion was refined, and which source affected the update.

---

## Why Google Drive Still Matters

Google Drive is best for:

- Google Docs collaboration
- comments and suggestions
- importing PDFs, scans, handouts, and shared resources
- sharing drafts with non-technical collaborators
- exporting polished documents
- storing documents received from others

Drive should be treated as a document exchange and collaboration layer, not the only durable source of truth.

---

## Recommended Repo Structure

```text
research/
  README.md
  inbox/
    README.md
  sources/
    README.md
    drive-exports/
    web/
    pdf/
    books/
    papers/
  notes/
    README.md
    bible/
      passages/
      topics/
      word-studies/
      theological-questions/
      comparative-views/
    general/
    people/
    organizations/
    books/
  briefs/
  reports/
  sermons/
  bible-studies/
  bibliographies/
  templates/
    passage-study.md
    topical-study.md
    word-study.md
    source-check.md
    research-brief.md
  .research/
    metadata/
    drive-map.json
    source-ledger.json
```

---

## Google Drive Integration Model

Use explicit operations with safe defaults.

### Import

```text
Google Drive Doc/PDF/file
  → export/download
  → save into sources/drive-exports/ or sources/pdf/
  → create metadata record
  → optionally create curated Markdown note
```

### Export

```text
Markdown note/report in Git
  → create/update Google Doc
  → record Drive file ID in .research/metadata/
  → keep Git note canonical unless user marks Drive as collaborative draft
```

### Sync

```text
Compare repo note and Drive document
  → show diff/summary
  → ask before overwriting either side
  → write audit record
```

### Delete

```text
Move Drive file to trash only
  → never hard-delete by default
  → require explicit confirmation
  → write audit record
```

---

## Drive Safety Requirements

Direct Google Drive create/edit/delete requires a configured integration. The Bible research skill must not assume access exists.

Required guardrails:

1. OAuth credentials stored outside the repo.
2. No refresh tokens, client secrets, service account keys, cookies, or credentials in Git.
3. Least-privilege scopes where feasible.
4. Dry-run for bulk operations.
5. Trash-first deletion only.
6. Explicit confirmation for delete, move, permission changes, or overwrite.
7. Export-before-overwrite for Google Docs.
8. Audit log of file ID, title, operation, timestamp, and actor.
9. Redacted logs only.
10. No automatic sharing/permission widening without confirmation.

---

## Suggested Metadata

`.research/drive-map.json` should map curated repo files to Drive files without storing secrets.

```json
{
  "version": 1,
  "files": [
    {
      "repo_path": "notes/bible/passages/john-15-1-8.md",
      "drive_file_id": "placeholder-drive-file-id",
      "drive_title": "John 15 1-8 Passage Study",
      "mime_type": "application/vnd.google-apps.document",
      "direction": "repo_canonical",
      "last_synced_at": "2026-05-09T00:00:00Z",
      "notes": "No secrets here. File IDs are references only."
    }
  ]
}
```

`.research/source-ledger.json` can track sources:

```json
{
  "version": 1,
  "sources": [
    {
      "id": "src-0001",
      "title": "Example Source",
      "type": "book | article | pdf | web | drive-doc | commentary | lexicon",
      "author": "",
      "date": "",
      "location": "sources/drive-exports/example.md",
      "accessed_at": "2026-05-09",
      "rights_notes": ""
    }
  ]
}
```

---

## Canonicality Rules

Use a `direction` field for every Drive-linked file:

| Direction | Meaning |
|---|---|
| `repo_canonical` | Git note/report is source of truth; Drive is export/collab copy |
| `drive_canonical` | Drive doc is source of truth; repo stores exported snapshot |
| `bidirectional_review` | Neither side auto-wins; show diff and ask |
| `archive_only` | Repo stores a static export; no sync expected |

Default to `repo_canonical` for Bible research notes.

---

## Workflow Examples

### Passage Study

```text
1. Draft note in notes/bible/passages/john-15-1-8.md
2. Commit to Git
3. Export to Google Doc for group review
4. Collect comments in Drive
5. Import suggested changes into a branch or draft commit
6. Review diff
7. Merge updated note
```

### Source Import

```text
1. Add PDF/commentary excerpt to Google Drive
2. Import to sources/drive-exports/
3. Record metadata in source-ledger.json
4. Create curated note under notes/bible/
5. Commit source metadata and note
```

### Collaborative Bible Study

```text
1. Canonical outline lives in Git under bible-studies/
2. Export to Google Doc before the meeting
3. After collaborative edits, import Drive version as a draft
4. Review changes manually
5. Commit accepted changes
```

---

## What Not To Do

- Do not use Google Drive as the only version history for curated research.
- Do not store real OAuth tokens or service account keys in the research repo.
- Do not hard-delete Drive files by default.
- Do not auto-overwrite Google Docs from repo notes without a diff/confirmation step.
- Do not commit copyrighted PDFs or books unless rights permit it.
- Do not let Drive comments become the only record of research decisions; summarize accepted decisions in Git.

---

## Build Sequence

1. Create research repo with the structure above.
2. Add templates for passage study, topical study, word study, source check, and research brief.
3. Add `.research/drive-map.json` and `.research/source-ledger.json` with placeholder examples only.
4. Add scripts later for Drive import/export/sync once OAuth boundary is decided.
5. Keep Drive integration read-only first, then create/export, then patch/edit, then trash/delete with confirmation.

---

## Future Skill Integration

`/research` should know this architecture and offer to save durable notes.

`/bible-research` should use it for:

- passage studies
- topical studies
- word studies
- theological question notes
- sermon outlines
- Bible-study handouts
- source verification notes

The Drive integration should be a separate tool or subskill, not embedded directly into biblical interpretation logic.
