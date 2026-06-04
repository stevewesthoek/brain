#!/usr/bin/env bash
#
# Deploy Step Functions State Machine with IAM Role Guardrails
#
# This script deploys the Step Functions state machine with the CORRECT IAM role.
# CRITICAL: This prevents regression to StepFunctionsDefaultRole, which will fail
# at runtime with "states.amazonaws.com is not authorized to assume the provided role".
#
# Usage: ./deploy-state-machine.sh [--verify-only]
#

set -euo pipefail

# Configuration
ACCOUNT_ID="909439522876"
REGION="eu-north-1"
STATE_MACHINE_NAME="prochat-video-skeleton-dev"
STATE_MACHINE_DEF_FILE="./step-functions-state-machine.json"

# CRITICAL: Hardcode the correct role. Never use StepFunctionsDefaultRole.
# Reason: StepFunctionsDefaultRole does not have the required trust policy for
# invoking Lambda functions in this account. The correct role must explicitly
# allow states.amazonaws.com to invoke these Lambda functions.
CORRECT_ROLE_ARN="arn:aws:iam::${ACCOUNT_ID}:role/ProChatVideoStepFunctionsRole"

# Canonical state machine ARN for lookup
STATE_MACHINE_ARN="arn:aws:states:${REGION}:${ACCOUNT_ID}:stateMachine:${STATE_MACHINE_NAME}"

main() {
  verify_only="${1:-}"

  if [ "$verify_only" = "--verify-only" ]; then
    verify_state_machine_role
    exit $?
  fi

  echo "[deploy-state-machine] Starting Step Functions state machine deployment..."
  echo "[deploy-state-machine] Account: $ACCOUNT_ID"
  echo "[deploy-state-machine] Region: $REGION"
  echo "[deploy-state-machine] State Machine: $STATE_MACHINE_NAME"
  echo "[deploy-state-machine] Role (CORRECT): $CORRECT_ROLE_ARN"

  # Step 1: Validate state machine definition file exists
  if [ ! -f "$STATE_MACHINE_DEF_FILE" ]; then
    echo "[deploy-state-machine] ERROR: State machine definition file not found: $STATE_MACHINE_DEF_FILE"
    exit 1
  fi
  echo "[deploy-state-machine] ✓ State machine definition file found"

  # Step 2: Validate JSON syntax
  if ! jq empty "$STATE_MACHINE_DEF_FILE" 2>/dev/null; then
    echo "[deploy-state-machine] ERROR: State machine definition is not valid JSON"
    exit 1
  fi
  echo "[deploy-state-machine] ✓ State machine definition is valid JSON"

  # Step 3: Verify state machine exists in AWS
  if ! state_machine_exists; then
    echo "[deploy-state-machine] ERROR: State machine does not exist: $STATE_MACHINE_ARN"
    echo "[deploy-state-machine] Create it first using: aws stepfunctions create-state-machine ..."
    exit 1
  fi
  echo "[deploy-state-machine] ✓ State machine exists"

  # Step 4: Read definition
  local definition
  definition=$(cat "$STATE_MACHINE_DEF_FILE")

  # Step 5: Update state machine with correct role
  echo "[deploy-state-machine] Updating state machine with correct role..."
  if ! aws stepfunctions update-state-machine \
    --state-machine-arn "$STATE_MACHINE_ARN" \
    --definition "$definition" \
    --role-arn "$CORRECT_ROLE_ARN" \
    --region "$REGION" \
    --output text > /dev/null 2>&1; then
    echo "[deploy-state-machine] ERROR: Failed to update state machine"
    exit 1
  fi
  echo "[deploy-state-machine] ✓ State machine updated"

  # Step 6: Verify deployed role is correct
  echo "[deploy-state-machine] Verifying deployed role..."
  verify_state_machine_role

  echo "[deploy-state-machine] ✅ Deployment complete. State machine deployed with correct role."
}

state_machine_exists() {
  aws stepfunctions describe-state-machine \
    --state-machine-arn "$STATE_MACHINE_ARN" \
    --region "$REGION" \
    --output text > /dev/null 2>&1
}

verify_state_machine_role() {
  local deployed_role
  deployed_role=$(aws stepfunctions describe-state-machine \
    --state-machine-arn "$STATE_MACHINE_ARN" \
    --region "$REGION" \
    --query 'roleArn' \
    --output text 2>/dev/null)

  if [ -z "$deployed_role" ]; then
    echo "[verify-state-machine-role] ERROR: Could not retrieve deployed role"
    return 1
  fi

  echo "[verify-state-machine-role] Deployed role: $deployed_role"
  echo "[verify-state-machine-role] Expected role:  $CORRECT_ROLE_ARN"

  if [ "$deployed_role" != "$CORRECT_ROLE_ARN" ]; then
    echo "[verify-state-machine-role] ❌ ROLE MISMATCH"
    echo ""
    echo "CRITICAL ERROR: State machine is using the wrong IAM role!"
    echo ""
    echo "Deployed role:  $deployed_role"
    echo "Expected role:  $CORRECT_ROLE_ARN"
    echo ""
    echo "This will cause runtime failures when Lambda functions are invoked."
    echo "Symptom: 'ApprovalCheckError — The principal states.amazonaws.com is not authorized'"
    echo ""
    echo "Fix: Run ./deploy-state-machine.sh to redeploy with the correct role."
    return 1
  fi

  if echo "$deployed_role" | grep -q "StepFunctionsDefaultRole"; then
    echo "[verify-state-machine-role] ⚠️  WARNING: Deployed role contains 'StepFunctionsDefaultRole'"
    echo "[verify-state-machine-role] This will cause Lambda invocation failures."
    return 1
  fi

  echo "[verify-state-machine-role] ✓ Role is correct"
  return 0
}

# Run main
main "$@"
