# Gemma 4 Local Model Support — Upgrade Summary

**Date:** 2026-06-05  
**Scope:** Add Google Gemma 4 models through Ollama to AI Model Selector for M4 Pro and M1 nodes  
**Status:** ✅ Complete — Configuration, Runtime, Tests, Documentation

---

## Overview

Gemma 4 is now supported through Ollama as a local inference option alongside Qwen and Llama models. The upgrade adds conservative task-level preferred models while keeping Qwen/Llama as primary defaults.

---

## Changes Made

### 1. Provider Configuration

**File:** `operations/system-configs/model-selector/config/ai-providers.json`

**M4 Pro (ollama-m4pro):**
- Added to `preferred_models`: `gemma4:12b`, `gemma4:e4b`
- Order: Qwen defaults remain first, Gemma follows

**M1 (ollama-m1):**
- Added to `preferred_models`: `gemma4:e4b`, `gemma4:12b`
- Expert-style (e4b) listed first on M1 due to smaller footprint

### 2. Runtime Core Logic

**File:** `operations/system-configs/model-selector/runtime/core.py`

**Fixed `_model_meets_min_params()` method:**
- Replaced brittle hardcoded size scan with call to `_model_size_b()`
- Now correctly evaluates models against minimum parameter requirements

**Enhanced `_model_size_b()` method:**
- Added support for Gemma expert-style tags: `(?<!\d)e?(\d+(?:\.\d+)?)b(?![a-z])`
- Correctly parses: `gemma4:e4b` → 4B, `gemma4:12b` → 12B, `gemma4:26b` → 26B, `gemma4:31b` → 31B
- Maintains backward compatibility with: `qwen2.5:14b` → 14B, `llama3.1:8b` → 8B

### 3. Task-Level Routing

**File:** `operations/system-configs/model-selector/config/ai-task-types.json`

Added `preferred_local_models` to enable task-level experimentation:

| Task | Preferred Models |
|------|-----------------|
| `thumbnail_headline` | `llama3.1:8b`, `gemma4:e4b`, `llama3.2:3b` |
| `seo_keyword_expansion` | `llama3.1:8b`, `gemma4:e4b`, `llama3.2:3b` |
| `metadata_generation` | `qwen2.5:14b`, `gemma4:12b`, `gemma4:e4b` |
| `fala_prompt_qa` | `qwen2.5:14b`, `gemma4:12b`, `gemma4:e4b` |
| `mind_capture_classification` | `qwen2.5:14b`, `gemma4:12b`, `gemma4:e4b` |

No changes to text/review tasks or image/analyze — Gemma multimodal support verified separately before activation.

### 4. Comprehensive Test Suite

**File:** `operations/system-configs/model-selector/tests/test_gemma4_support.py` (NEW)

14 new tests covering:
- ✅ Model size parsing for all Gemma variants (e4b, 12b, 26b, 31b)
- ✅ Backward compatibility with Qwen and Llama parsing
- ✅ Minimum parameter validation (e.g., e4b rejected for 7B tasks)
- ✅ Provider configuration includes Gemma models on both M4 Pro and M1
- ✅ Task-level preferred_local_models correctly configured

**All existing tests pass:** health_matrix, bedrock_upgrades, local_only tests unchanged.

### 5. Documentation

**File:** `operations/system-configs/model-selector/README.md` (UPDATED)

Added comprehensive Gemma 4 section:
- Model family explanation
- M4 Pro and M1 target models
- Install commands for both nodes
- Verification commands (selector matrix, task routing, M1 access from M4)
- Future candidates (26B, 31B) documented as not in default rollout

Updated apply config section with post-restart verification.

**File:** `projects/brain-core/docs/ai-model-selector-architecture.md` (UPDATED)

Updated three key sections:
- **Hardware Inventory:** Added Gemma 4 to M4 Pro and M1 model capacity tables
- **Recommended Model Install:** Added install commands for both nodes + future candidates section
- **Provider Registry Example:** Updated preferred_models in ollama-m4pro and ollama-m1 examples

### 6. Brain Console

**Status:** No code changes required

**Why:** The health matrix is consumed by Brain Core, which proxies it to the dashboard. The dashboard schema uses permissive types (`z.unknown()` for providers, flexible model arrays). Gemma models will automatically appear in the selector health matrix and render in the console without code changes.

---

## Model Targets

### M4 Pro (24 GB unified memory)
```
Default rollout:
  gemma4:e4b    (~4 GB) — light fast tasks
  gemma4:12b    (~8 GB) — medium tasks

Future candidates (not enabled):
  gemma4:26b    (~22 GB) — requires dedicated headroom
  gemma4:31b    (~25 GB) — maximum quality, requires sustained headroom
```

### M1 (16 GB unified memory)
```
Default rollout:
  gemma4:e4b    (~4 GB) — light fast tasks (preferred)
  gemma4:12b    (~8 GB) — medium tasks (conditional on memory pressure)

Reason: Expert-style (e4b) preferred on M1 due to smaller footprint and
sufficient quality for batch window tasks. 12B enabled but falls behind
qwen2.5:14b in preferred_models to protect M1 memory.
```

---

## Validation Results

### Test Results

