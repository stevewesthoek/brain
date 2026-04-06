---
name: nextjs-sqlite-buildtime-crash
description: When `next build` crashes during "Collecting page data" with "Cannot open database because the directory does not exist" — Next.js executes module-level code at build time, so a top-level better-sqlite3 open() fails if the data directory isn't present in the builder stage.
---

# Next.js SQLite Buildtime Crash

## The insight
`next build` runs "Collecting page data" which imports every route module and executes top-level (module-level) code. If your database module calls `new Database(path)` at the top level (not inside a function), `better-sqlite3` tries to open the file immediately. If the directory in `path` doesn't exist inside the Docker builder stage, the build fails — even though the app would work fine at runtime.

The fix is to create the data directory in the builder stage before `npm run build`, so `better-sqlite3` can create the DB file (even a throw-away one) without erroring.

## When this applies
Error during `next build` at the "Collecting page data" step:
```
TypeError: Cannot open database because the directory does not exist
  at module evaluation (.next/server/chunks/[root-of-the-server]__*.js)
> Build error occurred
Error: Failed to collect page data for /api/<route>
```

Applies to any route that imports a module with a top-level `new Database(path)` call, where `path` includes a directory that only exists at runtime (e.g. `./data/`, `/var/lib/app/`).

## The approach
Two valid fixes — choose based on code ownership:

1. **Quick (Dockerfile fix)**: Create the data directory in the builder stage. The DB file created there is a build artifact; it doesn't affect the runtime volume.
2. **Proper (code fix)**: Make DB initialization lazy — wrap `new Database()` in a function called on first use, not at module load. This prevents the build-time import from opening any file.

The Dockerfile fix is faster and sufficient for now. The code fix is better long-term (avoids surprising side effects during `next build`).

## The fix
**Dockerfile fix** — add `mkdir` before `npm run build`:
```dockerfile
FROM node:20-bookworm AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# better-sqlite3 opens the DB at module-eval time during page data collection
RUN mkdir -p /app/data
RUN npm run build
```

**Code fix** (lazy init pattern for better-sqlite3 + drizzle):
```ts
// lib/db.ts
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const sqlite = new Database(process.env.DATABASE_PATH ?? './data/app.db');
    _db = drizzle(sqlite);
  }
  return _db;
}
```

## Gotchas
- If using a Docker volume for `/app/data` at runtime, the `mkdir` in the builder stage is harmless — the volume overlays the directory at container start
- This pattern surfaces any time a Next.js page/API route imports a module that does I/O at load time: DB connections, file reads, socket opens
- The error shows a mangled chunk filename (`[root-of-the-server]__0gk0z59._.js`) — trace back through the route that failed collection, not the chunk

## Context
Repo: xgrow (prochattools/saas/xgrow)  
Discovered: 2026-04-05  
Area: src/lib/db.ts, Dockerfile builder stage
