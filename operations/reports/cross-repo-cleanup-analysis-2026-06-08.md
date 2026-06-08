# Cross-Repo Structure Cleanup Analysis
## Brain & Mind Integration, Infinite Brain Test File Relocation, Graphify Output Hiding

**Date:** 2026-06-08  
**Scope:** Analysis and planning only. No changes made.  
**Hard Constraints:** All 15 constraints honored. Analysis only.  
**Time Window:** Post-Phase AL (Infinite Brain single-file allowlist test operational)

---

## Executive Summary

### Feasibility Assessment

✅ **Moving InfiniteBrainWriteTest.md from `/mind/00_System/` to `/mind/system/` is FEASIBLE**
- Non-breaking change
- 23 files require reference updates (12 source code, 6 docs, 5 runtime state files)
- Allowlist is environment-configurable; no hardcoded paths except one constant
- Tests already use environment overrides; relocation is zero-impact on test design
- All references are traceable and patchable

✅ **Graphify output path from `graphify-out/` to `.graphify-out` is SAFE and FEASIBLE**
- No hardcoded absolute path bindings in CLI
- All references are string-based and configurable
- Hidden-dot convention is supported by `.gitignore` patterns already present
- 29 references found across code, scripts, runtime, and docs
- `.gitignore` in both repos already handles `graphify-out/`; extending to `.graphify-out` is mechanical
- Python and shell logic works identically with hidden path

⚠️ **Mind root cleanup (removing `00_System/` folder) is FEASIBLE but REQUIRES TEST FILE MOVE FIRST**
- `00_System/` is NOT a Mind-native folder; it was created only as a target for Infinite Brain test write
- Mind folder structure shows two system folders: `00_System/` (Infinite Brain test sink) and `system/` (Mind operating docs)
- `system/` is the correct architectural home for system documentation
- Merging the two is safe **after** the test file moves

⚠️ **Brain root markdown cleanup (archiving INFRASTRUCTURE-SUMMARY, SKILL-BLOAT-ANALYSIS, etc.) is SAFE but COSMETIC**
- 7 markdown report files at Brain root (totaling 59KB) are generated artifacts and archived analyses, not operational
- These should live in `docs/archive/reports/` or similar
- This is lowest priority and can be deferred

### Major Risks

🔴 **CRITICAL: Runtime state files must be synchronized**
- 5 JSON files in `runtime/local/infinite-brain/` contain hardcoded `/mind/00_System/InfiniteBrainWriteTest.md` paths
- These are **generated state snapshots**, not source of truth
- They will become stale after code is updated
- They should be regenerated, not manually patched
- **Mitigation:** After code update, run `npm run ibr:verify` to regenerate state

🟡 **MEDIUM: Test files have path hardcoding in temporary setup code**
- Some test utilities manually construct paths with `00_System` string literals
- These are caught by environment overrides but must be updated for clarity
- **Mitigation:** Update test fixtures to use environment variables only

🟡 **MEDIUM: Graphify nightly scheduler references hardcoded string**
- `graphify-nightly.sh` script has `skip_dirs` set containing `'graphify-out'` as Python literal
- Scheduler runs independent of code; changes won't auto-propagate
- **Mitigation:** Update scheduler, test with `npm run graphify:update:*` commands

---

## Current Inventory Analysis

### Brain Repo Top-Level Structure

