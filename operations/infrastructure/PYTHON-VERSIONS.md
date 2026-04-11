# Python Version Strategy

**Status:** Temporary dual-version setup (WILL be consolidated)  
**Updated:** 2026-04-11  
**Author:** Claude Code (Haiku 4.5)

## Executive Summary

This system currently runs **two Python versions**:
- `python3 → 3.14.3` (system default, all brain automation)
- `python3.13.12` (isolated venv for Google Ads API only)

**This is a temporary workaround, NOT the long-term design.** When the upstream ecosystem (protobuf + google-ads) releases Python 3.14-compatible versions, we will consolidate back to a single Python version.

## Why We Have Two Versions

### Root Cause: Protobuf Metaclass Incompatibility

Python 3.14 introduced stricter C extension validation that breaks protobuf's `google._upb._message` module:

```
TypeError: Metaclasses with custom tp_new are not supported.
```

This error occurs during:
```python
from google.ads.googleads.client import GoogleAdsClient
```

**Stack trace location:** `google/protobuf/internal/api_implementation.py` line 51, when trying to import `google._upb._message`.

**Root issue:** The upb (micro protobuf) C extension uses a metaclass pattern incompatible with Python 3.14's C extension changes.

### Why We Can't Just Use Python 3.13 Everywhere

Because the brain repository's automation infrastructure was optimized for Python 3.14's features and the system default should stay current. Downgrading the entire system would:

1. Block adoption of Python 3.14's performance improvements
2. Require updating all shell scripts to pin python3.13
3. Create maintenance burden for future versions

### Why This Temporary Solution Works

Instead of a system-wide downgrade, we use an **isolated virtual environment**:

- Python 3.14 remains the system default (`python3`)
- Brain automation scripts run on Python 3.14 (no changes needed)
- Google Ads gets its own venv with Python 3.13
- The `run.sh` wrapper activates the correct environment automatically
- Zero conflicts, zero manual version juggling

## Current Architecture

```
/opt/homebrew/bin/
├── python3 → python3.14.3 (system default, used by all brain scripts)
├── python3.13 (used ONLY by google-ads venv)
├── python3.12 (unused, kept for rollback)
└── python3.14

tools/google-ads/.venv/
└── bin/python3 → python3.13.12 (activated by run.sh)
    └── Site-packages: google-ads==20.0.0, protobuf==4.25.9, etc.
```

## How to Use

**Google Ads commands** (automatic venv activation):
```bash
bash tools/google-ads/run.sh sync     # Uses Python 3.13 internally
bash tools/google-ads/run.sh doctor   # Uses Python 3.13 internally
bash tools/google-ads/run.sh report   # Uses Python 3.13 internally
```

**Brain automation** (uses system default python3):
```bash
python3 tools/scripts/brain-auto-router.py      # Python 3.14
python3 tools/scripts/brain-kanban-syncer.py    # Python 3.14
python3 tools/scripts/brain-project-decomposer.py  # Python 3.14
```

**Manual testing** (if needed):
```bash
python3.13 --version       # Check 3.13 availability
python3.14 --version       # Check 3.14 availability
python3 --version          # Verify default
```

## Migration Plan: Getting Back to One Version

### Upstream Dependencies to Monitor

1. **protobuf** — Current: 4.25.9 (3.14 broken, waiting for 5.x+ fix)
   - Next: protobuf 5.27+ may have upstream fix
   - Check: `pip show protobuf` for latest version
   - Migration trigger: When protobuf 5.x declares Python 3.14 support

2. **google-ads** — Current: 20.0.0
   - Depends on: protobuf<5.0.0dev (constraint prevents protobuf 5.x)
   - Next: google-ads 21.0+ may drop protobuf v4 constraint
   - Check: `pip search google-ads` (when available) or PyPI

3. **proto-plus** — Current: 1.22.3
   - Depends on: protobuf<5.0.0dev (same constraint as google-ads)
   - Blocks: Protobuf 5.x adoption

### How to Test for Upgrade Readiness

When Python 3.15 or newer protobuf versions arrive:

