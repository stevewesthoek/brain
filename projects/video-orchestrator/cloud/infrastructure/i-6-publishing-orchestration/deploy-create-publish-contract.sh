#!/usr/bin/env bash
set -euo pipefail

REGION="${REGION:-eu-north-1}"
FUNCTION_NAME="${FUNCTION_NAME:-i6-create-publish-contract}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TMP_DIR="$(mktemp -d)"
ZIP_PATH="/tmp/${FUNCTION_NAME}.zip"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# The deployed Lambda handler is index.lambda_handler, so the zip must contain index.py.
cp "$SCRIPT_DIR/lambda-create-publish-contract.py" "$TMP_DIR/index.py"
(
  cd "$TMP_DIR"
  zip -q -r "$ZIP_PATH" index.py
)

echo "Deploying $FUNCTION_NAME to $REGION with handler-compatible index.py package..."
aws lambda update-function-code \
  --function-name "$FUNCTION_NAME" \
  --zip-file "fileb://$ZIP_PATH" \
  --region "$REGION" \
  --no-cli-pager

aws lambda wait function-updated \
  --function-name "$FUNCTION_NAME" \
  --region "$REGION"

echo "Deployment complete: $FUNCTION_NAME"
