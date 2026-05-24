# Brain Console Versions

## v2.18

**Date:** 2026-05-24  
**Status:** Current (in development)

### Changes
- Fixed CSS pipeline: styles.css now copied from dist/ (with design system) instead of root
- Design system tokens and component styles now properly bundled
- Manifest version synchronized with build version

---

## v2.17

**Date:** 2026-05-24  
**Status:** Previous

### Changes
- Phase 3 Complete: Design System Enforcement & Documentation
- Added DESIGN_SYSTEM_ENFORCEMENT.md with code review checklist
- All 23 VO components verified compliant (100% of problematic patterns eliminated)
- StatusPill and Badge components integrated into OverviewPanel and AccountsPanel
- Tailwind CSS and shadcn-inspired component library deployed

---

## v2.16

**Date:** 2026-05-19  
**Status:** Archive

### Changes
- Previous stable version

---

## Version Management

**Single source of truth:** `VERSION.md` (this file)

**When updating:**
1. Edit this file first (date, status, changes)
2. Run: `npm run version:update -- v2.X` (updates all 4 locations automatically)
3. Rebuild: `npm run build && npm run package && npm run install:active-vault`

**Locations auto-updated by `npm run version:update`:**
- `src/main.ts` → `BRAIN_CONSOLE_BUILD_ID`
- `scripts/package.mjs` → `currentMarker`
- `scripts/install-active-vault.mjs` → `expectedMarker`
- `manifest.json` → `version` field

---

## Archive

All historical versions and their release notes are documented above. Use `git log` for detailed implementation commits.
