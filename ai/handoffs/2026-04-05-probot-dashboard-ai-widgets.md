# Current Handoff

## Repo
brain

## Tool
Claude Code

## Goal
Build ProBot dashboard AI usage widgets: Bedrock cost (MTD) and Codex token % remaining for 5h and 7d windows.

## Status
Complete. All changes committed and pushed (commit `a0d688c`). ProBot daemon running with dashboard live at `https://probot.prochat.tools`.

## What was done
- Added Bedrock Spend (MTD) widget — calls `aws ce get-cost-and-usage`, shows monthly reset date (May 1), degrades gracefully if permission missing
- Added Codex 5h and 7d window widgets — parses real `token_count` event_msg records from `~/.codex/sessions/**/*.jsonl`, extracts `used_percent` and `resets_at` from the OpenAI rate limit payload, shows % remaining with color-coded bar and countdown to reset
- Fixed timezone bug in monthly Bedrock reset date (was showing Apr 30 instead of May 1)
- Updated `operations/infrastructure/infra.md` with full Tailscale node inventory, domain/site inventory by host, and Cloudflare Tunnel reference table

## One open action item
The `claude-code` IAM user (account `909439522876`) needs `ce:GetCostAndUsage` permission before Bedrock spend shows real data.

Add this inline policy in AWS IAM → Users → claude-code → Add permissions → Add inline policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [{ "Effect": "Allow", "Action": "ce:GetCostAndUsage", "Resource": "*" }]
}
```
Save as `CostExplorerRead`. Dashboard will pick it up on next 30s refresh.

## Next steps
1. Add `ce:GetCostAndUsage` IAM permission (see above)
2. No other open items — dashboard, tunnel, Zero Trust all fully operational

## Blockers
- None (Bedrock widget shows graceful warning until IAM permission is added)

## Resume prompt
Continue work on brain/projects/probot dashboard. The Bedrock cost widget is blocked only by a missing IAM permission — see `.ai/current.md` for the exact policy JSON to add to the `claude-code` IAM user (account 909439522876). All other dashboard widgets (Codex 5h/7d, machine stats, repos, sessions) are live at https://probot.prochat.tools. Last commit: a0d688c.
