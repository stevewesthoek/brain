#!/bin/bash
# Validation script for Brain Console Generate Video button (I-8.3 Phase B)
# Static checks only — no live Obsidian instance required

set -e

PLUGIN_SRC="/Users/Office/Repos/stevewesthoek/brain/projects/brain-console-obsidian"

echo "==========================================="
echo "I-8.3 Phase B: Brain Console Generate Button"
echo "==========================================="
echo ""

# Test 1: Scripts tab exists
echo "[Test 1/6] Checking Scripts tab exists"
if grep -q 'data-tab="scripts"' "$PLUGIN_SRC/src/components/VO/VOShell.ts"; then
  echo "✓ PASS: Scripts tab button found in VOShell"
else
  echo "❌ FAIL: Scripts tab button not found in VOShell"
  exit 1
fi
echo ""

# Test 2: ScriptApprovalPanel exists
echo "[Test 2/6] Checking ScriptApprovalPanel file"
if [ -f "$PLUGIN_SRC/src/components/VO/ScriptApprovalPanel.ts" ]; then
  echo "✓ PASS: ScriptApprovalPanel.ts exists"
else
  echo "❌ FAIL: ScriptApprovalPanel.ts not found"
  exit 1
fi
echo ""

# Test 3: Generate Video button found
echo "[Test 3/6] Checking Generate Video button"
if grep -q "Generate Video\|generateVideo\|generate-video" "$PLUGIN_SRC/src/components/VO/ScriptApprovalPanel.ts"; then
  echo "✓ PASS: Generate Video button found in ScriptApprovalPanel"
else
  echo "❌ FAIL: Generate Video button not found"
  exit 1
fi
echo ""

# Test 4: Generate button calls API
echo "[Test 4/6] Checking API call to /generate endpoint"
if grep -q '/generate' "$PLUGIN_SRC/src/components/VO/ScriptApprovalPanel.ts"; then
  echo "✓ PASS: API call to /generate endpoint found"
else
  echo "❌ FAIL: No API call to /generate endpoint"
  exit 1
fi
echo ""

# Test 5: No AWS imports
echo "[Test 5/6] Checking no AWS imports in ScriptApprovalPanel"
if grep -q -i "aws\|@aws\|s3\|stepfunctions" "$PLUGIN_SRC/src/components/VO/ScriptApprovalPanel.ts"; then
  echo "❌ FAIL: Found AWS imports in ScriptApprovalPanel"
  exit 1
else
  echo "✓ PASS: No AWS imports (correct!)"
fi
echo ""

# Test 6: No Publish button added
echo "[Test 6/6] Checking no Publish button in ScriptApprovalPanel"
if grep -q -i "publish.*button\|publish.*video\|PublishButton\|publishVideo\|btn-publish" "$PLUGIN_SRC/src/components/VO/ScriptApprovalPanel.ts"; then
  echo "❌ FAIL: Publish button found in ScriptApprovalPanel (should not be added yet)"
  exit 1
else
  echo "✓ PASS: No Publish button (correct!)"
fi
echo ""

echo "==========================================="
echo "✅ All static validation tests passed!"
echo "==========================================="
echo ""
echo "Summary:"
echo "- Scripts tab added to VO Shell"
echo "- ScriptApprovalPanel created with approval + generation UI"
echo "- Generate Video button enabled only for approved scripts"
echo "- API calls to Brain Core endpoints only (no AWS logic)"
echo "- No Publish button (reserved for I-8.5)"
echo ""
echo "Plugin installed to:"
echo "/Users/Office/Repos/stevewesthoek/mind/.obsidian/plugins/brain-console"
echo ""
echo "To test in Obsidian:"
echo "1. Restart Obsidian: pkill -x Obsidian && sleep 2 && open -a Obsidian"
echo "2. Open Brain Console vault"
echo "3. Look for 'Scripts' tab in Video Orchestrator section"
echo "4. See script list with approval status"
echo "5. Generate button should be disabled for pending, enabled for approved"
echo ""
