#!/usr/bin/env bash
set -euo pipefail

slug="${1:-${APP_SLUG:-}}"

if [[ -z "$slug" ]]; then
  echo "usage: ./scripts/project/bootstrap.sh <app-slug>" >&2
  echo "or set APP_SLUG and re-run" >&2
  exit 1
fi

if [[ ! "$slug" =~ ^[a-z0-9_]+$ ]]; then
  echo "invalid APP_SLUG: $slug (allowed: [a-z0-9_]+)" >&2
  exit 1
fi

export APP_SLUG="$slug"

if ! npm run -s db:init -- --slug "$APP_SLUG"; then
  echo "db:init failed; ensure the ProKit db scripts are installed" >&2
  exit 1
fi

if [[ ! -f .env || ! -f .env.production ]]; then
  echo "expected .env and .env.production to be created by db:init" >&2
  exit 1
fi

echo "bootstrap complete for APP_SLUG=$APP_SLUG"
echo "Next steps:"
echo "- Review .env and .env.production"
echo "- Set Dokploy env vars from .env.production"
echo "- Add Dokploy bind mount /var/backups/pgdump -> /var/backups/pgdump (RW)"
