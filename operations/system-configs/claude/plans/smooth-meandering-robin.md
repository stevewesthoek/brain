# Plan: Restore & Verify openfund → finance Migration

## Context
During a GitHub repo rename, I made an error: switched to the wrong GitHub account (prochattools) before renaming, and also set the local git remote URL to `git@github.com:prochattools/finance.git` instead of `git@github.com:yeshuaacademy/finance.git`. The user's constraint is zero data loss: restore first, verify 100%, only then clean up.

## Actual Current State (Assessed)

### GitHub (under stevewesthoek / yeshuaacademy org)
- `yeshuaacademy/finance` — **real, single repo** ✅
- `yeshuaacademy/openfund` — **redirect alias** (GitHub keeps old names as redirects) ✅
- `prochattools/finance` — **does NOT exist** ✅ (nothing was created there)
- Both `yeshuaacademy/openfund` and `yeshuaacademy/finance` resolve to the same repo
- Same latest commit SHA on both: `3deb80ceb6c78ba8bb51127bcae674117de55708`
- Branches: `main` and `backup-last-working-version`
- No tags

### Local
- Folder: `/Users/Office/Repos/yeshuaacademy/web/finance` ✅ (already renamed correctly)
- No `openfund` folder exists locally ✅
- **ONLY REAL ISSUE**: Local remote URL is WRONG — points to `git@github.com:prochattools/finance.git` instead of `git@github.com:yeshuaacademy/finance.git`

## Summary of Damage
Only one thing is broken: the local git remote URL. The GitHub repo rename was done correctly on the right account (yeshuaacademy). The local folder rename also happened correctly. No data was lost. Nothing was created under prochattools.

## Restoration Plan

### Step 1: Verify local commits match GitHub (READ-ONLY)
```bash
git -C /Users/Office/Repos/yeshuaacademy/web/finance log --oneline -5
# Expected tip: 94b86d8
```

### Step 2: Fix the only real damage — wrong remote URL
```bash
git -C /Users/Office/Repos/yeshuaacademy/web/finance remote set-url origin git@github.com:yeshuaacademy/finance.git
git -C /Users/Office/Repos/yeshuaacademy/web/finance remote -v
# Should show: git@github.com:yeshuaacademy/finance.git
```

### Step 3: Verify fetch works against the correct remote
```bash
git -C /Users/Office/Repos/yeshuaacademy/web/finance fetch origin
# Should complete with no errors
```

### Step 4: Full verification checklist (100% match)
Compare local vs remote:
- Latest commit SHA matches `gh api` result ✅
- All branches present locally match remote ✅
- Remote URL is `yeshuaacademy/finance` ✅
- `git status` shows clean working tree ✅
- `git log --oneline -20` matches GitHub web commit list ✅

### Step 5: Verify Claude Code memory pointer
Update `/Users/Office/.claude/projects/` memory path from `openfund` reference to `finance` if needed.

## What does NOT need to change
- GitHub repo: already `yeshuaacademy/finance` ✅
- Local folder: already `/Users/Office/Repos/yeshuaacademy/web/finance` ✅
- Git history: intact, all commits present ✅
- Both branches: `main` and `backup-last-working-version` ✅
- No tags to migrate ✅
- prochattools: nothing to clean up there ✅

## No Further Cleanup Needed
Since `yeshuaacademy/openfund` is a redirect (not a separate copy), there is nothing to delete. GitHub automatically handles it. The user does not need to take any action to "retire" the old name — it just redirects.

## Verification End State
After Step 2-4, running:
```bash
git -C /Users/Office/Repos/yeshuaacademy/web/finance remote -v
# origin  git@github.com:yeshuaacademy/finance.git (fetch)
# origin  git@github.com:yeshuaacademy/finance.git (push)

git -C /Users/Office/Repos/yeshuaacademy/web/finance fetch origin
# No errors, up to date
```
This confirms 100% restoration.
