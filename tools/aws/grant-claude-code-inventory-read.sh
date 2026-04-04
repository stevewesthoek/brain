#!/usr/bin/env bash
set -euo pipefail

# Grants the minimum AWS read permissions needed for the shared aws-cli skill
# to inventory EC2 and Lightsail servers.
#
# Usage:
#   ./tools/aws/grant-claude-code-inventory-read.sh
#   AWS_PROFILE=admin ./tools/aws/grant-claude-code-inventory-read.sh

user_name="${AWS_TARGET_USER:-claude-code}"
policy_name="${AWS_POLICY_NAME:-ClaudeCodexInventoryReadOnly}"
script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
policy_file="${script_dir}/claude-code-inventory-policy.json"

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

echo
echo "Next verification from the shared runtime:"
echo "  ~/.local/bin/aws-cli ec2 describe-instances --region us-east-1 --output json"
echo "  ~/.local/bin/aws-cli lightsail get-instances --region us-east-1 --output json"
