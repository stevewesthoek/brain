# Local Infrastructure & Port Allocation

This document tracks all locally-running applications, their ports, and configuration details.

## Active Applications

| Application | Port | Purpose | Location | Start Command | Notes |
|-------------|------|---------|----------|----------------|-------|
| **xgrow** | 7080 | X-Gro: AI-powered Twitter content automation | `prochattools/saas/xgrow` | `npm run dev` | OAuth callback: `http://localhost:7080/api/auth/x/callback` |
| **ProBot Dashboard** | 7070 | ProBot control plane dashboard | `stevewesthoek/brain/projects/probot` | (see ProBot docs) | Main monitoring and management UI |
| **Via di Eden** | 3057 | Client website with TinaCloud CMS | `prochattools/clients/via-di-eden` | ProBot Local Apps registry | Local app port 3057; local OrbStack Postgres 5447. Production uses `https://viadieden.com`, not localhost. |
| **Olive To Organizing** | 3059 | Client website with TinaCloud CMS | `prochattools/clients/olive-to-organizing` | ProBot Local Apps registry | Local app port 3059; local OrbStack Postgres 5445. Production uses `https://olivetoorganizing.com`, not localhost. |

## Local Database Ports

| Application | Port | Database | Compose Path | Notes |
|-------------|------|----------|--------------|-------|
| **Olive To Organizing** | 5445 | `olivetoorganizing` | `operations/database/standalone/olivetoorganizing/docker-compose.yml` | Reserved standalone OrbStack Postgres stack. |
| **Family Finance** | 5452 | `family_finance` | `operations/database/standalone/familyfinance/docker-compose.yml` | Reserved standalone OrbStack Postgres stack. |

## Port Allocation Policy

- **3000–3999**: Development & testing (ephemeral, first-come-first-served)
- **7000–7999**: Fixed, always-on local applications (fixed allocation)
  - **7070**: ProBot Dashboard (reserved)
  - **7080**: xgrow (reserved)

Reserve new ports by updating this file and committing the change.

## Configuration References

### xgrow

**Development Environment** (`.env`)
```
X_REDIRECT_URI=http://localhost:7080/api/auth/x/callback
NEXT_PUBLIC_APP_URL=http://localhost:7080
```

**Production Environment** (`.env.production`)
```
X_REDIRECT_URI=https://xgrow.prochat.tools/api/auth/x/callback
NEXT_PUBLIC_APP_URL=https://xgrow.prochat.tools
```

**Docker Configuration** (`Dockerfile`)
```
EXPOSE 7080
```

### Adding a New Application

1. Choose the next available port in the 7000–7999 range
2. Update this file with the new application entry
3. Configure the application to use the selected port
4. Commit the change to document the reservation

---

**Last Updated:** 2026-05-05  
**Maintained By:** Claude Code
