// ProKit – ProChat's developer core boilerplate
// (c) 2025 Steve Westhoek / ProChat
// scripts/db/cleanup-tenant.js
// Deletes a tenant schema + user + registry row.
//
// Usage:
//   node scripts/db/cleanup-tenant.js --slug pr_42
//   node scripts/db/cleanup-tenant.js --slug prokit --force   # dangerous

const { Client } = require('pg')
const fs = require('fs')
const path = require('path')

function parseArgs() {
  const args = process.argv.slice(2)
  const result = { slug: process.env.APP_SLUG || '', force: false }

  for (let i = 0; i < args.length; i++) {
    const a = args[i]
    if (a === '--slug' && args[i + 1]) {
      result.slug = args[++i]
    } else if (a === '--force') {
      result.force = true
    }
  }

  if (!result.slug) {
    console.error('❌ Missing tenant slug. Set APP_SLUG or pass --slug <slug>.')
    process.exit(1)
  }

  if (!/^[a-z0-9_]+$/.test(result.slug)) {
    console.error(
      `❌ Invalid slug "${result.slug}". Only lowercase letters, numbers and underscores are allowed.`
    )
    process.exit(1)
  }

  return result
}

function loadEnvFile(envPath) {
  if (!fs.existsSync(envPath)) return {}
  const lines = fs
    .readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.trim().length > 0 && !l.trim().startsWith('#'))

  const map = {}
  for (const line of lines) {
    const idx = line.indexOf('=')
    if (idx <= 0) continue
    const key = line.slice(0, idx).trim()
    const value = line.slice(idx + 1).trim()
    map[key] = value
  }
  return map
}

function hydrateProcessEnvFromDotenv(dotenvPath) {
  const fileEnv = loadEnvFile(dotenvPath)
  for (const [key, value] of Object.entries(fileEnv)) {
    if (!process.env[key] && typeof value === 'string' && value.length > 0) {
      process.env[key] = value
    }
  }
}

async function main() {
  const env = process.env.NODE_ENV || 'development'
  const isProd = env === 'production'

  // In local/dev, allow configuring scripts via .env without needing to export vars.
  if (!isProd) {
    hydrateProcessEnvFromDotenv(path.join(process.cwd(), '.env'))
  }

  const { slug, force } = parseArgs()

  let systemUrl = process.env.SYSTEM_DATABASE_URL

  if (!systemUrl) {
    if (isProd) {
      console.error('❌ SYSTEM_DATABASE_URL is required in production')
      process.exit(1)
    }
    const postgresPort = (process.env.POSTGRES_PORT || '5433').trim()
    systemUrl =
      `postgresql://postgres:postgres@localhost:${postgresPort}/postgres?schema=public`
    console.log(
      'ℹ️ SYSTEM_DATABASE_URL not set, using default local Docker Postgres:',
      systemUrl
    )
  }

  const client = new Client({ connectionString: systemUrl })

  console.log('--------------------------------------------------')
  console.log(`🧹 Cleaning up tenant "${slug}" (force=${force})`)
  console.log('--------------------------------------------------')

  try {
    await client.connect()

    const { rows } = await client.query(
      `SELECT slug, schema_name, db_user, type FROM public.tenants WHERE slug = $1`,
      [slug]
    )

    if (rows.length === 0) {
      console.log('ℹ️ No tenant row found; nothing to clean up.')
      return
    }

    const tenant = rows[0]

    if (tenant.type !== 'preview' && !force) {
      console.error(
        `❌ Refusing to drop non-preview tenant "${slug}" (type=${tenant.type}). Use --force to override.`
      )
      process.exit(1)
    }

    const schemaName = tenant.schema_name || `tenant_${slug}`
    const dbUser = tenant.db_user || `tenant_${slug}_user`

    console.log(`Schema: ${schemaName}`)
    console.log(`User:   ${dbUser}`)

    const identSafe = /^[a-z0-9_]+$/
    if (!identSafe.test(schemaName) || !identSafe.test(dbUser)) {
      throw new Error(
        `Refusing to operate on unsafe identifiers (schema="${schemaName}", role="${dbUser}")`
      )
    }

    await client.query(`DROP SCHEMA IF EXISTS ${schemaName} CASCADE;`)

    await client.query(`DROP ROLE IF EXISTS ${dbUser};`)

    await client.query(`DELETE FROM public.tenants WHERE slug = $1`, [slug])

    console.log('✅ Tenant cleanup completed.')
  } catch (err) {
    console.error('❌ Error cleaning up tenant:', err)
    process.exitCode = 1
  } finally {
    await client.end()
  }
}

main()
