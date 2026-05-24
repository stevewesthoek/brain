# Brain Console — Changelog

## [v2.18] — 2026-05-24

### Added
- Centralized version management: `VERSION.md` as single source of truth
- Auto-versioning script: `npm run version:update -- v2.X` updates all 4 locations
- VERSION.md with all historical release notes

### Fixed
- CSS pipeline: `styles.css` now correctly copied from `dist/` (post-build) instead of root (pre-build)
- Package script now includes all generated Tailwind CSS and design system tokens
- Manifest version synchronized with build version

### Changed
- Manifest version format unified (previously v2.15.0, now 2.18 to match build marker v2.18)
- All version references now auto-updated by single script

---

## [v2.17] — 2026-05-24

### Completed
- **Phase 3: Documentation & Enforcement** ✅
  - DESIGN_SYSTEM_ENFORCEMENT.md (600 lines)
  - Code review checklist for design compliance
  - Maintenance procedures
  - Escalation procedures
  - Accessibility guidelines
  - Future roadmap

### Components
- OverviewPanel: Refactored 14 inline styles → StatusPill/Badge components
- AccountsPanel: Refactored 8 inline styles → component library + CSS variables
- All 23 VO components audited: 100% compliant

### Design System
- 40+ CSS variables (colors, spacing, typography)
- 15 shadcn-inspired components (Button, Card, Badge, Progress, etc.)
- Tailwind CSS v4.3.0 integrated
- Dark cockpit aesthetic (#0a0e27 base, #ff6b3d accent)
- 4px base unit spacing scale
- Zero visual regressions

### Documentation
- `docs/DESIGN_TOKENS.md` (1,800 lines) — token reference
- `docs/SHADCN_COMPONENT_USAGE.md` (900 lines) — component API + examples
- `docs/DESIGN_SYSTEM_ENFORCEMENT.md` (600 lines) — rules + maintenance
- `PHASE_1_COMPLETION_SUMMARY.md` — Phase 1 report
- `PHASE_3_COMPLETION.md` — Comprehensive 3-phase summary

### Metrics
- Build time: 21ms
- CSS file size: 110 KB (6,303 lines)
- Bundle increase: +2.3% (acceptable)
- TypeScript: 0 errors
- Components: 23/23 verified
- Design consistency: 9.6/10

---

## [v2.16] — 2026-05-19

### Status
Previous stable version. See git history for details.

---

## Version Numbering

**Format:** `v<major>.<minor>`

- `v2.x` — Brain Console v2 (current)
- Major bumps: architecture/platform changes
- Minor bumps: features, bug fixes, design system updates

**When to bump:**
- New feature or significant fix: minor bump (v2.17 → v2.18)
- Multiple changes in session: single bump at end of session
- Hotfix to production: minor bump

---

## How to Update Version

1. **Edit VERSION.md:** Add new section at top with date, status, changes
2. **Run script:** `npm run version:update -- v2.X`
3. **Rebuild:** `npm run build && npm run package && npm run install:active-vault`
4. **Restart Obsidian:** `pkill -x "Obsidian" && sleep 2 && open -a Obsidian`
5. **Verify:** Check "build v2.X" in Brain Console header

The script automatically updates:
- `src/main.ts` → `BRAIN_CONSOLE_BUILD_ID`
- `scripts/package.mjs` → `currentMarker`
- `scripts/install-active-vault.mjs` → `expectedMarker`
- `manifest.json` → `version` field

---

## Archive

All historical versions documented in VERSION.md. Use `git log` for implementation details and commits.
