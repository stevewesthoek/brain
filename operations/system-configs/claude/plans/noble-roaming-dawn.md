# Plan: Production Database Migration — jpv-bootcamp sponsored_applications

## Context

The `/sponsored` form fails with "Unable to submit right now" because `sponsored_applications.decision` (and 5 other columns) are missing from the production database. These columns were added in migration `20260125183000_sponsored_anonymous_apply`, but that migration targeted the `tenant_jpvbootcamp` schema. Production now runs under the `jpvbootcamp` schema (set in Dokploy env `DATABASE_URL=...?schema=jpvbootcamp`), so the migration was never applied there.

Confirmed missing columns in `jpvbootcamp.sponsored_applications`:
- `decision text`
- `decided_at timestamptz`
- `tier text DEFAULT 'pro'`
- `seat_id uuid`
- `claim_token_sent_at timestamptz`
- `claimed_at timestamptz`

The `sponsored_seats` columns `reserved_by_application_id` and `reserved_at` (also from this migration) may also be missing and must be checked.

**Production DB:** `10.0.2.4:5433`, database `jpvbootcamp`, schema `jpvbootcamp`
**Admin credentials:** `SYSTEM_DATABASE_URL` — `supabase_admin` user

---

## Migration SQL (to be applied)

```sql
-- Targeted migration: 20260125183000_sponsored_anonymous_apply → jpvbootcamp schema
-- Applies only missing columns. All ADD COLUMN use IF NOT EXISTS (idempotent).

BEGIN;

-- sponsored_applications: add missing columns
ALTER TABLE jpvbootcamp.sponsored_applications
  ADD COLUMN IF NOT EXISTS decision text,
  ADD COLUMN IF NOT EXISTS decided_at timestamptz,
  ADD COLUMN IF NOT EXISTS tier text DEFAULT 'pro',
  ADD COLUMN IF NOT EXISTS seat_id uuid,
  ADD COLUMN IF NOT EXISTS claim_token_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz;

-- Drop NOT NULL constraint on wp_user_id (anonymous applications support)
ALTER TABLE jpvbootcamp.sponsored_applications
  ALTER COLUMN wp_user_id DROP NOT NULL;

-- Backfill tier for any existing rows
UPDATE jpvbootcamp.sponsored_applications
  SET tier = 'pro'
  WHERE tier IS NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS sponsored_applications_email_idx
  ON jpvbootcamp.sponsored_applications (email);

CREATE INDEX IF NOT EXISTS sponsored_applications_seat_id_idx
  ON jpvbootcamp.sponsored_applications (seat_id);

-- sponsored_seats: add reservation columns (same migration)
ALTER TABLE jpvbootcamp.sponsored_seats
  ADD COLUMN IF NOT EXISTS reserved_by_application_id uuid,
  ADD COLUMN IF NOT EXISTS reserved_at timestamptz;

CREATE INDEX IF NOT EXISTS sponsored_seats_reserved_by_application_id_idx
  ON jpvbootcamp.sponsored_seats (reserved_by_application_id);

COMMIT;
```

---

## Execution Plan (8 steps — in order, no step skipped)

### Step 1 — Backup

SSH to Dokploy server and take a full schema dump:

```bash
ssh dokploy "pg_dump \
  -h 10.0.2.4 -p 5433 \
  -U supabase_admin \
  -d jpvbootcamp \
  -n jpvbootcamp \
  --format=custom \
  --file=/home/ubuntu/backups/jpvbootcamp-pre-sponsored-migration-$(date +%Y%m%d-%H%M%S).dump"
```

Env: set `PGPASSWORD` from `SYSTEM_DATABASE_URL`.

### Step 2 — Verify backup is valid

```bash
ssh dokploy "pg_restore --list /home/ubuntu/backups/jpvbootcamp-pre-sponsored-migration-*.dump | grep -c 'TABLE DATA'"
```

Must return a non-zero count. Also confirm file size > 0. If either check fails — **stop, do not proceed**.

### Step 3 — Check current state

Confirm exactly which columns are present/missing before touching anything:

```bash
ssh dokploy "PGPASSWORD='...' psql -h 10.0.2.4 -p 5433 -U supabase_admin jpvbootcamp \
  -c \"SELECT column_name FROM information_schema.columns \
       WHERE table_schema='jpvbootcamp' AND table_name='sponsored_applications' \
       ORDER BY ordinal_position;\""
```

Also check `sponsored_seats`:

```bash
... -c "SELECT column_name FROM information_schema.columns
         WHERE table_schema='jpvbootcamp' AND table_name='sponsored_seats'
         ORDER BY ordinal_position;"
```

Document the current state before proceeding.

### Step 4 — Dry run (transaction with ROLLBACK)

Write the migration SQL to a file, then run it wrapped in `BEGIN; ... ROLLBACK;`:

```bash
ssh dokploy "PGPASSWORD='...' psql -h 10.0.2.4 -p 5433 -U supabase_admin jpvbootcamp \
  -c \"BEGIN;
  [full migration SQL here]
  ROLLBACK;\""
```

Must complete with **no errors**. If any error — **stop, do not proceed to step 5**.

### Step 5 — Real run (transaction with COMMIT)

Run the exact same SQL with `COMMIT` instead of `ROLLBACK`:

```bash
ssh dokploy "PGPASSWORD='...' psql -h 10.0.2.4 -p 5433 -U supabase_admin jpvbootcamp \
  -c \"BEGIN;
  [full migration SQL here]
  COMMIT;\""
```

### Step 6 — Post-migration column check

Re-run the `information_schema.columns` query from Step 3 and confirm all 6 new columns are present in `sponsored_applications`. If any column is missing — **stop, go to Step 8 (rollback)**.

### Step 7 — Application smoke test

Hit the live API from Dokploy server:

```bash
curl -s -X POST https://jpvbootcamp.com/api/sponsored-applications \
  -H "Content-Type: application/json" \
  -d '{"name":"Migration Test","email":"migrationtest+DELETE@example.com","message":"dry run test"}' | python3 -m json.tool
```

Expected: `{"ok": true, "outcome": "created_new", ...}` — **not** a 500 error.

Also check container logs immediately after:

```bash
ssh dokploy "docker logs ff9c20a7a1b2 2>&1 | tail -20"
```

No Prisma column errors should appear.

If the API returns a 500 or logs show Prisma errors — **go to Step 8 (rollback)**.

If smoke test succeeds — **report back to user. Migration complete.**

### Step 8 — Rollback (only if Step 6 or 7 fails)

```bash
ssh dokploy "PGPASSWORD='...' pg_restore \
  -h 10.0.2.4 -p 5433 \
  -U supabase_admin \
  -d jpvbootcamp \
  --schema=jpvbootcamp \
  --clean \
  /home/ubuntu/backups/jpvbootcamp-pre-sponsored-migration-*.dump"
```

Then verify container logs show no new errors.

---

## Safety rules

- **Backup is NEVER deleted** until the user explicitly instructs it.
- Each step must succeed before the next begins — no exceptions.
- If Step 4 (dry run) fails, the real migration is never run.
- All DDL is wrapped in a single transaction — partial application is impossible.
- The `IF NOT EXISTS` guards on all `ADD COLUMN` and `CREATE INDEX` make the script safe to re-run.

---

## Files involved

- `prisma/schema.prisma` — defines the expected model (read-only reference)
- `prisma/migrations/20260125183000_sponsored_anonymous_apply/migration.sql` — source of migration SQL
- `src/app/api/sponsored-applications/route.ts` — the API endpoint that fails
- No code changes are needed — this is a database-only fix.
