# Shell Config

This folder holds the portable shell configuration that is sourced on this machine.

## What's tracked

- `.zshrc` — canonical shared shell behavior, aliases, and non-secret environment setup
- `.zprofile` — login-shell setup
- `.zshrc.local.template` — template for local-only secrets and machine-specific credentials

## What's local only

- `.zshrc.local` — ignored local overlay for secrets, connection strings, client secrets, and other machine-only values

## Rule

Keep portable shell logic in Git.
Do not commit secrets, credentials, or machine-only endpoints here.
If a value is sensitive, load it from `.zshrc.local` instead of putting it in `.zshrc`.
