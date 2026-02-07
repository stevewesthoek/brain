#!/usr/bin/env node
// ProKit – ProChat's developer core boilerplate
// (c) 2025 Steve Westhoek / ProChat

const fs = require('fs')
const path = require('path')

const envPath = path.join(process.cwd(), '.env')

if (fs.existsSync(envPath)) {
  console.log('✅ .env already exists, skipping bootstrap')
  process.exit(0)
}

const postgresPort = (process.env.POSTGRES_PORT || '5433').trim()

// Default dev slug (repo folder name) + system connection
const repoSlug = path.basename(process.cwd())
const slug = repoSlug.trim()

if (!/^[a-z0-9_]+$/.test(slug)) {
  console.error(
    `❌ Repo folder name "${slug}" is not a valid APP_SLUG. Rename the repo to match [a-z0-9_]+.`
  )
  process.exit(1)
}

if (process.env.APP_SLUG && process.env.APP_SLUG !== slug) {
  console.error(
    `❌ APP_SLUG mismatch. Expected "${slug}" (repo name), got "${process.env.APP_SLUG}".`
  )
  process.exit(1)
}

const systemUrl =
  process.env.SYSTEM_DATABASE_URL ||
  `postgresql://postgres:postgres@localhost:${postgresPort}/postgres?schema=public`

const content = [
  `APP_SLUG=${slug}`,
  `NODE_ENV=development`,
  `POSTGRES_PORT=${postgresPort}`,
  `SYSTEM_DATABASE_URL=${systemUrl}`,
  `SHADOW_DATABASE_URL=${systemUrl}`,
  `# DATABASE_URL will be populated automatically after the first "npm run db:init"`,
  ''
].join('\n')

fs.writeFileSync(envPath, content, { encoding: 'utf8' })
console.log('✅ Created .env for development with default settings')
