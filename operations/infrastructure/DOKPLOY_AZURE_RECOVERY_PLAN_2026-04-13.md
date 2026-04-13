# DOKPLOY Azure Backup Recovery Plan — 2026-04-13

**Status:** Azure restore job in progress (e49677fa-9843-414e-a5e7-f07388e978d6)
**Source:** 2026-04-12 03:07 UTC backup (clean, pre-corruption)
**Goal:** Restore PostgreSQL database with all Dokploy metadata while retaining Ory installation

---

## Recovery Strategy

### Phase 1: Azure Restore (In Progress)
- **Job ID:** e49677fa-9843-414e-a5e7-f07388e978d6
- **Started:** 2026-04-13 07:41:45 UTC
- **ETA:** 15-30 minutes (complete by ~08:00-08:15 UTC)
- **Target:** Staging storage account `dokploybkstore66067`
- **What's being restored:** Full VM disk from 2026-04-12 backup containing:
  - OS and system files
  - Docker configuration
  - `/mnt/data-dokploy` volume (contains all Docker volumes including dokploy-postgres)

### Phase 2: Extract PostgreSQL Volume (Once Azure restore completes)

**Goal:** Recover the `dokploy-postgres` volume data from the restored disk

**Steps:**
1. Once Azure restore completes, Azure will have restored VHD files to `dokploybkstore66067` storage account
2. Create a temporary VM or attach the restored disk to the running Dokploy VM
3. Mount the restored `/mnt/data-dokploy` filesystem
4. Copy the PostgreSQL data directory:
   ```bash
   sudo cp -r /mnt/restored-data-dokploy/docker/volumes/dokploy-postgres/_data /tmp/postgres-backup-2026-04-12
   ```
5. Stop the running `dokploy-postgres` container
6. Replace the corrupted volume data with the backup:
   ```bash
   docker run --rm -v dokploy-postgres:/dbdata alpine rm -rf /dbdata/*
   docker run --rm -v dokploy-postgres:/dbdata -v /tmp/postgres-backup-2026-04-12:/backup alpine cp -r /backup/* /dbdata/
   ```
7. Restart PostgreSQL and verify:
   ```bash
   docker restart dokploy-postgres
   docker exec dokploy-postgres psql -U postgres -l
   ```

### Phase 3: Verify Ory Installation

**Goal:** Confirm Ory authentication platform is still accessible and operational

**Commands:**
```bash
# Check Ory container status
docker ps | grep ory

# Verify Ory database
docker exec ory-kratos pg_isready -U ory_user -h 10.0.2.4 -p 5433

# Test Ory public API
curl -s https://auth.prochat.tools/health/ready | jq '.'

# Check Ory logs for errors
docker logs ory-kratos --tail 50
```

**Success criteria:**
- ✅ Ory container running and healthy
- ✅ Ory database connection works (ory_prod database)
- ✅ `https://auth.prochat.tools/health/ready` returns 200 OK
- ✅ No recent errors in Ory logs

### Phase 4: Restore Dokploy Applications

Once PostgreSQL is restored with the clean schema, Dokploy will:
1. Detect the restored database
2. Load all application configurations that were backed up on 2026-04-12
3. All projects, applications, environment variables, GitHub provider settings, etc. will be restored

**Note:** Applications will retain their in-memory env vars from 2026-04-13 (captured before corruption), but Dokploy will now have the metadata to redeploy if containers restart.

---

## Risk Analysis

**LOWEST RISK for this approach:**
- PostgreSQL backup from 2026-04-12 is known to be clean (pre-corruption)
- Ory is on a separate database server (10.0.2.4:5433 ory_prod database) — unaffected by Dokploy corruption
- All application databases are on separate volumes — unaffected
- Only replacing the corrupted `dokploy-postgres` local volume

**WHAT COULD GO WRONG:**
1. PostgreSQL container fails to start after restore
   - **Recovery:** Initiate pg_recoverymode or dump/reload
2. Dokploy app container fails to connect to restored database
   - **Recovery:** Check DATABASE_URL env var, verify authentication
3. Ory is somehow affected (unlikely — different database)
   - **Recovery:** Ory is on ory_prod database at 10.0.2.4, completely separate

---

## Ory Deployment Details (Should be UNAFFECTED)

From earlier in this session:

**Ory Database Location:** `10.0.2.4:5433` (remote Supabase PostgreSQL)
- Database name: `ory_prod`
- Database user: `ory_user`
- This is NOT on the Dokploy server's local `/mnt/data-dokploy` volume
- Therefore, this recovery operation does NOT affect Ory

**Ory Container Location:** `ory-kratos` docker container on Dokploy server
- Uses remote database connection string: `postgresql://ory_user:ory_prod_secure_password@10.0.2.4:5433/ory_prod?sslmode=disable`
- Will continue to work even if local Dokploy PostgreSQL is temporarily down

---

## Timeline

- **07:41 UTC** — Restore job started
- **~08:00-08:15 UTC** — Restore job should complete
- **08:15-08:45 UTC** — Extract PostgreSQL volume data
- **08:45-09:00 UTC** — Replace corrupted volume
- **09:00-09:15 UTC** — Verify Ory and Dokploy operational

**Total recovery time: ~90 minutes**

---

## Fallback Plan (if Azure restore fails)

If the Azure restore job fails or completes with errors:
1. Fall back to the in-memory env var backup (captured 2026-04-13 07:32 UTC)
2. Manually recreate Dokploy projects and applications via UI or API
3. This takes longer but is still viable

---

## Success Metrics

- [ ] Azure restore job completes successfully
- [ ] PostgreSQL volume extracted and mounted
- [ ] Dokploy database restored and PostgreSQL container starts
- [ ] All Dokploy tables present: `deployment`, `environment`, `application`, `apikey`, `domain`, etc.
- [ ] Ory authentication still works at `https://auth.prochat.tools`
- [ ] All 12 applications still running with correct env vars in memory
- [ ] Zero data loss in dependent databases (n8n, Firecrawl, Umami, all app DBs)