```bash
# Step 1: Create test venv
python3.14 -m venv /tmp/test-google-ads-3.14

# Step 2: Try to install latest
source /tmp/test-google-ads-3.14/bin/activate
pip install --upgrade google-ads  # Will pull latest compatible versions

# Step 3: Test import
python3 -c "from google.ads.googleads.client import GoogleAdsClient; print('✓ Works!')"

# Step 4: If successful, rebuild main venv
rm -rf tools/google-ads/.venv
python3.14 -m venv tools/google-ads/.venv
source tools/google-ads/.venv/bin/activate
pip install -r tools/google-ads/requirements.txt
bash tools/google-ads/run.sh sync  # Test sync command
```

### Success Criteria for Consolidation

You can consolidate back to Python 3.14 when:

1. ✅ `pip install google-ads` succeeds with protobuf ≥5.0 on Python 3.14
2. ✅ `from google.ads.googleads.client import GoogleAdsClient` imports without errors
3. ✅ `bash tools/google-ads/run.sh sync` completes successfully with real API calls
4. ✅ All brain automation scripts still compile with Python 3.14

Then:
```bash
# Remove Python 3.13 venv
rm -rf tools/google-ads/.venv

# Create 3.14 venv
python3 -m venv tools/google-ads/.venv
source tools/google-ads/.venv/bin/activate
pip install -r tools/google-ads/requirements.txt

# Update requirements.txt if needed (remove setuptools<70 constraint if no longer needed)
# Test everything
bash tools/google-ads/run.sh sync
python3 tools/scripts/brain-auto-router.py --dry-run
```

## DO NOT Delete Python 3.13

**Until consolidation is complete**, keep Python 3.13 installed:

```bash
# ❌ WRONG - This breaks Google Ads:
brew uninstall python@3.13

# ✅ CORRECT - Keep 3.13 until protobuf ecosystem fixes 3.14:
brew list | grep python  # See all installed versions
python3.13 --version    # Verify it's there
```

If accidentally removed, reinstall:
```bash
brew install python@3.13
```

## Documentation for Future Maintainers

### When You See Python 3.13

1. **Don't delete it** — It's intentionally isolated for Google Ads
2. **Don't use it for other projects** — Isolation is the point
3. **Check upgrade readiness** — Follow the "Migration Plan" section above
4. **Ask yourself:** "Have protobuf and google-ads released Python 3.14-compatible versions?"

### When You Upgrade Python

1. **Test google-ads** — See "How to Test for Upgrade Readiness" above
2. **If test passes** — Start consolidation (rebuild venv with new version)
3. **If test fails** — Keep current setup, wait for upstream fix

### When You Add New Python Scripts

- Use `#!/usr/bin/env python3` (no version pin)
- All new scripts should be Python 3.14 compatible
- Only Google Ads operations use the 3.13 venv
- Test with both versions to ensure portability

## Technical Details

### Why This Specific Python 3.13 Version?

Python 3.13.12 was selected because:
1. It's the latest 3.13.x patch (security + stability)
2. Protobuf 4.25.9 is fully compatible
3. It predates the 3.14 C extension changes
4. Upgrade path is clear (3.13 → 3.14 once protobuf fixes)

### Dependency Versions (google-ads/.venv)

```
setuptools<70              # Avoids pkg_resources conflicts
protobuf>=4.21.0,<5.0.0   # Latest v4 (v5 has different API)
grpcio>=1.50.0,<2.0.0     # gRPC for API calls
google-ads>=19.0.0,<21.0  # Latest stable
```

These constraints are documented in `tools/google-ads/requirements.txt`.

### Why Not Use Docker?

Docker would work, but adds complexity:
- Container overhead for a simple venv
- Credential management complexity
- Nightly scheduler already has OS-level automation
- Venv is simpler and faster for this use case

## References

- **Protobuf Issue:** https://github.com/protocolbuffers/protobuf/issues/ (search for "Python 3.14 metaclass")
- **Python 3.14 Changes:** https://docs.python.org/3.14/whatsnew/3.14.html
- **Google Ads Library:** https://github.com/googleapis/google-ads-python

---

**Last Reviewed:** 2026-04-11  
**Next Review:** When Python 3.15 or protobuf 6.0 is released
