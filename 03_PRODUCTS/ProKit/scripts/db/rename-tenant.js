#!/usr/bin/env node
// ProKit – ProChat engine boilerplate
// (c) 2025 Steve Westhoek / ProChat
/**
 * Rename a tenant schema + user + registry entry.
 *
 * Use this when the repo/app slug changes and you want to keep existing data.
 *
 * Usage:
 *   node scripts/db/rename-tenant.js --from old_slug --to new_slug [--apply]
 *
 * By default this script is DRY (no changes). Pass --apply to execute.
 *
 * Env:
 *   SYSTEM_DATABASE_URL  admin connection (required in production)
 */

const { Client } = require('pg')
const path = require('path')

function fail(msg) {
  console.error(`❌ ${msg}`)
  process.exit(1)
}

function info(msg) {
  console.log(`ℹ️ ${msg}`)
}

function parseArgs() {
  const args = process.argv.slice(2)
  const out = {
    from: '',
    to: '',
    apply: false
  }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--from' && args[i + 1]) out.from = args[++i]
    else if (a === '--to' && args[i + 1]) out.to = args[++i]
    else if (a === '--apply') out.apply = true
  }

  return out
}

function validateSlug(slug, flagName) {
  const safe = /^[a-z0-9_]+$/
  if (!slug || !safe.test(slug)) {
    fail(
      `${flagName} must match [a-z0-9_]+ (lowercase letters, numbers, underscores). Got "${slug}".`
    )
  }
}

async function getExists(client, sql, params) {
  const res = await client.query(sql, params)
  return Boolean(res.rows?.[0]?.exists)
}

async function main() {
  const env = process.env.NODE_ENV || 'development'
  const isProd = env === 'production'

  const { from: rawFrom, to: rawTo, apply } = parseArgs()
  const from = (rawFrom || '').trim()
  const to = (rawTo || '').trim()

  if (!from || !to) {
    fail('Usage: node scripts/db/rename-tenant.js --from <slug> --to <slug> [--apply]')
  }

  validateSlug(from, '--from')
  validateSlug(to, '--to')

  if (from === to) {
    info('No-op: --from and --to are the same.')
    return
  }

  let systemUrl = process.env.SYSTEM_DATABASE_URL
  if (!systemUrl) {
    if (isProd) {
      fail('SYSTEM_DATABASE_URL is required in production')
    }
    systemUrl = 'postgresql://postgres:postgres@localhost:5433/postgres?schema=public'
    info(`SYSTEM_DATABASE_URL not set, using default local Docker Postgres: ${systemUrl}`)
  }

  const fromSchema = `tenant_${from}`
  const toSchema = `tenant_${to}`
  const fromUser = `${fromSchema}_user`
  const toUser = `${toSchema}_user`

  const repoSlug = path.basename(process.cwd())
  if (!isProd && repoSlug !== to) {
    info(
      `Repo folder is "${repoSlug}". After rename, the repo/app slug is expected to be "${to}".`
    )
  }

  console.log('--------------------------------------------------')
  console.log(`🔁 Renaming tenant (${env})`)
  console.log(`From: ${from}`)
  console.log(`  schema: ${fromSchema}`)
  console.log(`  user:   ${fromUser}`)
  console.log(`To:   ${to}`)
  console.log(`  schema: ${toSchema}`)
  console.log(`  user:   ${toUser}`)
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`)
  console.log('--------------------------------------------------')

  const client = new Client({ connectionString: systemUrl })

  try {
    await client.connect()

    // Preflight: ensure source exists and target does not.
    const fromSchemaExists = await getExists(
      client,
      'SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS exists',
      [fromSchema]
    )
    if (!fromSchemaExists) fail(`Source schema does not exist: ${fromSchema}`)

    const toSchemaExists = await getExists(
      client,
      'SELECT EXISTS(SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS exists',
      [toSchema]
    )
    if (toSchemaExists) {
      fail(`Target schema already exists: ${toSchema}. Refusing to continue.`)
    }

    const fromUserExists = await getExists(
      client,
      'SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1) AS exists',
      [fromUser]
    )
    if (!fromUserExists) fail(`Source role does not exist: ${fromUser}`)

    const toUserExists = await getExists(
      client,
      'SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1) AS exists',
      [toUser]
    )
    if (toUserExists) {
      fail(`Target role already exists: ${toUser}. Refusing to continue.`)
    }

    // Registry table checks are best-effort (older installs may not have it).
    const tenantsReg = await client.query("SELECT to_regclass('public.tenants') AS reg")
    const hasTenants = Boolean(tenantsReg.rows?.[0]?.reg)
    let hasFromTenantRow = false

    if (hasTenants) {
      const fromRow = await client.query('SELECT slug FROM public.tenants WHERE slug = $1', [from])
      const toRow = await client.query('SELECT slug FROM public.tenants WHERE slug = $1', [to])
      if (toRow.rowCount > 0) {
        fail(`public.tenants already contains slug "${to}". Refusing to continue.`)
      }
      hasFromTenantRow = fromRow.rowCount > 0
      if (!hasFromTenantRow) {
        info(`public.tenants has no row for slug "${from}". Will skip registry update.`)
      }
    } else {
      info('public.tenants not found; skipping registry update.')
    }

    const sql = [
      `ALTER SCHEMA ${fromSchema} RENAME TO ${toSchema};`,
      `ALTER ROLE ${fromUser} RENAME TO ${toUser};`,
      // Re-assert the isolation/search_path contract under the new names.
      `REVOKE USAGE, CREATE ON SCHEMA public FROM PUBLIC;`,
      `REVOKE USAGE, CREATE ON SCHEMA public FROM ${toUser};`,
      `GRANT USAGE ON SCHEMA ${toSchema} TO ${toUser};`,
      `GRANT ALL PRIVILEGES ON SCHEMA ${toSchema} TO ${toUser};`,
      `ALTER ROLE ${toUser} SET search_path = ${toSchema}, pg_catalog;`
    ]

    if (hasTenants && hasFromTenantRow) {
      sql.push(
        `UPDATE public.tenants
           SET slug = '${to}',
               schema_name = '${toSchema}',
               db_user = '${toUser}',
               updated_at = now()
         WHERE slug = '${from}';`
      )
    }

    if (!apply) {
      info('Dry-run. SQL to be executed:')
      for (const stmt of sql) console.log(stmt)
      return
    }

    for (const stmt of sql) {
      await client.query(stmt)
    }

    console.log('✅ Tenant rename completed')
    console.log(`- slug:   ${from} -> ${to}`)
    console.log(`- schema: ${fromSchema} -> ${toSchema}`)
    console.log(`- user:   ${fromUser} -> ${toUser}`)
    console.log('--------------------------------------------------')
    console.log('Next steps:')
    console.log(`- Ensure Dokploy env APP_SLUG is set to "${to}"`)
    console.log(`- Re-run provisioning to rewrite .env/.env.production:`)
    console.log(`  npm run db:init -- --slug ${to}`)
  } catch (err) {
    console.error('❌ Error renaming tenant:', err)
    process.exit(1)
  } finally {
    await client.end().catch(() => {})
  }
}

main().catch((err) => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
