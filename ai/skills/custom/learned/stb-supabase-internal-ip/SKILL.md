---
name: stb-supabase-internal-ip
description: When the STB pipeline's Supabase MP3 upload fails with "fetch failed" from the Mac, the local .env points to localhost:8000 instead of the production Supabase at http://10.0.2.4:8000 (reachable via Tailscale).
---

# STB Pipeline: Supabase Upload Fails from Mac

## The insight

The Says the Bible app runs a self-hosted Supabase instance on the Dokploy server. Its Kong API gateway is at `http://10.0.2.4:8000` — an internal Docker network IP. From the Mac, this IP is reachable via **Tailscale subnet routing** (the Dokploy node advertises its internal subnets).

The local `.env` file ships with `SUPABASE_URL=http://localhost:8000` — a placeholder for a local Supabase dev stack that is not running. The pipeline step 6 (`06-publish-product.mjs`) calls `supabase.storage.upload()` which immediately fails with a generic `fetch failed` — no helpful error about wrong host.

The fix is to use the production Supabase credentials from Dokploy in the local `.env`. The internal IP `10.0.2.4:8000` works from the Mac as long as Tailscale is connected.

## When this applies

- `Pipeline failed: Supabase upload failed: fetch failed` in the pipeline log
- All upstream steps (TTS, mix, render, YouTube upload) succeeded
- `curl -s --max-time 5 -o /dev/null -w '%{http_code}' http://10.0.2.4:8000/` returns `401` (gateway up, auth needed) — good
- `curl -s --max-time 5 -o /dev/null -w '%{http_code}' http://localhost:8000/` returns `000` (connection refused) — local Supabase not running
- `node --env-file .env -e "const u=new URL(process.env.SUPABASE_URL); console.log(u.hostname)"` prints `localhost`

## The approach

1. **Confirm Tailscale is up**: `tailscale status | grep dokploy`
2. **Test 10.0.2.4:8000 reachability**: `curl -o /dev/null -w '%{http_code}' http://10.0.2.4:8000/` → expect `401`
3. **Pull production credentials from Dokploy**: says-the-bible app ID is `Hu9rBtZj7XRwD7oxRZ4v7`
   ```bash
   source ~/.config/dokploy/.env
   curl -s "https://dokploy.prochat.tools/api/application.one?applicationId=Hu9rBtZj7XRwD7oxRZ4v7" \
     -H "x-api-key: $DOKPLOY_API_KEY" | python3 -c "
   import json,sys; env=json.load(sys.stdin).get('env','')
   [print(l) for l in env.splitlines() if l.startswith('SUPABASE')]
   "
   ```
4. **Update `.env`** with production values

## The fix

Update these four lines in `.env` with production values from Dokploy:
```
SUPABASE_URL=http://10.0.2.4:8000
SUPABASE_ANON_KEY=<from Dokploy>
SUPABASE_SERVICE_ROLE_KEY=<from Dokploy>
NEXT_PUBLIC_SUPABASE_URL=http://10.0.2.4:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Dokploy, same as SUPABASE_ANON_KEY>
```

Test the connection:
```bash
node --env-file .env -e "
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
fetch(url + '/storage/v1/bucket', { headers: { apikey: key, Authorization: 'Bearer ' + key } })
  .then(r => r.json()).then(d => console.log('Buckets:', d.map(b=>b.name)))
  .catch(e => console.error('Failed:', e.message));
"
```
Expected output: `Buckets: ['audio']`

## Gotchas

- **Tailscale must be connected** for `10.0.2.4` to be reachable. If Tailscale is off or the subnet route is not advertised, the upload will still fail with `fetch failed`. Check `tailscale status`.
- **The nightly scheduler (3 AM) will also fail** if Tailscale drops at night. The pipeline runs at 3 AM Lisbon time — ensure Tailscale auto-reconnects on the Mac.
- **`SUPABASE_STORAGE_BUCKET_AUDIO=audio`** must also be set. The bucket name in production Supabase is `audio`.
- **step 6 runs after step 4 (YouTube upload)**. If step 4 succeeds but step 6 fails, the YouTube video exists but the `PipelineJob` status gets set to `failed`. After fixing Supabase, run `06-publish-product.mjs` directly for affected slugs — the YouTube upload won't re-run (idempotent) but step 6 will.
- **`Published: undefined`** in step 6 output is a cosmetic bug — the `publishProduct()` return value isn't used. Check for `[06-publish-product] Done.` instead.

## Context
Repo: says-the-bible  
Discovered: 2026-04-08  
Area: `scripts/pipeline/06-publish-product.mjs`, `.env`, Dokploy `applicationId=Hu9rBtZj7XRwD7oxRZ4v7`
