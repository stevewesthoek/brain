# Stripe CLI Runbook

## Capability route

Natural-language requests about Stripe billing, subscriptions, invoices,
customers, payment intents, webhook forwarding, test events, or Stripe CLI
authentication route through:

- skill: `ai/skills/custom/stripe/stripe-cli/SKILL.md`
- command: `stripe`
- discovery: `node tools/discover-capabilities.mjs --query "<request>"`

The command is installed globally and must be available through the shared
PATH for Claude Code, Codex, and Gemini CLI.

## Safe default workflow

```bash
stripe --version
stripe get /v1/account -p "prochat portugal"
stripe customers list --limit 5
stripe subscriptions list --limit 5
stripe invoices list --limit 5
```

Use test mode by default. Read-only inspection is the default route for a
request such as “inspect Stripe subscriptions.” Confirm the intended account,
profile, and live/test mode before any external mutation.

## Webhooks and test events

```bash
stripe listen --forward-to localhost:3000/webhooks
stripe trigger payment_intent.succeeded
```

Only use webhook forwarding or event triggering when the local target and test
intent are clear. Never expose webhook signing secrets or API keys.

## Authentication

Do not use `stripe whoami` in this workspace; the installed build does not
support it. Inspect only local Stripe profile section names (never print the
config values), or use the account endpoint with the named profile:

```bash
awk '/^\[/{print}' ~/.config/stripe/config.toml
stripe get /v1/account -p "prochat portugal"
```

If authentication is missing for ProChat Nederland, use
`stripe login --project-name "prochat studio"` only when the user has clearly
asked to authenticate or the workflow cannot proceed without it. The local
selector remains `prochat studio`; the authenticated Dashboard label is
`ProChat Nederland`.

Dashboard account labels and CLI profile selectors are separate values. The
current active five-account set is `prochat portugal` (ProChat Portugal),
`jpv-bootcamp` (JPV Bootcamp), `prochat studio` (ProChat Nederland), `says the
bible` (Says the Bible), and `yeshua academy` (Yeshua Academy). All five pass
account and subscription reads after the user's login. The account switcher in
the Dashboard is not proof that one CLI profile acts on all five; the CLI uses
one profile selector per account.

## Guardrails

- Never print, echo, commit, or transmit API keys, profile tokens, or webhook
  signing secrets.
- Treat Stripe as financial/external state.
- Do not create, cancel, refund, delete, or otherwise mutate live Stripe data
  without explicit confirmation of the exact action and account.
- Report local CLI availability, authentication, repository evidence, and live
  Stripe observations as separate facts.

## Related canonical sources

- `ai/policy/capability-discovery.md`
- `docs/skills/skill-index.md`
- `operations/CLI-MANIFEST.md`
- `operations/specs/mcp-provider-admissions.json`
