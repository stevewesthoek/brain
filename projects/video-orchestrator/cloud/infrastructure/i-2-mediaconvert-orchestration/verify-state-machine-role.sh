#!/usr/bin/env bash
#
# Verify Step Functions State Machine Role
#
# Checks that the deployed state machine uses the correct IAM role.
# Exits with status 0 if role is correct, nonzero if wrong.
#
# This is the canonical verification command for CI/CD pipelines and
# health checks to prevent regression to StepFunctionsDefaultRole.
#
# Usage: ./verify-state-machine-role.sh
#

set -euo pipefail

ACCOUNT_ID="909439522876"
REGION="eu-north-1"
STATE_MACHINE_NAME="prochat-video-skeleton-dev"
CORRECT_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/ProChatVideoStepFunctionsRole"
STATE_MACHINE_ARN="arn:aws:states:${REGION}:${ACCOUNT_ID}:stateMachine:${STATE_MACHINE_NAME}"

main() {
  echo "[verify-state-machine-role] Checking state machine role..."
  echo "[verify-state-machine-role] State Machine ARN: $STATE_MACHINE_ARN"

  # Query the deployed role
  local deployed_role
  if ! deployed_role=$(aws stepfunctions describe-state-machine \
    --state-machine-arn "$STATE_MACHINE_ARN" \
    --region "$REGION" \
    --query 'roleArn' \
    --output text 2>&1); then
    echo "[verify-state-machine-role] ERROR: Failed to retrieve state machine details"
    echo "[verify-state-machine-role] Output: $deployed_role"
    return 1
  fi

  if [ -z "$deployed_role" ] || [ "$deployed_role" = "None" ]; then
    echo "[verify-state-machine-role] ERROR: Could not retrieve role ARN"
    return 1
  fi

  echo "[verify-state-machine-role] Deployed role: $deployed_role"
  echo "[verify-state-machine-role] Expected role:  $CORRECT_ROLE_ARN"

  # Check for mismatch
  if [ "$deployed_role" != "$CORRECT_ROLE_ARN" ]; then
    echo ""
    echo "[verify-state-machine-role] ❌ VERIFICATION FAILED: Role mismatch"
    echo ""
    echo "Current deployed role:  $deployed_role"
    echo "Required role:          $CORRECT_ROLE_ARN"
    echo ""
    echo "IMPACT: Step Functions cannot invoke Lambda functions."
    echo "SYMPTOM: Jobs fail at CheckApprovalState with:"
    echo '  ApprovalCheckError: "The principal states.amazonaws.com is not authorized'
    echo '  to assume the provided role"'
    echo ""
    echo "RESOLUTION: Run:"
    echo "  cd infrastructure/i-2-mediaconvert-orchestration"
    echo "  ./deploy-state-machine.sh"
    echo ""
    return 1
  fi

  # Extra safety: warn if role name contains "StepFunctionsDefault"
  if echo "$deployed_role" | grep -qi "stepfunctionsdefault"; then
    echo ""
    echo "[verify-state-machine-role] ⚠️  WARNING: Role name contains 'StepFunctionsDefaultRole'"
    echo "This will cause runtime failures even if the ARN technically matches."
    echo ""
    return 1
  fi

  echo ""
  echo "[verify-state-machine-role] ✅ VERIFICATION PASSED"
  echo "State machine is using the correct role and Lambda invocation will succeed."
  echo ""
  return 0
}

main "$@"
