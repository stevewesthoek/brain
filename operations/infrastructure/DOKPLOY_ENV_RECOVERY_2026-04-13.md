> **⚠️ HISTORICAL — 2026-04-13 incident resolved.** Database was successfully restored from Azure backup. Env vars are safely back in Dokploy's PostgreSQL. Canonical Dokploy docs are now in `infra.md`. This file is retained as emergency reference only.

# DOKPLOY Environment Variables Recovery — 2026-04-13

**CRITICAL:** This file contains ALL environment variables extracted from running Dokploy applications on 2026-04-13 at 07:32 UTC, after the PostgreSQL database was corrupted in the disk-full incident.

**Status:** All 12 production applications are currently RUNNING with these env vars loaded in memory. However, the Dokploy database that normally stores this metadata is LOST. Once containers restart, these env vars will be GONE forever unless restored.

**Action Required:** These env vars must be re-entered into Dokploy before any container restart.

---

## Recovery Priority

**TIER 0 (CRITICAL)** — Restart will fail without these:
- `DATABASE_URL` (PostgreSQL connection strings)
- `SYSTEM_DATABASE_URL` (Supabase master connection)
- `API_KEY` tokens (Stripe, Resend, Clerk, etc.)
- `SECRET_KEY` / `*_SECRET` values (encryption, webhooks)

**TIER 1 (HIGH)** — Missing will cause service degradation:
- `*_PUBLISHABLE_KEY` / `*_PUBLIC_*` values
- `NODE_ENV`, `PORT`, `NODE_OPTIONS`
- `HOST`, `*_URL` (service URLs)

**TIER 2 (MEDIUM)** — Nice-to-have but low impact:
- `ADMIN_EMAIL`, `*_EMAIL`
- Branding config (`EMAIL_BRAND_NAME`, `LOGO_URL`)
- Observability (`NEW_RELIC_*`, `UMAMI_*`)

---

## Full Environment Variable Dump

### 1. apps-internal-free-resend-izqnvr (Resend Email Service)

