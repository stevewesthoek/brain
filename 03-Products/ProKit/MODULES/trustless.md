# Trustless Module (Optional)

Use this module only when a product needs public magic links, passwordless access, or push-first workflows. It is not part of the default ProKit app.

## What it adds

- Public magic links (`/l/[token]`)
- Private deeplinks for owners (`/d/[id]`)
- Optional QR link sharing
- Push-first notifications + email fallbacks
- Event logging for automation workflows

## Required environment variables

```bash
LINK_JWT_SECRET=<secret>
VAPID_PUBLIC_KEY=<key>
VAPID_PRIVATE_KEY=<key>
VAPID_SUBJECT=mailto:support@<domain>
N8N_WEBHOOK_URL=https://n8n.<domain>/webhook/<project>
```

## Expected routes

- `/l/[token]` public read-only view
- `/d/[id]` authenticated owner view
- `/api/push/subscribe` store push subscriptions
- `/api/push/send` send notifications
- `/api/events` log public/private events

## Activation rules

- Do not activate unless explicitly requested.
- Do not alter core auth, billing, or database systems.
- Keep changes minimal and scoped to this module.
