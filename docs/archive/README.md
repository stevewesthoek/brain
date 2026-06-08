# Archive

This folder contains historical reports, analysis documents, and out-of-date reference materials that are retained for context but are not part of active operations.

## Reports Directory

The `reports/` subdirectory contains:

| File | Purpose | Created | Status |
|------|---------|---------|--------|
| `GEMMA4_UPGRADE_SUMMARY.md` | Summary of Gemma 4 model upgrade work | Phase 4 | Historical reference |
| `HARDENING-PHASE-FINAL-REPORT.md` | Conclusions from infrastructure hardening work | Phase 4 | Historical reference |
| `INFRASTRUCTURE-SUMMARY.md` | Summary of infrastructure and architectural decisions | Phase 4 | Historical reference |
| `PRODUCER-HARDENING-FINAL-ANSWERS.md` | Detailed answers from producer infrastructure hardening | Phase 4 | Historical reference |
| `SKILL-BLOAT-ANALYSIS.md` | Analysis of skill proliferation and recommendations | Phase 4 | Applied; see `docs/skills/skill-loading-architecture.md` |
| `SKILL-PROFILE-APPLIED.md` | Record of skill profile application and outcomes | Phase 4 | Applied; see `ai/skills/` |

These documents are kept for:
- Historical context about why certain architectural decisions were made
- Reference for future operations and infrastructure work
- Recovery documentation if needed for rollback or investigation

## When to Reference

- **Researching why a system works as it does:** Check the relevant historical report
- **Planning infrastructure changes:** Review the hardening and upgrade reports for prior decisions
- **Adding new skills:** See `SKILL-BLOAT-ANALYSIS.md` for profile architecture context

## When to Update

Archive documents should remain unchanged unless:
1. New cleanup phases add more archived materials
2. A new summary or index is needed for better navigation

Do not modify the contents of these reports. They are historical snapshots.

## Current Operations Reference

For active system documentation, see:
- `docs/skills/` — Current skill and profile documentation
- `operations/runbooks/` — Active operational procedures
- `operations/standards/` — Current standards and guidelines
- `operations/decision-log.md` — Confirmed active decisions