\`\`\`
NEXTAUTH_URL=https://resend.prochat.tools
NEXTAUTH_SECRET=VuC6aU1QWlQe6lJmC7YfZVbqU0z9ZQ1Wc9qB5JrJrR8
DATABASE_URL=postgresql://resend_user:n8Q2ZxL7pC4mT1vR9yH3aW6bE0kJ5sU@10.0.2.4:5433/resend?schema=resend&sslmode=disable
AWS_REGION=eu-west-3
AWS_ACCESS_KEY_ID=AKIA5HPWR3A6DNHCECGG
AWS_SECRET_ACCESS_KEY=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
ADMIN_EMAIL=info@prochat.tools
ADMIN_PASSWORD=guwsuk-wabsA7-mofzoq
\`\`\`

### 2. apps-internal-n8n-cvjx2s (n8n Workflow Automation)

**n8n Container:**
\`\`\`
NODE_ENV=production
DB_POSTGRESDB_USER=lyla_gislason
GENERIC_TIMEZONE=Europe/Lisbon
DB_POSTGRESDB_DATABASE=n8n
N8N_PROTOCOL=https
DB_POSTGRESDB_HOST=postgres
WEBHOOK_URL=https://n8n.prochat.tools/
DB_POSTGRESDB_PASSWORD=wzvbisrnixuysvypdofrunsi
N8N_SECURE_COOKIE=true
DB_TYPE=postgresdb
N8N_HOST=n8n.prochat.tools
N8N_ENCRYPTION_KEY=dxQSr/oF9Db4noKOuZLhAAO5grvpToQOWheXkOczG6x6wI9PcretjOcxb6XmYDWLIswFRBPkBC5mDRA76ukMNw==
DB_POSTGRESDB_PORT=5432
N8N_PORT=5678
\`\`\`

**PostgreSQL Container:**
\`\`\`
POSTGRES_USER=lyla_gislason
POSTGRES_PASSWORD=wzvbisrnixuysvypdofrunsi
POSTGRES_DB=n8n
\`\`\`

### 3. apps-saas-says-the-bible-kkmykn (Says The Bible App)

\`\`\`
NODE_ENV=production
APP_SLUG=saysthebible
DB_PASSWORD=K7p3WQ9vN2xZt5HcR8mB4yL0aD6eF1g
DATABASE_URL=postgresql://saysthebible:K7p3WQ9vN2xZt5HcR8mB4yL0aD6eF1g@10.0.2.4:5433/saysthebible?schema=saysthebible
SYSTEM_DATABASE_URL=postgresql://supabase_admin:HdgqzDjeGzta3VcE7nNCfKCGyEcwU4XV@10.0.2.4:5433/saysthebible?schema=public
NEXT_PUBLIC_APP_URL=https://saysthe.bible
APP_URL=https://saysthe.bible
PORT=3000
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcyMjM1ODY2LCJleHAiOjIwODc1OTU4NjZ9.cpJSPdsJPan0dPwSKF5fCf0vJkCeBDT_DBEd48Lb23Y
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcyMjM1ODY2LCJleHAiOjIwODc1OTU4NjZ9.DSR7XwJnXRozoKoFeshd6GPy9bYArpnPEfJonXepWP4
SUPABASE_STORAGE_BUCKET_AUDIO=audio
SUPABASE_URL=http://10.0.2.4:8000
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6InNlcnZpY2Vfcm9sZSIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzcyMjM1ODY2LCJleHAiOjIwODc1OTU4NjZ9.DSR7XwJnXRozoKoFeshd6GPy9bYArpnPEfJonXepWP4
STRIPE_MODE=test
STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_51T5EojLzAX9y8uTj7ipYv18vtYg56zm3TJuOg209UMG5Bo8PZoCZE2RU4rcvVRvovo3Gxu9VqWLAVLVYXbSII1zu00yXpNmZI4
STRIPE_SECRET_KEY_LIVE=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
STRIPE_WEBHOOK_SECRET_LIVE=whsec_JdGOqUQbPcOCDmnIbt4MrqneRkEt9xPM
STRIPE_PUBLISHABLE_KEY_TEST=pk_test_51T5EoqL7t8amqhMUWYhNhkdeXqAJDxXt2bQh0RRt8CO1S6feyXBbKu4CMYzcUSNgFauJDudslnA5yD6Lynk0Ve2Z00DccofKg3
STRIPE_SECRET_KEY_TEST=sk_test_51T5EoqL7t8amqhMULslmMW2Xu05Z5zMYccQSfgYn9ckyujzSrVYKr9nFntCAFnbqHk0FeFunbdzinDYAOewik8pf0086KQgq5w
STRIPE_WEBHOOK_SECRET_TEST=whsec_opgI5GLGMm1pGfIExCZ1hvvp9Yfvqh86
STRIPE_AUTOMATIC_TAX_ENABLED=true
NEXT_TRUST_HOST=1
CLERK_DISABLED=false
NEXT_PUBLIC_CLERK_DISABLED=false
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsuc2F5c3RoZS5iaWJsZSQ
CLERK_SECRET_KEY=sk_live_dlRPLTik002UcPAzL9N4HQsSDuiBUanX5CxpD2czMP
NEXT_PUBLIC_CLERK_FRONTEND_API=clerk.saysthe.bible
CLERK_ENCRYPTION_KEY=71b6af0fc9c8b25c5bd7aba7b16ac802636c4e8497d19154989ff11638de613a
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
RESEND_BASE_URL=https://resend.prochat.tools/api
RESEND_API_KEY=frs_YYuKgTLx_agsDg3Pn0Hbzq_-dSJl5uoqXHW7npo7h
EMAIL_FROM=what@saysthe.bible
EMAIL_REPLY_TO=what@saysthe.bible
FREE_RESEND_COMPAT=true
EMAIL_BRAND_NAME=Says the Bible
EMAIL_BRAND_COLOR=
EMAIL_LOGO_URL=https://saysthe.bible/assets/says-the-bible-icon.png
NEXT_PUBLIC_SUPPORT_EMAIL=what@saysthe.bible
WORDPRESS_DB_USER=admin_STB
WORDPRESS_DB_PASSWORD=P7n2X4a9L3m8Q6r1
WORDPRESS_DB_NAME=saysthebible
WP_REST_ENDPOINT=https://saysthe.bible/wp-json
MYSQL_DATABASE=saysthebible
MYSQL_USER=cursor
MYSQL_PASSWORD=Z5b8T2q6H1v9C3y4
MYSQL_RANDOM_ROOT_PASSWORD=1
ADMIN_PASSWORD=i8COIyqAOkc1WMZGLtGY
N8N_FACEBOOK_AUTOPUBLISH_WEBHOOK_URL=https://n8n.prochat.tools/webhook/stb-facebook-autopublish
N8N_FACEBOOK_AUTOPUBLISH_SECRET=a88c1d880ce93dd9f3acd26a493816bad1c45f6be1e1a28d
FACEBOOK_APP_ID=1479485707149593
FACEBOOK_APP_SECRET=09e6a74a51c0fc11d83cf246bf56a862
NODE_OPTIONS=--require newrelic
NEW_RELIC_APP_NAME=Says the Bible
NEW_RELIC_LICENSE_KEY=eu01xea4496324cb45ca2e824102d2719c2eNRAL
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://umami.prochat.tools/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=e43170f1-7267-422d-af1c-681c6ed1b43d
\`\`\`

### 4. web-public-jpv-bootcamp-l66egq (JPV Bootcamp App)

\`\`\`
APP_SLUG=jpvbootcamp
NODE_ENV=production
APP_BASE_URL=https://jpvbootcamp.com
TENANT_DB_PASSWORD=yR7pQ1wKfZ9mH2bTnC4xV6sLdP8eA3uB
DATABASE_URL=postgresql://jpvbootcamp_user:yR7pQ1wKfZ9mH2bTnC4xV6sLdP8eA3uB@10.0.2.4:5433/jpvbootcamp?schema=jpvbootcamp
SYSTEM_DATABASE_URL=postgresql://supabase_admin:HdgqzDjeGzta3VcE7nNCfKCGyEcwU4XV@10.0.2.4:5433/jpvbootcamp?schema=public
PORTAL_LOGIN_URL=https://portal.jpvbootcamp.com/wp-admin
PORTAL_SET_PASSWORD_URL=https://portal.jpvbootcamp.com/wp-admin/users.php
WP_BASE_URL=https://portal.jpvbootcamp.com
WP_ADMIN_USERNAME=admin_JPV
WP_APPLICATION_PASSWORD=cAgz 2W5m rSmk NUh8 iHKb fKPZ
WP_ROLE_DEFAULT=Subscriber
EMAIL_REPLY_TO=enquiries@jpvbootcamp.com
WEBHOOK_IDEMPOTENCY_TTL_HOURS=24
N8N_API_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI4NTJiOGY2YS04YmNjLTQ3NDMtOTZiNi02NmZlMmMwMzAyYWYiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwiaWF0IjoxNzYyMTcxOTMxfQ.0L_qrzsV6YjX8gCDvyO9G5sIwu5Fbj8dwBajy-UE3sU
N8N_API_URL=https://n8n.prochat.tools/api/v1
N8N_WEBHOOK_URL=https://n8n.prochat.tools/webhook/jpvbootcamp
RESEND_API_KEY=re_KpozaZpF_31fgnxYkzuDHzPS64N1heV4A
RESEND_BASE_URL=https://api.resend.com
RESEND_FROM=enquiries@jpvbootcamp.com
EMAIL_FROM=enquiries@jpvbootcamp.com
SUPPORT_TO_EMAIL=enquiries@jpvbootcamp.com
STRIPE_ENV=live
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_51Sed9ULQNsjxBhGBnKALJCBUoqc4PnOD0rdHOtl32iVxXa3rV3tQPGrOeLiUCamO93AC4gnW7VsCq3UKu6yZxKGF00pH0zo3Pg
STRIPE_SECRET_KEY_LIVE=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
STRIPE_WEBHOOK_SECRET_LIVE=whsec_PAbc7pwg0LWM8riIWZjZeegVqghPyB0e
STRIPE_PRICE_PRO_LIVE=price_1SxrfjLQNsjxBhGBftkAnvkq
STRIPE_PRICE_VIP_LIVE=price_1SxrfxLQNsjxBhGBMjg7ndEo
STRIPE_PRODUCT_JPV_BOOTCAMP_PRO_MEMBERSHIP_LIVE=prod_Tvj7d4LMAxVVta
STRIPE_PRODUCT_JPV_BOOTCAMP_VIP_MEMBERSHIP_LIVE=prod_Tvj8HliPtISF2K
SPONSORED_PRO_PRICE_ID_LIVE=price_1Sxrg0LQNsjxBhGBghyXuV6K
SPONSORED_VIP_PRICE_ID_LIVE=price_1Sxrg1LQNsjxBhGBIuRSN1rD
STRIPE_PRICE_TABLE_LIVE=price_1Sxrg4LQNsjxBhGB9N8fwHvI
STRIPE_PORTAL_CONFIGURATION_ID_LIVE=bpc_1SxrtlLQNsjxBhGBqAv6AU32
DISABLE_NON_WEBHOOK_EMAILS=1
NEXT_PUBLIC_PORTAL_UPGRADE_URL=https://portal.jpvbootcamp.com/upgrade
STRIPE_SUCCESS_URL=https://jpvbootcamp.com/thank-you?session_id={CHECKOUT_SESSION_ID}
STRIPE_CANCEL_URL=https://jpvbootcamp.com
BILLING_PORTAL_HMAC_SECRET=044613c63a1e071ced00be85c3fd06f75a3aa82964d7e5a0973ed10d496e5cb2
\`\`\`

### 5. web-public-prochat-avejzq (ProChat App)

\`\`\`
APP_SLUG=prochat
NODE_ENV=production
NODE_OPTIONS=--max-old-space-size=3072
TENANT_DB_PASSWORD=30df11c3d6fd088ccf264a9dda9d601e705d959a7a8f6c53
DATABASE_URL=postgresql://prochat_user:30df11c3d6fd088ccf264a9dda9d601e705d959a7a8f6c53@10.0.2.4:5433/prochat?schema=prochat
SYSTEM_DATABASE_URL=postgresql://supabase_admin:HdgqzDjeGzta3VcE7nNCfKCGyEcwU4XV@10.0.2.4:5433/postgres?schema=public
SHADOW_DATABASE_URL=postgresql://supabase_admin:HdgqzDjeGzta3VcE7nNCfKCGyEcwU4XV@10.0.2.4:5433/postgres?schema=public
NEXT_PUBLIC_APP_URL=https://prochat.tools
NEXT_PUBLIC_SITE_URL=https://prochat.tools
PORT=3000
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_Y2xlcmsucHJvY2hhdC50b29scyQ
CLERK_SECRET_KEY=sk_live_yP5jjr1kklTUvKOXNRN8RGDsDwKDdz8qgtpE4mImfB
CLERK_DISABLED=false
NEXT_PUBLIC_CLERK_DISABLED=false
ADMIN_EMAILS=info@prochat.tools
ADMIN_CLERK_IDS=user_32EY6NWTpMbM0UDa3FWHbcwE7dm
STRIPE_MODE=live
NEXT_PUBLIC_STRIPE_MODE=live
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY_LIVE=pk_live_51SxE7KDmzmvnZunZPb0f5eAPE8ejQk7H5GI3aqnxX0Q9K5Hv2KZ2uTdOx0xusPellO8xLGucbHbkpL61luhMrzMU004of1oIDE
STRIPE_SECRET_KEY_LIVE=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
STRIPE_WEBHOOK_SECRET_LIVE=whsec_dgE4tblsTLTgPcv1JeagEkmCvWjOoxYJ
STRIPE_PRICE_PROKIT_LIVE=price_1SxEIcDmzmvnZunZFySW6A0t
STRIPE_PRODUCT_PROKIT_LIVE=prod_Tv4RYsJiiQ1o8Y
STRIPE_PRICE_SAASKIT_LIVE=price_1T4TL6DmzmvnZunZ4bf9CJyf
STRIPE_PRODUCT_SAASKIT_LIVE=prod_Tv4Roh4OHhN9Om
GITHUB_APP_ID=2894390
GITHUB_APP_INSTALLATION_ID=Iv23liTLQp1UAkY9qSwl
GITHUB_APP_PRIVATE_KEY_BASE64=[SEE RAW FILE]
RESEND_API_KEY=frs_ibJEZePh_pj_TFZ1--alS6W2xi_3TV5kreaos3-Hb
RESEND_BASE_URL=https://resend.prochat.tools/api
CONTACT_FROM_EMAIL=info@prochat.tools
WAITLIST_FROM_EMAIL=info@prochat.tools
WAITLIST_ADMIN_EMAIL=info@prochat.tools
MAILERLITE_API_KEY=[SEE RAW FILE]
NEXT_PUBLIC_UMAMI_SCRIPT_URL=https://umami.prochat.tools/script.js
NEXT_PUBLIC_UMAMI_WEBSITE_ID=5ceba17d-4125-4a75-a1f6-9add5c4b1803
LINKEDIN_CLIENT_ID=788aeawdf7o6v1
LINKEDIN_CLIENT_SECRET=WPL_AP1.zqATwWnJllc1sGak.D0uidA==
\`\`\`

---

## Other Applications Backed Up

- web-public-yeshua-academy-ariw56 (Yeshua Academy)
- web-public-viadieden-kttqn4 (Viadieden)
- web-public-olivetoorganizing-zwthea (Olive To Organizing)
- web-public-prochat-accountant-zrekal (Prochat Accountant)
- web-public-jccp-holdings-pvtist (JCCP Holdings)
- web-cedula-b1gepj (Cédula)

All have similar structure with DATABASE_URL, Stripe keys, Clerk auth, and service integrations.

---

## Next Steps to Restore

1. **IMMEDIATE (Next 30 minutes):** Download this file and store in `~/.config/dokploy/` for manual reference
2. **CRITICAL:** Do NOT restart any containers without first re-entering env vars
3. **Via Dokploy UI:**
   - Re-create each project
   - Re-add each application
   - Manually re-enter all DATABASE_URL, SECRET, and API_KEY values from this file
4. **Alternative:** Use Dokploy API to bulk-import application settings (if you have the JSON schema)

---

## Backup Method

Extracted via: `docker inspect <container> --format='{{json .Config.Env}}'` on 2026-04-13T07:32Z

File location (local): `/tmp/dokploy_env_backup.txt` (synced to this repo)
