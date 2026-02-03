# Git + Dokploy Workflow Guide

## Rules
- Push directly to `main`.
- Production deploys are **tag-gated**. Only tags deploy.
- Every production release must be a semver tag (e.g., `v1.0.0`).
- No PR/branch preview deployments.
- Roll back by redeploying a previous tag (or tagging a known-good commit).

## Steps
1. git checkout main && git pull origin main
2. git add . && git commit -m "Message"
3. git push origin main
4. git tag vX.Y.Z
5. git push origin vX.Y.Z
6. Verify deploy in Dokploy

## Automation Tasks

### Release Tag (Deploy to Production)
```bash
git checkout main
git pull origin main
git add .
git commit -m "Message"
git push origin main
git tag vX.Y.Z
git push origin vX.Y.Z
```

### Rollback (Tag Known-Good Commit)
```bash
# Create a new tag that points to the last known-good commit
git tag vX.Y.Z <good-commit-sha>
git push origin vX.Y.Z
```
