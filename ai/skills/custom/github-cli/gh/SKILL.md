---
name: gh
description: Use when the user asks to work with GitHub via the CLI — managing PRs, issues, repos, releases, GitHub Actions workflows, and account switching. Assumes GitHub CLI is installed globally via Homebrew and authenticated.
---

# GitHub CLI

## What this skill is for
Help Claude use the GitHub CLI (`gh`) safely and consistently for repository management, pull requests, issues, releases, workflow automation, and multi-account operations.

## Use this skill when
- Creating, reviewing, merging, or closing pull requests
- Managing issues (create, comment, close, list)
- Creating or managing GitHub releases and tags
- Triggering or monitoring GitHub Actions workflows
- Cloning, forking, or creating repositories
- Switching between GitHub accounts
- Querying repo state (status, checks, run logs)

## Do not use this skill for
- Direct Git operations (commits, rebases, branch management) — use `git` for those
- Operations on private org repos without confirming which account is active
- Destructive actions (delete repo, force-push, close PR) without explicit confirmation

## Safety rules
1. **Always verify active account first.** Run `gh auth status` before any operation that touches a specific org or repo. Wrong account = wrong repo context.
2. **Confirm before destructive actions.** State what you are about to do before closing issues, merging PRs, deleting releases, or deleting repos. Wait for confirmation.
3. **Never expose tokens.** Do not print, log, or commit GitHub tokens. The CLI manages auth via keyring — keep it there.
4. **Default to the active account.** `stevewesthoek` is the default active account. For `prochattools` org work, switch explicitly.
5. **Dry-run where possible.** Use `--dry-run` or `--preview` flags when available before executing mutations.

## Account setup (this machine)
Two accounts are configured:
- `stevewesthoek` — personal account, **active by default**, SSH protocol
- `prochattools` — org account, SSH protocol

Switch active account:
```bash
gh auth switch --user prochattools
gh auth switch --user stevewesthoek
```

Always check before cross-account work:
```bash
gh auth status
```

## Recommended workflow

```bash
# 1. Verify auth and active account
gh auth status

# 2. Confirm you are in the right repo context
gh repo view

# 3. Proceed with operation
```

## Example commands

### Auth
```bash
gh auth status
gh auth switch --user prochattools
gh auth login
```

### Repos
```bash
gh repo view
gh repo view owner/repo
gh repo clone owner/repo
gh repo create my-new-repo --private
gh repo list --limit 20
```

### Pull requests
```bash
gh pr list
gh pr view 123
gh pr create --title "My PR" --body "Description"
gh pr checkout 123
gh pr merge 123 --squash
gh pr close 123
gh pr checks 123
```

### Issues
```bash
gh issue list
gh issue view 42
gh issue create --title "Bug" --body "Steps to reproduce..."
gh issue comment 42 --body "Update here"
gh issue close 42
```

### GitHub Actions
```bash
gh workflow list
gh workflow run deploy.yml
gh run list --limit 10
gh run view 123456
gh run watch 123456
gh run logs 123456
```

### Releases
```bash
gh release list
gh release view v1.0.0
gh release create v1.0.0 --title "v1.0.0" --notes "Changelog here"
gh release delete v1.0.0
```

### Search and inspect
```bash
gh search repos "topic:stripe language:typescript"
gh api repos/owner/repo/pulls
gh api rate_limit
```

## Programmatic integration
When using `gh` inside pipeline or automation scripts:
- Always validate auth at startup: `gh auth status --active`
- Use `--json` flag for machine-readable output: `gh pr list --json number,title,state`
- Use `gh api` for endpoints not covered by top-level commands
- Set `GH_TOKEN` env var only when keyring auth is not available (CI/CD contexts)

```bash
# Machine-readable PR list
gh pr list --json number,title,headRefName,state | jq '.[] | select(.state == "OPEN")'

# Check if current branch has an open PR
gh pr view --json state,number,url
```

## Notes
- Installed at: `/opt/homebrew/bin/gh` (version 2.87.2, as of 2026-03-29)
- Install/upgrade: `brew install gh` / `brew upgrade gh`
- Docs: `gh help`, `gh <command> --help`
