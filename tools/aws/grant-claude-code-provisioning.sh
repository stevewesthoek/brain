#!/usr/bin/env bash
set -euo pipefail

# Grants broad server-lifecycle permissions for AWS automation on the existing
# claude-code IAM user. This is intended to support provisioning, cleanup,
# and instance bootstrap workflows via AWS CLI.
#
# Usage:
#   AWS_PROFILE=admin ./tools/aws/grant-claude-code-provisioning.sh

user_name="${AWS_TARGET_USER:-claude-code}"
policy_name="${AWS_POLICY_NAME:-ClaudeCodexProvisioning}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
policy_file="${script_dir}/claude-code-provisioning-policy.json"

aws_cli="${AWS_CLI_BIN:-$HOME/.local/bin/aws-cli}"
if [[ ! -x "${aws_cli}" ]]; then
  aws_cli="${AWS_CLI_BIN:-/usr/local/bin/aws}"
fi

if [[ ! -x "${aws_cli}" ]]; then
  echo "AWS CLI not found. Set AWS_CLI_BIN or install aws." >&2
  exit 1
fi

echo "Using AWS CLI: ${aws_cli}"
echo "Target IAM user: ${user_name}"
echo "Policy name: ${policy_name}"

"${aws_cli}" iam put-user-policy \
  --user-name "${user_name}" \
  --policy-name "${policy_name}" \
  --policy-document "file://${policy_file}"

echo
echo "Policy attached. Verifying:"
"${aws_cli}" iam list-user-policies --user-name "${user_name}" --output json
