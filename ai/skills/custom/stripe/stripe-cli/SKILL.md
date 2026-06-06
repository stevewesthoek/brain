---
name: stripe
description: Use when the user asks to work with Stripe CLI for local development, webhook forwarding, event triggering, auth verification, or safe inspection of Stripe resources. Assumes Stripe CLI is installed globally on the machine.
---

# Stripe CLI

## What this skill is for
Help Claude use the Stripe CLI safely and consistently for local development workflows, webhook testing, event simulation, and Stripe account diagnostics.

## Use this skill when
- The user wants to forward webhooks to a local server
- The user wants to trigger test events (e.g. `payment_intent.succeeded`)
- The user wants to verify Stripe CLI auth or login
- The user wants to inspect Stripe resources from the command line
- The user wants to run Stripe CLI commands as part of a dev or test workflow

## Do not use this skill for
- Direct Stripe API calls via SDK or HTTP — use the Stripe SDK in code instead
- Modifying production Stripe data without explicit user confirmation
- Anything involving real customer payment data unless the user explicitly confirms production intent

## Safety rules
1. **Test mode by default.** Always prefer test mode keys and test mode operations. Never assume production unless the user explicitly confirms it.
2. **Never expose secrets.** Do not log, print, commit, or echo Stripe API keys, webhook signing secrets, or tokens. Never include them in command outputs shown to the user.
3. **No destructive production actions without confirmation.** Before any operation that could affect live/production data, state what you are about to do and wait for explicit confirmation.
4. **Verify auth before proceeding.** Do not rely on `stripe whoami` in this workspace. The installed CLI build does not support it. Check `~/.config/stripe/config.toml` and/or `stripe get /v1/account -p <profile>` before relying on CLI state. If unauthenticated, prompt login first.
5. **Workspace default profile.** Unless a repo-specific doc says otherwise, treat `ProChat Studio` as the default Stripe CLI profile in this workspace.

## Recommended workflow

```bash
# 1. Confirm stripe CLI is installed
stripe --version

# 2. Check current auth status
cat ~/.config/stripe/config.toml
stripe get /v1/account -p "ProChat Studio"

# 3. Login if needed (opens browser)
stripe login --project-name "ProChat Studio"

# 4. Forward webhooks to your local server
stripe listen --forward-to localhost:3000/webhooks

# 5. Trigger a test event
stripe trigger payment_intent.succeeded

# 6. Inspect resources before mutating anything
stripe customers list --limit 5
stripe payment_intents list --limit 5
```

## Example commands

```bash
# Version
stripe --version

# Auth
stripe login --project-name "ProChat Studio"
cat ~/.config/stripe/config.toml
stripe get /v1/account -p "ProChat Studio"

# Webhook forwarding
stripe listen --forward-to localhost:3000/webhooks
stripe listen --forward-to localhost:3000/webhooks --events payment_intent.succeeded,checkout.session.completed

# Trigger test events
stripe trigger payment_intent.succeeded
stripe trigger checkout.session.completed
stripe trigger customer.subscription.created

# Inspect resources (safe, read-only)
stripe customers list --limit 5
stripe payment_intents list --limit 5
stripe subscriptions list --limit 5

# Logs
stripe logs tail
```

## Notes
- Stripe CLI must be installed globally: `brew install stripe/stripe-cli/stripe`
- Auth tokens are stored locally by the CLI — never pass them as inline arguments in commands Claude runs
- Use `--api-key` flag only when absolutely necessary and only with test keys; never hardcode production keys
- In this workspace, treat Stripe CLI as profile-based. One account can have both live and test access in the same profile.
- Default to `ProChat Studio` unless a repo-specific doc overrides the profile for that repo.
- Dashboard-visible accounts in Stripe are not guaranteed to be enumerable via one account's API. Separate CLI auth per account may be required.
- Canonical Stripe operations doc: use the standard Stripe runbook in `operations/runbooks/`
