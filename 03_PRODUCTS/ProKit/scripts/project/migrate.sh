#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-check}"
APPLY="false"
if [[ "$MODE" == "--apply" ]]; then
  APPLY="true"
elif [[ "$MODE" != "check" ]]; then
  echo "usage: ./scripts/project/migrate.sh [--apply]" >&2
  exit 1
fi

fail() {
  echo "$1" >&2
  exit 1
}

warn() {
  echo "$1" >&2
}

if [[ ! -f package.json ]]; then
  fail "package.json not found"
fi

if [[ ! -f nixpacks.toml ]]; then
  if [[ "$APPLY" == "true" ]]; then
    cat <<'TOML' > nixpacks.toml
[phases.setup]
nixPkgs = ["postgresql_15"]
TOML
  else
    fail "nixpacks.toml missing (required for postgresql_15 client tools)"
  fi
fi

if ! rg -q "postgresql_15" nixpacks.toml 2>/dev/null; then
  warn "nixpacks.toml missing postgresql_15; update it to include Postgres 15 client tools"
  if [[ "$APPLY" == "false" ]]; then
    exit 1
  fi
fi

if [[ ! -x ./scripts/runtime/start-prod.sh ]]; then
  fail "missing scripts/runtime/start-prod.sh (sync ProKit scripts)"
fi

if [[ ! -x ./scripts/db/deploy-prod.sh ]]; then
  fail "missing scripts/db/deploy-prod.sh (sync ProKit scripts)"
fi

node <<'NODE'
const fs = require('fs');
const path = 'package.json';
const data = JSON.parse(fs.readFileSync(path, 'utf8'));
const scripts = data.scripts || {};
const start = scripts.start;
const hasStartApp = Object.prototype.hasOwnProperty.call(scripts, 'start:app');
const hasVerify = scripts['verify:deploy'] === './scripts/db/verify.sh';

if (start !== './scripts/runtime/start-prod.sh') {
  if (!hasStartApp && start) {
    scripts['start:app'] = start;
  }
  scripts.start = './scripts/runtime/start-prod.sh';
}

if (!hasStartApp) {
  scripts['start:app'] = 'next start -p $PORT';
}

scripts['verify:deploy'] = './scripts/db/verify.sh';

data.scripts = scripts;
fs.writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
NODE

if [[ -f .env.production ]]; then
  if ! rg -q '^APP_SLUG=' .env.production; then
    warn ".env.production missing APP_SLUG"
  fi
  if ! rg -q '^DATABASE_URL=.*schema=tenant_' .env.production; then
    warn ".env.production DATABASE_URL missing tenant schema"
  fi
  if ! rg -q '^SYSTEM_DATABASE_URL=.*schema=public' .env.production; then
    warn ".env.production SYSTEM_DATABASE_URL missing public schema"
  fi
fi

echo "migration check complete";
if [[ "$APPLY" == "true" ]]; then
  echo "package.json updated to use runtime gate and verify script"
fi