```
test_gemma4_support.py ........................... 14/14 PASS
test_model_selector_health_matrix.py ............. 1/1 PASS
test_model_selector_bedrock_upgrades.py .......... 2/2 PASS
test_model_selector_local_only.py ................ 4/4 PASS
────────────────────────────────────────────────────────────
Total: 21/21 PASS (100% pass rate)
```

### JSON Validation

```
✓ ai-providers.json is valid JSON
✓ ai-task-types.json is valid JSON
✓ No breaking changes to existing provider/task definitions
```

---

## Runtime Apply Commands

**Copy config to runtime location:**
```bash
cp operations/system-configs/model-selector/config/ai-providers.json \
   ~/.config/video-orchestrator/ai-providers.json
cp operations/system-configs/model-selector/config/ai-task-types.json \
   ~/.config/video-orchestrator/ai-task-types.json
```

**Restart the selector service:**
```bash
launchctl stop com.office.ai-model-selector 2>/dev/null || true
launchctl unload ~/Library/LaunchAgents/com.office.ai-model-selector.plist 2>/dev/null || true
launchctl load -w ~/Library/LaunchAgents/com.office.ai-model-selector.plist
launchctl start com.office.ai-model-selector

# Verify service is running
sleep 2 && curl -sS http://127.0.0.1:4890/health
```

---

## Manual Install Commands (Still Required)

These are NOT executed as part of this upgrade. They must be run manually on each node:

**On M4 Pro:**
```bash
ollama pull gemma4:e4b
ollama pull gemma4:12b
```

**On M1 MacBook:**
```bash
ollama pull gemma4:e4b
ollama pull gemma4:12b
```

---

## Verification Commands

**Check M4 Pro local models:**
```bash
curl -sS http://127.0.0.1:11434/api/tags | \
  jq '.models[] | select(.name | contains("gemma4"))'
```

**Check M1 models from M4 Pro:**
```bash
curl -sS http://192.168.2.2:11434/api/tags | \
  jq '.models[] | select(.name | contains("gemma4"))'
```

**Check selector health matrix:**
```bash
curl -sS http://127.0.0.1:4890/health/matrix | \
  jq '.models[] | select(.model_id | contains("gemma4"))'
```

**Test task-level routing:**
```bash
curl -sS -X POST http://127.0.0.1:4890/select \
  -H 'Content-Type: application/json' \
  -d '{
    "task_type":"metadata_generation",
    "input_token_count":8000,
    "urgent":true,
    "local_only":true
  }' | jq '.model'
```

Expected output: One of `qwen2.5:14b`, `gemma4:12b`, or `gemma4:e4b`.

---

## Files Changed

| File | Changes | Impact |
|------|---------|--------|
| `operations/system-configs/model-selector/config/ai-providers.json` | Added gemma4:12b, gemma4:e4b to both providers | Provider discovery |
| `operations/system-configs/model-selector/runtime/core.py` | Fixed _model_meets_min_params, enhanced _model_size_b | Runtime logic |
| `operations/system-configs/model-selector/config/ai-task-types.json` | Added preferred_local_models to 5 tasks | Task routing |
| `operations/system-configs/model-selector/tests/test_gemma4_support.py` | NEW test file, 14 tests | Validation |
| `operations/system-configs/model-selector/README.md` | Gemma 4 section + verification commands | Documentation |
| `projects/brain-core/docs/ai-model-selector-architecture.md` | Updated hardware inventory, install, examples | Architecture docs |
| `projects/brain-console/*` | No changes needed | Dashboard auto-renders Gemma models |

---

## Backward Compatibility

✅ **All existing behavior preserved:**
- Qwen/Llama models remain at front of preferred_models lists
- No changes to provider priority order
- No changes to health checks, circuit breakers, or rate limiting
- All existing tests pass without modification

---

## Future Roadmap

1. **Verify Gemma 4 quality on real tasks** (1-2 weeks)
   - Monitor metadata_generation outcomes with Gemma
   - Monitor thumbnail_headline latency and quality
   - Collect performance metrics vs. Qwen/Llama baseline

2. **Consider 26B/31B for M4 Pro** (after quality validation)
   - Only if 12B proves reliable
   - Requires dedicated memory resource policy

3. **Multimodal Gemma support** (future)
   - Gemma Vision (multimodal) not enabled; verify before activation
   - Would only activate if vision tasks improve

4. **Task-level outcome tracking**
   - Extend bedrock_outcomes pattern to local models
   - Learn which tasks prefer which Gemma variants

---

## Notes

- Ollama remains the local inference server (not a replacement for Ollama)
- Brain Console represents models automatically via selector health matrix — no UI code changes
- M1 prefers gemma4:e4b due to memory constraints; 12B is fallback
- No direct OpenAI API or Anthropic API use in selector
- Runtime config must be copied to ~/.config/video-orchestrator after changes
- Selector must be restarted for config changes to take effect

---

## Sign-Off

✅ Configuration: Complete and validated  
✅ Runtime: Enhanced and tested  
✅ Tests: All 21 tests passing  
✅ Documentation: Updated  
✅ Dashboard: Automatic representation confirmed  
✅ Backward compatibility: Verified

**Ready for manual model installation and runtime restart.**
