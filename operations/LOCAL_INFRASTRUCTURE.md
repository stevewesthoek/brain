# Local Infrastructure & Port Allocation

This document tracks all locally-running applications, their ports, and configuration details.

## Active Applications

| Application | Port | Purpose | Location | Start Command | Notes |
|-------------|------|---------|----------|----------------|-------|
| **xgrow** | 7080 | X-Gro: AI-powered Twitter content automation | `prochattools/saas/xgrow` | `npm run dev` | OAuth callback: `http://localhost:7080/api/auth/x/callback` |
| **ProBot Dashboard** | 7070 | ProBot control plane dashboard | `stevewesthoek/brain/projects/probot` | (see ProBot docs) | Main monitoring and management UI |
| **App 1** | 3050 | [Description] | [Path] | [Command] | [Notes] |

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

**Last Updated:** 2026-04-12  
**Maintained By:** Claude Code
