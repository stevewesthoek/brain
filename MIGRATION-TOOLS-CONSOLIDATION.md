# Tools Consolidation Migration — April 16, 2026

## Summary

Successfully migrated all user-level tools from `~/tools/` to `brain/tools/` for centralized version control.

## What Moved

### 1. Firecrawl Web Scraping
- **From:** `~/tools/firecrawl/`
- **To:** `brain/tools/firecrawl/`
- **Files:** Complete Docker Compose setup, wrapper script, configuration
- **Why:** Local on-demand web scraping service used by `/firecrawl` skill across Claude Code, Codex, Gemini

### 2. Bank Statement Automation
- **From:** `~/tools/scripts/{bank-statement-login.js, test-ing-inspect.js, package.json}`
- **To:** `brain/tools/scripts/{bank-statement-login.js, test-ing-inspect.js, package.json}`
- **Why:** Playwright automation for monthly ING bank statement downloads, integrated with nightly scheduler

## What Changed

### Documentation Updated
1. **ai/skills/custom/firecrawl/SKILL.md** — 23 path updates
   - `~/tools/firecrawl/firecrawl-wrapper.sh` → `brain/tools/firecrawl/firecrawl-wrapper.sh`
   - Command examples and configuration references

2. **operations/runbooks/ing-statement-automation.md** — 2 path updates
   - Line 93: `~/tools/scripts/bank-statement-login.js` → `brain/tools/scripts/bank-statement-login.js`
   - Line 153: Testing command updated with new path

3. **operations/decision-log.md** — 2 path updates
   - Historical decision entries updated for accuracy

### Scripts — No Changes Needed
- `tools/scripts/run-ing-bank-statement-download.sh` — Already uses `$SCRIPT_DIR` (relative paths)
- `tools/firecrawl/firecrawl-wrapper.sh` — Already uses `$SCRIPT_DIR` (relative paths)
- `tools/scripts/office-nightly-scheduler.sh` — No change needed

## Testing Checklist

### Firecrawl
```bash
# Test wrapper health check
brain/tools/firecrawl/firecrawl-wrapper.sh health

# Test scraping
brain/tools/firecrawl/firecrawl-wrapper.sh scrape https://example.com

# View logs
tail -f brain/tools/firecrawl/logs/firecrawl.log
```

### Bank Statement Automation
```bash
# Test wrapper script
bash brain/tools/scripts/run-ing-bank-statement-download.sh

# Test full nightly scheduler
FORCE_RUN=1 bash brain/tools/scripts/office-nightly-scheduler.sh

# Check state
cat ~/.local/state/office-scheduler/ing-bank-statement-download.last

# View logs
tail -f ~/Library/Logs/office-scheduler/nightly.log
```

## Migration Impact

### ✅ No Breaking Changes
- Paths are now absolute in documentation
- Relative paths in scripts work in new location
- All references updated consistently
- Single source of truth: brain repository

### ⚠️ Manual Steps (Optional)
Old `~/tools/` folder can be deleted after verification:
```bash
rm -rf ~/tools/firecrawl/
rm -rf ~/tools/scripts/
```

The migration notice was left at `~/tools/MOVED-TO-BRAIN.txt`

## Rollback (If Needed)
If any issues arise, rollback procedure is documented in:
`operations/decision-log.md` — Search for "Rollback"

## Related Files
- Brain tools structure: `brain/tools/`
- Firecrawl skill: `brain/ai/skills/custom/firecrawl/SKILL.md`
- ING automation runbook: `brain/operations/runbooks/ing-statement-automation.md`
- Nightly scheduler: `brain/tools/scripts/office-nightly-scheduler.sh`