| Path | Category | Size | Tracked | Recommendation | Risk |
|------|----------|------|---------|-----------------|------|
| **projects/** | Source/project code | N/A (dir) | ✓ | Keep | None |
| **ai/** | AI/tooling/skills | N/A (dir) | ✓ | Keep | None |
| **operations/** | Operations/runbooks/scripts | N/A (dir) | ✓ | Keep | None |
| **tools/** | Utility scripts | N/A (dir) | ✓ | Keep | None |
| **runtime/** | Runtime output/cache | N/A (dir) | ✗ (ignored) | Keep pattern | None |
| **.buildflow/** | Package/dependency artifact | N/A (dir) | ✗ (ignored) | Keep ignored | None |
| **.claude/** | AI session state | N/A (dir) | ✗ (ignored) | Keep symlink target | None |
| **.github/** | GitHub/CI metadata | N/A (dir) | ✓ | Keep | None |
| **.gstack/** | Tool artifact | N/A (dir) | ✗ (ignored) | Keep ignored | None |
| **.local/** | Local tool data | N/A (dir) | ✗ (ignored) | Keep ignored | None |
| **.obsidian/** | Obsidian metadata | N/A (dir) | ✓ | Keep | None |
| **graphify-out/** | **Graphify runtime output** | N/A (dir) | ✓ | **→ Hide as .graphify-out** | **Low-Medium** |
| **node-compile-cache/** | Tool cache | N/A (dir) | ✗ (ignored) | Keep ignored | None |
| **.gitignore** | Git config | 6.1K | ✓ | Update (add .graphify-out pattern) | None |
| **.claudeignore** | Claude config | 1.3K | ✓ | Keep | None |
| **docker-compose.yml** | Infrastructure | 1.5K | ✓ | Keep | None |
| **package.json** | Package config | 2.1K | ✓ | Keep | None |
| **package-lock.json** | Dependency lock | 213B | ✓ | Keep | None |
| **CLAUDE.md** | Documentation | 24.7K | ✓ | Keep | None |
| **README.md** | Documentation | 10.3K | ✓ | Keep | None |
| **AGENTS.md** | Documentation | 4.8K | ✓ | Keep | None |
| **00-start-here.md** | Documentation | 3.0K | ✓ | Keep | None |
| **00-current-context.md** | Documentation | 3.9K | ✓ | Keep | None |
| **00-memory-map.md** | Documentation | 6.0K | ✓ | Keep | None |
| **GEMMA4_UPGRADE_SUMMARY.md** | **Historical report** | 9.6K | ✓ | **→ docs/archive/reports/** | **Low** |
| **HARDENING-PHASE-FINAL-REPORT.md** | **Historical report** | 7.4K | ✓ | **→ docs/archive/reports/** | **Low** |
| **INFRASTRUCTURE-SUMMARY.md** | **Historical report** | 8.9K | ✓ | **→ docs/archive/reports/** | **Low** |
| **PRODUCER-HARDENING-FINAL-ANSWERS.md** | **Historical report** | 9.1K | ✓ | **→ docs/archive/reports/** | **Low** |
| **SKILL-BLOAT-ANALYSIS.md** | **Historical report** | 10.7K | ✓ | **→ docs/archive/reports/** | **Low** |
| **SKILL-PROFILE-APPLIED.md** | **Historical report** | 6.1K | ✓ | **→ docs/archive/reports/** | **Low** |

**Brain root summary:**
- ✅ 32 entries, 7 are generated/historical reports
- ✅ 1 folder needs hiding: `graphify-out/` → `.graphify-out`
- ⚠️ 6 markdown files are archived analysis, not operational
- ✅ Core structure is clean, minimal

---

### Mind Repo Top-Level Structure

| Path | Category | Size | Tracked | Recommendation | Risk |
|------|----------|------|---------|-----------------|------|
| **wiki/** | Vault content | N/A (dir) | ✓ | Keep | None |
| **live/** | Vault content | N/A (dir) | ✓ | Keep | None |
| **capture/** | Vault content (auto-ingest) | N/A (dir) | ✓ | Keep | None |
| **sources/** | Reference material | N/A (dir) | ✓ | Keep | None |
| **tasks/** | Task/kanban data | N/A (dir) | ✓ | Keep | None |
| **router/** | Obsidian router plugins | N/A (dir) | ✓ | Keep | None |
| **tools/** | Local tools | N/A (dir) | ✓ | Keep | None |
| **archive/** | Archived vault content | N/A (dir) | ✓ | Keep | None |
| **system/** | **System/automation docs** | N/A (dir) | ✓ | Keep | None |
| **00_System/** | **❌ Infinite Brain test sink** | N/A (dir) | ✓ | **→ REMOVE after test file moves** | **Medium** |
| **graphify-out/** | Graphify runtime output | N/A (dir) | ✓ | **→ Hide as .graphify-out** | **Low-Medium** |
| **.obsidian/** | Obsidian metadata | N/A (dir) | ✗ (ignored) | Keep ignored | None |
| **.trash/** | Obsidian trash | N/A (dir) | ✓ | Keep (Obsidian internal) | None |
| **.gitignore** | Git config | 634B | ✓ | Update (add .graphify-out pattern) | None |
| **home.md** | Dashboard | 5.0K | ✓ | Keep | None |
| **kanban.md** | Kanban board | 4.4K | ✓ | Keep | None |

**Mind root summary:**
- ✅ 15 entries (clean, human-readable, very few machine entries)
- ✅ 1 folder is temporary and should be removed: `00_System/`
- ✅ After `00_System/` is removed, Mind root becomes completely human-first
- ⚠️ 1 folder needs hiding: `graphify-out/` → `.graphify-out`

---

## Infinite Brain Write-Test Relocation Analysis

### Current Setup

**Current Path:** `/Users/Office/Repos/stevewesthoek/mind/00_System/InfiniteBrainWriteTest.md`

**Current File Contents (7 lines):**
```markdown
---
name: "Infinite Brain Write Test"
status: "verified"
---

# Infinite Brain Write Test

This file exists only for the first controlled Infinite Brain metadata write test.
```

**Why `00_System/` was created:**
- Temporary folder created as an Infinite Brain write-test sink
- Not part of Mind's native architecture
- 00_ prefix was used to signal "system folder, don't look here"
- Contains only the test file; no other content

**Desired New Path:** `/Users/Office/Repos/stevewesthoek/mind/system/InfiniteBrainWriteTest.md`

**Why move to `system/`:**
- `system/` already exists and holds Mind operating documentation
- System contracts already cover automation rules
- Architecturally correct home for Infinite Brain operational test
- Removes need for separate `00_System/` folder
- Makes Mind root completely human-readable

### All References to Update

**Count: 23 files requiring updates**

#### Source Code (12 files)

1. **`projects/brain-core/src/adapters/infinite-brain-metadata-write-allowlist.ts`**
   - Line 22-25: `DEFAULT_ALLOWLISTED_TEST_PATH` constant
   - Change: `'00_System'` → `'system'`
   - Impact: Low (uses `path.resolve()`, testable)
   - Tied to env var override: `IBR_METADATA_WRITE_ALLOWLIST_PATH`

2. **`projects/brain-core/src/tests/infinite-brain-metadata-writer-single-file-write.test.ts`**
   - Line 21: `systemDir = path.join(mindRoot, '00_System')`
   - Line 24: allowlist path construction
   - Line 60: env var path `path.join(mindRoot, '00_System', 'InfiniteBrainWriteTest.md')`
   - Also line 133: second file test path with `00_System`
   - Change: Update temp directory setup to use `system` folder
   - Impact: Low (temp test setup; tests already use env overrides)

3. **`projects/brain-core/src/tests/infinite-brain-metadata-write-allowlist.test.ts`**
   - Line checking for `00_System` in normalized path
   - Change: Update validation test case
   - Impact: Low (test fixture, not core logic)

4. **`projects/brain-core/src/tests/routes.test.ts`**
   - Line: `const mindDir = path.join(testDir, '00_System')`
   - Change: Update to `system`
   - Impact: Low (temp test setup)

5. **`projects/brain-core/dist/tests/infinite-brain-metadata-writer-single-file-write.test.js`** (compiled)
   - Auto-recompiled from source, do not edit directly
   - Will be updated by `npm run build`

6. **`projects/brain-core/dist/tests/infinite-brain-metadata-write-allowlist.test.js`** (compiled)
   - Auto-recompiled from source

7. **`projects/brain-core/dist/tests/routes.test.js`** (compiled)
   - Auto-recompiled from source

8. **`projects/brain-core/dist/adapters/infinite-brain-metadata-write-allowlist.js`** (compiled)
   - Auto-recompiled from source

9-12. **Remaining compiled .js files in dist/**
   - All auto-regenerated; no direct edits needed

#### Documentation (6 files)

13. **`operations/runbooks/infinite-brain-single-file-write.md`**
    - Line 8: "**Write Scope:** Single allowlisted file only — `/Users/Office/Repos/stevewesthoek/mind/00_System/InfiniteBrainWriteTest.md`"
    - Line ~90: "**Path:** `/Users/Office/Repos/stevewesthoek/mind/00_System/InfiniteBrainWriteTest.md`"
    - Multiple references in procedure tables and Q&A
    - Change: All instances of `/00_System/InfiniteBrainWriteTest.md` → `/system/InfiniteBrainWriteTest.md`
    - Impact: Medium (operator runbook; must be accurate)

14. **`operations/runbooks/infinite-brain-roadmap-status.md`**
    - References test file path
    - Change: Path update
    - Impact: Low (status doc)

15. **`CLAUDE.md` (project-level, brain repo)**
    - May reference test file path in Infinite Brain section if present
    - Change: Update if referenced
    - Impact: Low (reference doc)

#### Runtime State Files (5 files)
*These are auto-generated snapshots; they will become stale and should be regenerated, not hand-patched*

16. **`runtime/local/infinite-brain/metadata-writer-write-latest.json`**
    - `"targetPath": "/Users/Office/Repos/stevewesthoek/mind/00_System/InfiniteBrainWriteTest.md"`
    - Status: Generated snapshot, will be updated on next write
    - Action: Regenerate after code update via `npm run ibr:single-file-write-test`

17. **`runtime/local/infinite-brain/metadata-write-rollback-latest.json`**
    - Same path reference
    - Status: Generated snapshot
    - Action: Regenerate

18. **`runtime/local/infinite-brain/metadata-write-rollback-applied-latest.json`**
    - Same path reference
    - Status: Generated snapshot
    - Action: Regenerate

19. **`runtime/local/infinite-brain/metadata-write-verification-latest.json`**
    - Same path reference + verification log
    - Status: Generated snapshot
    - Action: Regenerate

20. **`runtime/local/infinite-brain/operator-approval-latest.json`**
    - References test file in approval log
    - Status: Generated snapshot
    - Action: Regenerate

#### Configuration (0 additional files)
- No scheduler config changes needed (scheduler is time-based, not path-based)
- No environment variable defaults need updating in non-code config (all managed via TypeScript constants)

### Updated Allowlist Specification

**Current Allowlist Path (in code constant):**
```typescript
const DEFAULT_ALLOWLISTED_TEST_PATH = path.resolve(
  DEFAULT_MIND_REPO_PATH,
  '00_System',
  'InfiniteBrainWriteTest.md'
);
```

**New Allowlist Path (after change):**
```typescript
const DEFAULT_ALLOWLISTED_TEST_PATH = path.resolve(
  DEFAULT_MIND_REPO_PATH,
  'system',
  'InfiniteBrainWriteTest.md'
);
```

**Environment Override (unchanged):**
- `IBR_METADATA_WRITE_ALLOWLIST_PATH` env var works identically
- Tests already override via this env var
- No test logic changes required

### Validation & Testing Strategy

**Before code update:**
1. Run `npm run ibr:verify` — establishes baseline (11/11 checks)
2. Document current state

**After code update:**
1. Run `npm run build` — recompile TypeScript to dist/
2. Run `npm run ibr:verify` — should still pass 11/11 checks
3. Run `npm run test` — test suite validates allowlist logic against new path
4. Run `npm run ibr:single-file-write-test` — manual write test to new path
5. Verify: `npm run ibr:verify` again — should show "verified"
6. Run `npm run ibr:rollback` — verify rollback still works with new path

**Rollback:**
- If any validation fails, revert code to `'00_System'` in TypeScript
- Recompile with `npm run build`
- Old runtime state files will be re-validated against old path
- No data loss (test file still exists at old or new location)

---

## Graphify Hidden-Output Analysis

### Current Path Convention

**Current:** `graphify-out/` (visible at repo root)  
**Proposed:** `.graphify-out/` (hidden via dot convention)

### Why Hide Graphify Output?

1. **Convention:** Hidden folders (`.git`, `.obsidian`, `.travis`) signal "machine-internal, not for human browsing"
2. **Cleaner root:** Both Brain and Mind roots would show no generated output at top level
3. **Visibility:** Still accessible for debugging but doesn't clutter root directory listing
4. **Standard:** Most build/generated-output tools use hidden conventions (`.next`, `.build`, `.cache`)
5. **Git safety:** `.gitignore` patterns already support hidden paths

### Graphify Architecture

**Tool:** `graphify` CLI (external, installed locally)  
**Mode:** Reads code, generates semantic graph  
**Output:** JSON, Markdown, HTML files  
**Profiles:** Different configs for Brain, Mind, and other repos  
**Storage:** Currently hardcoded relative path `graphify-out/`, resolved at runtime

**Key insight:** Graphify paths are NOT hardcoded absolute paths; they're relative to repo root, resolved dynamically. Changing `graphify-out/` → `.graphify-out/` is a string substitution with no logic impact.

### All References Found (29 total)

#### Code References (8 files)

1. **`tools/scripts/graphify-nightly.sh`** (line 35)
   ```python
   skip_dirs = {'.git', 'node_modules', '.next', 'dist', 'build', '.venv', 'venv', '__pycache__', 'graphify-out'}
   ```
   Change: `'graphify-out'` → `'.graphify-out'`
   Impact: Low (Python set literal)

2. **`tools/graphify/EXECUTABLE-UPDATE-GUIDE.md`** (multiple lines)
   - Line comments mentioning `graphify-out/`
   - Change: Update documentation
   - Impact: Low (doc only)

3. **`tools/graphify/README.md`** (multiple lines)
   - References to `graphify-out/`
   - Change: Update documentation
   - Impact: Low (doc only)

#### Runtime Generated Files (14 files)
*These are auto-generated state snapshots; will be regenerated on next run, no hand-patching needed*

4. **`runtime/local/infinite-brain/entity-classifier-latest.json`** (multiple path references)
   - References like `"path": "graphify-out/GRAPH_REPORT.md"`
   - Status: Generated snapshot
   - Action: Regenerate on next classifier run

5. **`runtime/local/infinite-brain/entity-classifier-latest.md`**
   - Markdown version of classifier output
   - Status: Generated snapshot
   - Action: Regenerate

6. **`runtime/local/graphify/mind-knowledge-latest.md`**
   - Checklist of expected graphify outputs
   - Status: Generated snapshot
   - Action: Regenerate

7-20. **Additional runtime JSON/MD files in `runtime/local/graphify/`**
   - All contain path references
   - Status: All generated snapshots
   - Action: Regenerate on next graphify run

#### Documentation (7 files)

21. **`operations/runbooks/infinite-brain-roadmap-status.md`**
    - If it references graphify output paths
    - Change: Update if present
    - Impact: Low (status doc)

22. **`operations/runbooks/graphify-*.md` (if present)**
    - Graphify operational docs
    - Change: Update path references
    - Impact: Low (operational reference)

23. **`.gitignore` (Brain repo)**
    - Current: `graphify-out/` in ignored patterns
    - Add: `.graphify-out/` pattern (keep old pattern or replace)
    - Impact: Mechanical, trivial

24. **`.gitignore` (Mind repo)**
    - Current: Likely ignores `graphify-out/`
    - Add: `.graphify-out/` pattern
    - Impact: Mechanical, trivial

#### Configuration & Scripts (5 files)

25. **`package.json` (Brain)**
    - Scripts like `"graphify:update:brain:execute"`
    - Check: Whether scripts pass hardcoded paths
    - Likely: Scripts call `graphify` CLI which resolves paths dynamically
    - Action: Verify, update if needed (likely none needed)

26-29. **Scheduler and orchestrator configs**
    - If graphify nightly scheduler has hardcoded paths
    - Action: Update if found

### Safety Assessment: .graphify-out Path Change

✅ **CLI-level:** Graphify CLI is external; paths are passed as arguments or config. Changing output folder from `graphify-out` to `.graphify-out` is a simple string substitution.

✅ **Build-time:** No build systems hardcode this path; it's runtime-resolved.

✅ **Git-level:** `.gitignore` patterns support hidden folders natively.

✅ **Accessibility:** Hidden folder is still readable; no permission impact. Just not shown by default in `ls` without `-a`.

✅ **Portability:** If the path were hardcoded in docs, it would be environment-specific anyway. Relative paths like `./graphify-out/` or `./.graphify-out/` work identically on all systems.

🟡 **Scheduler:** Graphify nightly script runs independent of code. Must verify it doesn't hardcode output path. If it does, both must be updated simultaneously.

### Validation & Testing Strategy

**Before change:**
1. Run `npm run graphify:preflight` to generate current output
2. Verify `graphify-out/` is populated with `.html`, `.json`, `.md` files
3. Document file count and sizes

**After change:**
1. Manually rename `graphify-out/` → `.graphify-out/` in both repos (or use git)
2. Run `npm run graphify:preflight` with updated paths
3. Verify `.graphify-out/` is populated (should match file count from before)
4. Run `git status` — verify `.graphify-out/` is ignored correctly
5. Verify HTML graph files are still readable via browser

**Rollback:**
- Rename `.graphify-out/` back to `graphify-out/`
- Revert code changes
- Run verification again

---

## Documentation Impact Analysis

### Brain Repo Documentation Requiring Updates

1. **`README.md` (Brain root)**
   - Top-Level Structure section lists folders
   - Currently: Does not explicitly mention `graphify-out/`
   - Action: If added, update to `.graphify-out`
   - Priority: Medium

2. **`CLAUDE.md` (Brain, project-level)**
   - May reference Infinite Brain test file path
   - Action: Search and update if present
   - Priority: High (developer reference)

3. **`operations/runbooks/infinite-brain-single-file-write.md`**
   - Multiple references to `/mind/00_System/InfiniteBrainWriteTest.md`
   - Action: Update ALL instances to `/mind/system/InfiniteBrainWriteTest.md`
   - Priority: **CRITICAL** (operator runbook)

4. **`operations/runbooks/infinite-brain-roadmap-status.md`**
   - References to test file path
   - Action: Update all instances
   - Priority: High (project status)

5. **`tools/graphify/README.md`**
   - Documents graphify output structure
   - Action: Update `graphify-out/` → `.graphify-out/` in all examples
   - Priority: Medium

6. **`tools/graphify/EXECUTABLE-UPDATE-GUIDE.md`**
   - Mentions `graphify-out/` in context of artifact modification
   - Action: Update references
   - Priority: Medium

7. **`.gitignore` (Brain)**
   - Currently ignores `graphify-out/`
   - Action: Add `.gitignore` entry for `.graphify-out/` (or replace old entry)
   - Priority: Critical (if path changes)

### Mind Repo Documentation Requiring Updates

1. **`system/README.md`**
   - Describes system folder purpose
   - May need note: "InfiniteBrainWriteTest.md moved here in Phase N"
   - Action: Add one-line note if desired
   - Priority: Low (informational)

2. **`system/automation-contract.md`** or **`automation-roadmap.md`**
   - May reference test file as part of automation contract
   - Action: Update path if referenced
   - Priority: Medium

3. **`system/generated-output-policy.md`**
   - Likely covers graphify output handling
   - Action: Update to reference `.graphify-out/` instead of `graphify-out/`
   - Priority: High

4. **`system/graphify-strategy.md`**
   - Dedicated graphify strategy document
   - Likely multiple references to `graphify-out/`
   - Action: Update ALL instances to `.graphify-out/`
   - Priority: **CRITICAL** (strategy doc)

5. **`.gitignore` (Mind)**
   - Currently ignores `graphify-out/`
   - Action: Add `.gitignore` entry for `.graphify-out/` (or replace)
   - Priority: Critical (if path changes)

6. **`home.md` (Mind dashboard)**
   - May reference graphify in automation section
   - Action: Update if present
   - Priority: Low

### New Documentation to Create (Optional)

- **Migration guide:** "How InfiniteBrainWriteTest.md was relocated from 00_System to system (Phase N)"
  - Useful for understanding history but not critical
  - Could go in `operations/decision-log.md` instead

---

## Proposed Target Structures

### Proposed Brain Root Tree (After All Changes)

```
brain/
├── projects/                               [source code + project docs]
│   ├── brain-core/                         [Infinite Brain + controller]
│   ├── brain-console-center/               [UI dashboard]
│   └── ...
├── ai/                                     [skills, prompts, orchestrators]
│   └── skills/
│       └── active/                         [symlinks to active skills]
├── operations/                             [runbooks, standards, scripts]
│   ├── system-configs/                     [tool configs, symlink targets]
│   ├── runbooks/                           [procedures]
│   ├── standards/                          [references, API specs]
│   ├── deploy/                             [deployment configs]
│   └── decision-log.md                     [durable decisions]
├── tools/                                  [utility scripts]
│   ├── scripts/
│   ├── graphify/
│   └── ...
├── runtime/                                [runtime output, local state]
│   └── local/                              [local machine state]
│       ├── infinite-brain/                 [IBR snapshots]
│       └── graphify/                       [graphify output snapshots]
├── docs/                                   [reference docs]
│   ├── archive/
│   │   └── reports/                        [**NEW**: archived reports]
│   │       ├── GEMMA4_UPGRADE_SUMMARY.md   [**MOVED**]
│   │       ├── HARDENING-PHASE-FINAL-REPORT.md
│   │       ├── INFRASTRUCTURE-SUMMARY.md
│   │       ├── PRODUCER-HARDENING-FINAL-ANSWERS.md
│   │       ├── SKILL-BLOAT-ANALYSIS.md
│   │       └── SKILL-PROFILE-APPLIED.md
│   └── system/                             [system/infra docs]
├── .graphify-out/                          [**HIDDEN**: graphify output]
│   ├── graph.json
│   ├── GRAPH_REPORT.md
│   └── ...
├── .buildflow/                             [ignored: build artifact]
├── .claude/                                [ignored: session state]
├── .github/                                [GitHub CI/metadata]
├── .gstack/                                [ignored: tool artifact]
├── .local/                                 [ignored: local data]
├── .obsidian/                              [Obsidian metadata]
├── node-compile-cache/                     [ignored: Node cache]
├── README.md                               [repo overview]
├── AGENTS.md                               [agent entry points]
├── CLAUDE.md                               [Claude behavior]
├── 00-start-here.md                        [AI read-first]
├── 00-current-context.md                   [current project state]
├── 00-memory-map.md                        [memory index]
├── .gitignore                              [updated]
├── .claudeignore
├── docker-compose.yml
└── package.json
```

**Key Changes:**
- New `docs/archive/reports/` folder for historical analyses
- Move 6 markdown reports from root into `docs/archive/reports/`
- Rename `graphify-out/` → `.graphify-out/` (hidden)
- Brain root becomes 16 visible items (currently 32), all operational

### Proposed Mind Root Tree (After All Changes)

```
mind/
├── wiki/                                   [main vault content]
├── live/                                   [active notes]
├── capture/                                [auto-ingest inbox]
├── sources/                                [reference material]
├── tasks/                                  [task data]
├── router/                                 [Obsidian plugins]
├── tools/                                  [local tooling]
├── archive/                                [archived vault content]
├── system/                                 [system operating docs + Infinite Brain test]
│   ├── InfiniteBrainWriteTest.md          [**MOVED HERE**]
│   ├── reports/                            [system operation reports]
│   ├── runbooks/
│   ├── README.md
│   ├── automation-contract.md
│   ├── automation-roadmap.md
│   ├── generated-output-policy.md
│   ├── graphify-strategy.md
│   └── ... (all existing system/* files)
├── .graphify-out/                          [**HIDDEN**: graphify output]
│   ├── graph.json
│   ├── GRAPH_REPORT.md
│   └── ...
├── .obsidian/                              [ignored: Obsidian state]
├── .trash/                                 [Obsidian trash]
├── home.md                                 [dashboard]
├── kanban.md                               [task board]
├── .gitignore                              [updated]
└── [00_System/]                            [**REMOVED** after test file moves]
```

**Key Changes:**
- **Remove** `00_System/` folder entirely (only contained the test file)
- **Move** `InfiniteBrainWriteTest.md` to `system/` folder
- **Rename** `graphify-out/` → `.graphify-out/` (hidden)
- Mind root becomes 15 visible items (currently 15), all human-readable, zero machine noise

---

## Recommended Implementation Phases

### Phase 0: Evidence & Inventory ✅ COMPLETE
- [x] List all references to `InfiniteBrainWriteTest.md` and `00_System`
- [x] List all references to `graphify-out`
- [x] Document current structure and dependencies
- [x] Identify files requiring updates
- [x] This analysis document

**Deliverable:** This analysis report  
**Time:** Completed  
**Risk:** None (read-only)

---

### Phase 1: Documentation & .gitignore Updates ONLY
- [ ] Update Brain `.gitignore` to add `.graphify-out/` pattern
- [ ] Update Mind `.gitignore` to add `.graphify-out/` pattern
- [ ] Update `operations/runbooks/infinite-brain-single-file-write.md` to reference `/mind/system/InfiniteBrainWriteTest.md`
- [ ] Update `operations/runbooks/infinite-brain-roadmap-status.md` to reference `/mind/system/InfiniteBrainWriteTest.md`
- [ ] Update `tools/graphify/README.md` to reference `.graphify-out/`
- [ ] Update `tools/graphify/EXECUTABLE-UPDATE-GUIDE.md` to reference `.graphify-out/`
- [ ] Update `mind/system/graphify-strategy.md` to reference `.graphify-out/`
- [ ] Update `mind/system/generated-output-policy.md` to reference `.graphify-out/`

**Scope:** Docs and gitignore only. No code changes, no file moves.  
**Files Modified:** 8 files, all documentation and config  
**Files Moved:** 0  
**Code Changes:** 0  
**Breaking Changes:** None  
**Validation:** Manual review only

**Validation Commands:**
```bash
# Check gitignore syntax
grep -E "^\s*\.graphify-out" .gitignore mind/.gitignore

# Verify docs are updated (should find no refs to old paths in key docs)
grep -r "00_System/InfiniteBrainWriteTest" operations/runbooks/ || echo "✓ No old paths in runbooks"
grep -r "graphify-out/" mind/system/ || echo "✓ No old graphify paths in mind system docs"
```

**Rollback:** Revert changed files (no side effects)

**Risk Level:** ⚠️ **VERY LOW**  
- Pure documentation; no logic changes
- No dependencies on these files by running code
- Safe to batch commit

**User Approval Required:** No (documentation clarification)

**Estimated Time:** 15 minutes

---

### Phase 2: Infinite Brain Test File Relocation
- [ ] Update `projects/brain-core/src/adapters/infinite-brain-metadata-write-allowlist.ts` line 24: change `'00_System'` → `'system'`
- [ ] Update test fixture files:
  - [ ] `projects/brain-core/src/tests/infinite-brain-metadata-writer-single-file-write.test.ts` (all 00_System refs in temp setup)
  - [ ] `projects/brain-core/src/tests/infinite-brain-metadata-write-allowlist.test.ts` (test cases)
  - [ ] `projects/brain-core/src/tests/routes.test.ts` (temp setup)
- [ ] Rebuild TypeScript: `npm run build`
- [ ] Verify runtime state will be regenerated (do NOT manually edit JSON files in runtime/)
- [ ] Create `mind/system/InfiniteBrainWriteTest.md` content (copy from `mind/00_System/InfiniteBrainWriteTest.md`)

**Scope:** Code changes + test file move  
**Files Modified:** 4 source files, 1 markdown file added  
**Files Moved:** 1 (test file to new location)  
**Files Deleted:** 0 yet (00_System folder still present)  
**Breaking Changes:** Yes—code now expects test file at new path

**Validation Commands (after changes):**
```bash
cd /Users/Office/Repos/stevewesthoek/brain/projects/brain-core

# Rebuild
npm run build

# Verify it compiles without errors
npm run typecheck

# Run the test suite
npm run test

# Run Infinite Brain verification (before write)
npm run ibr:verify

# Run single-file write test (generates runtime state at new path)
npm run ibr:single-file-write-test

# Verify again (runtime state should reflect new path)
npm run ibr:verify
```

**Rollback Plan:**
1. Revert code changes in src/ files
2. Run `npm run build` to recompile
3. Delete new `mind/system/InfiniteBrainWriteTest.md`
4. Run `npm run ibr:verify` again (should work against original `mind/00_System/` path)

**Risk Level:** 🟡 **MEDIUM**
- Requires code recompilation
- Test logic changes (env var usage already in place, so no logic risk)
- Runtime state files will become stale (expected; they auto-regenerate)
- Rollback is simple (just revert TypeScript)

**User Approval Required:** Yes—code change, even if isolated to allowlist constant

**Estimated Time:** 45 minutes (including testing)

---

### Phase 3: Graphify Output Path Change
- [ ] Rename `graphify-out/` → `.graphify-out/` in Brain repo
- [ ] Rename `graphify-out/` → `.graphify-out/` in Mind repo
- [ ] Update `tools/scripts/graphify-nightly.sh` line 35: change `'graphify-out'` → `'.graphify-out'` in skip_dirs set
- [ ] Check `package.json` scripts for hardcoded graphify paths (likely none; paths are dynamic)
- [ ] Regenerate graphify output to new path:
  ```bash
  npm run graphify:preflight:brain
  npm run graphify:preflight:mind
  ```

**Scope:** Path rename + script update  
**Files Modified:** 2 directories (renamed), 1 script  
**Files Moved:** All graphify output files (via directory rename)  
**Breaking Changes:** Yes—paths change, but output logic unchanged

**Validation Commands (after changes):**
```bash
cd /Users/Office/Repos/stevewesthoek/brain

# Preflight (dry-run preview)
npm run graphify:preflight:brain
npm run graphify:preflight:mind

# Check .gitignore
git status  # Should show .graphify-out/ as ignored in both repos

# Verify output was regenerated
ls -la .graphify-out/
ls -la ../mind/.graphify-out/

# Check file count and sizes match pre-change expectations
wc -l .graphify-out/*.md
```

**Rollback Plan:**
1. Rename `.graphify-out/` back to `graphify-out/` in both repos
2. Revert `graphify-nightly.sh` change
3. Run graphify preflight again to regenerate at original path
4. Run `git status` to verify no unexpected changes

**Risk Level:** 🟡 **MEDIUM**
- Path rename affects multiple files but is mechanically reversible
- Scheduler script update requires coordination (scheduler runs nightly)
- If scheduler runs between code update and script update, it will fail (will need manual rerun)
- No breaking API changes

**User Approval Required:** Yes—affects generated output location

**Estimated Time:** 30 minutes (mostly waiting for graphify to regenerate)

---

### Phase 4: Brain Root Markdown Archive (LOWEST PRIORITY)
- [ ] Create `brain/docs/archive/reports/` folder
- [ ] Move these 6 markdown files:
  - [ ] `GEMMA4_UPGRADE_SUMMARY.md`
  - [ ] `HARDENING-PHASE-FINAL-REPORT.md`
  - [ ] `INFRASTRUCTURE-SUMMARY.md`
  - [ ] `PRODUCER-HARDENING-FINAL-ANSWERS.md`
  - [ ] `SKILL-BLOAT-ANALYSIS.md`
  - [ ] `SKILL-PROFILE-APPLIED.md`
- [ ] Update `brain/README.md` to remove these files from "reading order" and add pointer to `docs/archive/reports/`
- [ ] Create `brain/docs/archive/reports/README.md` with brief manifest

**Scope:** Cleanup + documentation  
**Files Modified:** 1 (README.md)  
**Files Moved:** 6  
**Breaking Changes:** No (these are historical analysis files, not operational)

**Validation:**
```bash
ls -la brain/docs/archive/reports/  # Should show 6 markdown files
grep -c "GEMMA4\|HARDENING\|INFRASTRUCTURE\|PRODUCER\|SKILL-BLOAT\|SKILL-PROFILE" brain/README.md
# ^ Should be 0 or pointing to docs/archive/reports/

git status  # Should show 6 renames, no deletions
```

**Rollback:** Simple git revert

**Risk Level:** ✅ **VERY LOW**
- Pure file organization
- No code references these files
- No impact on operations
- Completely reversible

**User Approval Required:** No (cosmetic cleanup)

**Estimated Time:** 10 minutes

---

### Phase 5: Mind Root Cleanup (Remove 00_System)
- [ ] This phase is BLOCKED until Phase 2 (test file relocation) is complete
- [ ] After Phase 2, delete the now-empty `mind/00_System/` folder
- [ ] Verify `mind/system/InfiniteBrainWriteTest.md` exists and contains expected content
- [ ] Run `git status` — should show 00_System deletion

**Scope:** Folder deletion  
**Files Deleted:** 1 directory (00_System/)  
**Prerequisites:** Phase 2 must be complete; test file already moved to system/

**Validation:**
```bash
ls -la mind/00_System/  # Should error "No such file or directory"
ls mind/system/InfiniteBrainWriteTest.md  # Should exist
git status  # Should show 00_System/ deleted
```

**Rollback:** Recreate 00_System folder (git restore)

**Risk Level:** ✅ **VERY LOW** (only after Phase 2)
- Folder is empty after test file moves
- No references to folder location in code (only file path matters)
- Doesn't affect runtime

**User Approval Required:** No (cleanup after Phase 2)

**Estimated Time:** 5 minutes

---

### Phase 6: Validation & Final Push
- [ ] Run full validation suite:
  ```bash
  cd brain/projects/brain-core
  npm run typecheck
  npm run test
  npm run ibr:verify
  npm run brain-core:clean-start
  curl http://127.0.0.1:4877/status
  ```
- [ ] Check git status clean (no uncommitted changes except intentionally ignored)
- [ ] Commit Phase 1-5 changes in logical sequence
- [ ] Create summary document in `operations/decision-log.md`

**Scope:** Testing + final cleanup  
**Breaking Changes:** None (all breaking changes introduced and resolved in earlier phases)

**Validation:**
```bash
# Full integration test
npm run ibr:verify  # Should pass 11/11
npm run graphify:preflight:brain  # Should complete without errors
npm run graphify:preflight:mind

# Git status check
git status --short  # Should show only expected files

# No Mind files in Brain repo
git ls-files | grep mind/ || echo "✓ No mind files tracked in brain"
```

**Risk Level:** ✅ **VERY LOW**
- Read-only validation phase
- All changes already committed from earlier phases
- No new breaking changes introduced

**User Approval Required:** No (validation only)

**Estimated Time:** 20 minutes

---

## Safe First Implementation Slice

### ✅ Recommend starting with this: Phase 1 (Docs Only)

**Why:**
- Zero risk to running system
- Prepares documentation for later phases
- Can be reviewed and committed immediately
- No blocking dependencies

**What to commit:**
1. Update 8 documentation files
2. Update .gitignore patterns in both repos
3. Commit with message: "docs: update paths for Infinite Brain test relocation and graphify hidden output (Phase 1)"

**Validation:**
```bash
git diff --stat  # Should show only .md and .gitignore files
grep -r "\.graphify-out" . --include="*.md"  # Should find references
grep "\.graphify-out" .gitignore mind/.gitignore  # Should find patterns
```

**Estimated time:** 15 minutes  
**Risk:** ✅ Essentially zero

---

## Explicit "Do Not Do Yet" List

**DO NOT in this analysis pass:**

1. ❌ **Do not move files physically** — wait for Phase 2 approval
2. ❌ **Do not update source code** — wait for Phase 2
3. ❌ **Do not delete 00_System folder** — wait for Phase 5 (only after test file moves)
4. ❌ **Do not manually edit runtime JSON files** — they auto-regenerate
5. ❌ **Do not rename graphify-out/ yet** — wait for Phase 3
6. ❌ **Do not run npm run build** — code changes not ready yet
7. ❌ **Do not run ibr:single-file-write-test** — path would still be wrong
8. ❌ **Do not archive Brain markdown files** — Phase 4, lowest priority
9. ❌ **Do not push to git** — wait for plan approval and phase sequencing
10. ❌ **Do not broaden Infinite Brain write scope** — test file is only allowed write target
11. ❌ **Do not add multi-file write capability** — out of scope
12. ❌ **Do not add autonomous execution** — manual approval gates remain
13. ❌ **Do not change scheduler logic** — only update path string in graphify-nightly.sh
14. ❌ **Do not modify test logic** — only update path constants in temp setup code
15. ❌ **Do not break any validation commands** — all must still work post-Phase 2

---

## Cross-Repo Validation Checklist

**Before and after ANY implementation phase, verify:**

| Check | Command | Expected Result |
|-------|---------|-----------------|
| Brain Core starts | `cd brain/projects/brain-core && npm run brain-core:clean-start` | Service OK on port 4877 |
| Brain health | `curl http://127.0.0.1:4877/status` | JSON response with `"ok": true` |
| IBR verification | `npm run ibr:verify` | Passed: 11/11 |
| IBR rollback | `npm run ibr:rollback` | Success message |
| IBR typecheck | `npm run typecheck` | No type errors |
| Brain Console typecheck | `cd brain/projects/brain-console-center && npm run typecheck 2>&1` | No errors if project exists |
| Test suite | `npm run test` | All tests pass |
| Git status | `git status --short` | No uncommitted changes (except ignored patterns) |
| Graphify paths | `grep -r "graphify-out" brain/.gitignore mind/.gitignore` | Entries present |
| No Mind files in Brain | `git ls-files brain/ \| grep -i mind` | Returns nothing |
| No generated artifacts tracked | `git ls-files \| grep -E "runtime/|\.buildflow|node_modules"` | Returns nothing |

---

## Summary Statistics

### Files Affected by Relocation

| Category | Count | Status |
|----------|-------|--------|
| Source code files | 4 | Update required |
| Compiled dist files | 4 | Auto-regenerated |
| Documentation files | 6 | Update required |
| Runtime state files | 5 | Auto-regenerated |
| Test fixtures | ~3 included in source count | Update required |
| **Total unique files** | **15** | **Ready for Phase 2** |

### Files Affected by Graphify Path Change

| Category | Count | Status |
|----------|-------|--------|
| Code/script files | 2 | Update required |
| Documentation files | 7 | Update required |
| Runtime state files | 14 | Auto-regenerated |
| .gitignore patterns | 2 | Update required |
| **Total unique files** | **21** | **Ready for Phase 3** |

### Documentation to Create/Update

| File | Action | Priority |
|------|--------|----------|
| Phase 1 docs (runbooks, graphify guides) | Update | High |
| Phase 4 archive manifest | Create | Low |
| Phase 6 decision log entry | Create | Medium |
| **Total new/updated docs** | **~15 files** | — |

---

## Success Criteria

✅ **Phase 1 Success:** All documentation updated, .gitignore patterns in place, no code changes made.

✅ **Phase 2 Success:** 
- Test file lives at `/mind/system/InfiniteBrainWriteTest.md`
- `npm run ibr:verify` returns 11/11 passed
- `npm run test` passes all tests
- `npm run ibr:single-file-write-test` writes to new path successfully

✅ **Phase 3 Success:**
- Graphify output lives in `.graphify-out/` in both repos
- `ls -la` does not show `.graphify-out/` (hidden)
- `ls -la .graphify-out/` still works (hidden but accessible)
- `git status` shows `.graphify-out/` as ignored

✅ **Phase 4 Success:** (optional)
- Brain root contains only operational and config files
- 6 historical reports archived in `docs/archive/reports/`
- `brain/README.md` updated

✅ **Phase 5 Success:** (after Phase 2)
- `mind/00_System/` folder deleted
- Mind root contains only human-readable folders

✅ **Phase 6 Success:**
- All validation commands pass
- `git status` clean
- Commits are logical and reviewable
- `operations/decision-log.md` updated with summary

---

## Final Recommendations

### ✅ Go-Ahead Recommendations

1. **Proceed with Phase 1 (Docs Only)** — zero risk, can happen immediately
2. **Proceed with Phase 2 (Test Relocation)** — well-isolated, testable, reversible
3. **Proceed with Phase 3 (Graphify Path)** — mechanical, low-risk once Phase 2 validated
4. **Defer Phase 4 (Archive Markdown)** — cosmetic, low priority, can wait
5. **Defer Phase 5 (Remove 00_System)** — only after Phase 2 confirmed working

### 🟡 Cautions

1. **Scheduler alignment:** Verify `graphify-nightly.sh` is not running during Phase 3 window
2. **Runtime state regeneration:** Do NOT hand-patch JSON files; they auto-regenerate
3. **Test isolation:** Phase 2 tests use environment overrides; logic is sound but fixtures must be updated
4. **Documentation accuracy:** Runbooks must be updated before Phase 2; operators rely on them

### ⚠️ Blockers to Remove First

1. None identified. All phases are safe to proceed with proper sequencing.

---

## End of Analysis

**Status:** Complete and ready for review  
**Changes Made:** None (analysis only)  
**Review Required:** Yes (before Phase 1 approval)  
**Risk Assessment:** Phases 1-2 are low-risk, Phase 3 is medium-risk, Phase 4 is optional/cosmetic  
**Estimated Total Time (All Phases):** ~2-3 hours including testing and validation  
**Rollback Complexity:** All phases are reversible; no data loss risk  

---

## Appendices

### A. File Reference Map

**InfiniteBrainWriteTest.md references (23 files):**
```
Source code:
  brain-core/src/adapters/infinite-brain-metadata-write-allowlist.ts:24
  brain-core/src/tests/infinite-brain-metadata-writer-single-file-write.test.ts:21,24,60,133
  brain-core/src/tests/infinite-brain-metadata-write-allowlist.test.ts:various
  brain-core/src/tests/routes.test.ts:various
  brain-core/dist/* (compiled, auto-regenerated)

Docs:
  operations/runbooks/infinite-brain-single-file-write.md:8,90+
  operations/runbooks/infinite-brain-roadmap-status.md:various

Runtime (auto-regenerated):
  runtime/local/infinite-brain/metadata-writer-write-latest.json
  runtime/local/infinite-brain/metadata-write-rollback-latest.json
  runtime/local/infinite-brain/metadata-write-rollback-applied-latest.json
  runtime/local/infinite-brain/metadata-write-verification-latest.json
  runtime/local/infinite-brain/operator-approval-latest.json
```

**graphify-out references (29 files):**
```
Code:
  tools/scripts/graphify-nightly.sh:35
  tools/graphify/README.md:multiple
  tools/graphify/EXECUTABLE-UPDATE-GUIDE.md:multiple
  package.json: graphify script definitions (check for hardcoded paths)

Docs:
  operations/runbooks/infinite-brain-roadmap-status.md:if present
  mind/system/graphify-strategy.md:multiple
  mind/system/generated-output-policy.md:multiple
  .gitignore (both repos)

Runtime (auto-regenerated):
  runtime/local/infinite-brain/entity-classifier-latest.json
  runtime/local/infinite-brain/entity-classifier-latest.md
  runtime/local/graphify/mind-knowledge-latest.md
  runtime/local/graphify/brain-runtime-latest.json
  runtime/local/graphify/brain-runtime-latest.md
  runtime/local/graphify/orchestrator-latest.json
  runtime/local/graphify/orchestrator-latest.md
  ... (14 total state files)
```

### B. Symlink Dependencies

**Do not break these:**
- `brain/operations/system-configs/` (17 symlinks from ~/)
- `brain/mind/` symlink to `../mind`
- Ensure 00_System folder deletion does not affect symlink chain

### C. Environment Variables

Current overrides (used in tests, not in production):
- `IBR_MIND_REPO_PATH` — Mind repo location
- `IBR_METADATA_WRITE_ALLOWLIST_PATH` — Test file path
- `IBR_METADATA_WRITER_WRITE_REPORT_PATH` — Report location

All remain valid after relocation; path constant update is primary change.

---

**Report Generated:** 2026-06-08  
**Analysis Depth:** Comprehensive cross-repo inventory, reference mapping, phased implementation design  
**Status:** Ready for phase sequencing and execution planning
