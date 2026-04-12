#!/bin/bash

# Apify Multi-Account CLI Wrapper
#
# Usage:
#   apify-multi run <actor-id> --input-file <input.json>
#   apify-multi status
#   apify-multi list
#
# This wrapper handles account rotation automatically.

MANAGER_SCRIPT="/Users/Office/Repos/stevewesthoek/brain/ai/skills/custom/apify/apify-multi-account-manager.py"

case "$1" in
  run)
    # Get next token from rotation manager
    token_info=$(python3 "$MANAGER_SCRIPT" next-token 2>/dev/null)

    if [ $? -ne 0 ]; then
      echo "❌ Failed to get next token"
      exit 1
    fi

    token=$(echo "$token_info" | jq -r '.token')
    account=$(echo "$token_info" | jq -r '.account_name')
    index=$(echo "$token_info" | jq -r '.account_index')
    total=$(echo "$token_info" | jq -r '.total_accounts')
    cycle=$(echo "$token_info" | jq -r '.cycle_count')

    echo "ℹ️  Using account: $account ($index/$total, cycle #$cycle)"

    # Run apify with the token from our rotation
    shift  # remove 'run'
    APIFY_TOKEN="$token" apify "$@"

    if [ $? -eq 0 ]; then
      echo "✅ Run complete via $account"
    else
      echo "❌ Run failed on $account"
      exit 1
    fi
    ;;

  status)
    python3 "$MANAGER_SCRIPT" status
    ;;

  list)
    python3 "$MANAGER_SCRIPT" list
    ;;

  export-config)
    python3 "$MANAGER_SCRIPT" export-config
    ;;

  *)
    echo "Apify Multi-Account CLI Wrapper"
    echo ""
    echo "Usage:"
    echo "  apify-multi run <actor-id> [apify args...]"
    echo "  apify-multi status"
    echo "  apify-multi list"
    echo "  apify-multi export-config"
    echo ""
    echo "Examples:"
    echo "  apify-multi run apify/web-scraper --input-file input.json"
    echo "  apify-multi status"
    ;;
esac
