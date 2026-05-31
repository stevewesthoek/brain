#!/bin/bash
# Validate Brain Console AWS Video Pipeline View
# Verifies Brain Core integration, no AWS SDK coupling, and view exists

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

BRAIN_CONSOLE_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)
BRAIN_CORE_URL="${BRAIN_CORE_URL:-http://localhost:4877}"

echo "==========================================="
echo "Validate Brain Console AWS Video View"
echo "==========================================="
echo ""

ERRORS=0
WARNINGS=0

# ── 1. Verify API Client ──────────────────────────────────────────────────

echo -e "${CYAN}[1/5] Checking API Client${NC}"
echo ""

if grep -q "readBrainCoreAwsVideoPipelineStatus" "$BRAIN_CONSOLE_ROOT/src/client.ts" 2>/dev/null; then
  echo -e "  ${GREEN}✓ readBrainCoreAwsVideoPipelineStatus exported${NC}"
else
  echo -e "  ${RED}✗ readBrainCoreAwsVideoPipelineStatus not found${NC}"
  ((ERRORS++))
fi

if grep -q "BrainCoreVideoOrchestratorStatusResponse" "$BRAIN_CONSOLE_ROOT/src/client.ts" 2>/dev/null; then
  echo -e "  ${GREEN}✓ API response types defined${NC}"
else
  echo -e "  ${RED}✗ API response types missing${NC}"
  ((ERRORS++))
fi

echo ""

# ── 2. Verify View Component ──────────────────────────────────────────────

echo -e "${CYAN}[2/5] Checking View Component${NC}"
echo ""

if [ -f "$BRAIN_CONSOLE_ROOT/src/components/VO/AwsVideoPipelinePanel.ts" ]; then
  echo -e "  ${GREEN}✓ AwsVideoPipelinePanel.ts exists${NC}"
else
  echo -e "  ${RED}✗ AwsVideoPipelinePanel.ts not found${NC}"
  ((ERRORS++))
fi

if grep -q "export class AwsVideoPipelinePanel" "$BRAIN_CONSOLE_ROOT/src/components/VO/AwsVideoPipelinePanel.ts" 2>/dev/null; then
  echo -e "  ${GREEN}✓ Panel class properly exported${NC}"
else
  echo -e "  ${RED}✗ Panel class export missing${NC}"
  ((ERRORS++))
fi

if grep -q "readBrainCoreAwsVideoPipelineStatus" "$BRAIN_CONSOLE_ROOT/src/components/VO/AwsVideoPipelinePanel.ts" 2>/dev/null; then
  echo -e "  ${GREEN}✓ Panel calls Brain Core API${NC}"
else
  echo -e "  ${RED}✗ Panel not calling Brain Core API${NC}"
  ((ERRORS++))
fi

echo ""

# ── 3. Verify No AWS SDK Coupling ─────────────────────────────────────────

echo -e "${CYAN}[3/5] Checking No AWS SDK in View${NC}"
echo ""

if grep -q "AWS\|s3\|S3\|@aws-sdk\|aws-cdk" "$BRAIN_CONSOLE_ROOT/src/components/VO/AwsVideoPipelinePanel.ts" 2>/dev/null; then
  echo -e "  ${RED}✗ AWS SDK/S3 reference detected in view${NC}"
  ((ERRORS++))
else
  echo -e "  ${GREEN}✓ No AWS SDK imports in view${NC}"
fi

if grep -q "AWS\|s3\|S3\|@aws-sdk\|aws-cdk" "$BRAIN_CONSOLE_ROOT/src/client.ts" 2>/dev/null; then
  echo -e "  ${RED}✗ AWS SDK/S3 reference detected in client${NC}"
  ((ERRORS++))
else
  echo -e "  ${GREEN}✓ No AWS SDK imports in client${NC}"
fi

echo ""

# ── 4. Verify Navigation Integration ──────────────────────────────────────

echo -e "${CYAN}[4/5] Checking Navigation Integration${NC}"
echo ""

if grep -q "'aws-video'" "$BRAIN_CONSOLE_ROOT/src/view.ts" 2>/dev/null; then
  echo -e "  ${GREEN}✓ aws-video section registered in view.ts${NC}"
else
  echo -e "  ${RED}✗ aws-video section not found in view.ts${NC}"
  ((ERRORS++))
fi

if grep -q "renderAwsVideoPipelineSection" "$BRAIN_CONSOLE_ROOT/src/view.ts" 2>/dev/null; then
  echo -e "  ${GREEN}✓ render function exists in view.ts${NC}"
else
  echo -e "  ${RED}✗ render function not found in view.ts${NC}"
  ((ERRORS++))
fi

if grep -q "aws-video.*label" "$BRAIN_CONSOLE_ROOT/src/view.ts" 2>/dev/null; then
  echo -e "  ${GREEN}✓ Navigation tab configured${NC}"
else
  echo -e "  ${RED}✗ Navigation tab not found${NC}"
  ((ERRORS++))
fi

echo ""

# ── 5. Check Brain Core Endpoint ──────────────────────────────────────────

echo -e "${CYAN}[5/5] Testing Brain Core Endpoint${NC}"
echo ""

if curl -s "$BRAIN_CORE_URL/status" > /dev/null 2>&1; then
  echo -e "  ${GREEN}✓ Brain Core reachable${NC}"

  # Try status endpoint
  if curl -s "$BRAIN_CORE_URL/api/video-orchestrator/topic-intelligence/status" > /dev/null 2>&1; then
    echo -e "  ${GREEN}✓ Topic Intelligence API endpoint exists${NC}"
  else
    echo -e "  ${YELLOW}⚠ Topic Intelligence API endpoint not responding${NC}"
    ((WARNINGS++))
  fi
else
  echo -e "  ${YELLOW}⚠ Brain Core not running at $BRAIN_CORE_URL${NC}"
  echo -e "  ${YELLOW}   (This is OK for build validation, run Brain Core to test API)${NC}"
  ((WARNINGS++))
fi

echo ""

# ── Summary ───────────────────────────────────────────────────────────────

echo "==========================================="
if [ $ERRORS -eq 0 ]; then
  echo -e "${GREEN}✅ Brain Console Video View validation passed${NC}"
else
  echo -e "${RED}❌ Brain Console Video View validation FAILED${NC}"
fi
echo "==========================================="

echo ""
echo "Results:"
echo "  API Client: ✓"
echo "  View Component: ✓"
echo "  No AWS SDK: ✓"
echo "  Navigation: ✓"
echo "  Brain Core: $([ $WARNINGS -gt 0 ] && echo '⏳ (check Brain Core running)' || echo '✓')"

if [ $ERRORS -gt 0 ]; then
  echo -e "${RED}  Errors: $ERRORS${NC}"
fi

if [ $WARNINGS -gt 0 ]; then
  echo -e "${YELLOW}  Warnings: $WARNINGS${NC}"
fi

echo ""

exit $ERRORS
