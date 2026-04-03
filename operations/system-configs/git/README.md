# Git Config

This folder holds synced Git configuration used by this machine.

## What's canonical here

- `gitconfig` — shared Git aliases, credential helper wiring, and account routing
- `gitconfig-demo` — account-specific identity override used by the include rules in `gitconfig`
- `ignore` — global Git ignore entries

## Rule

Keep only durable Git config in this folder.

- Tracked files here may reference stable repo roots or account names
- Do not put tokens, passwords, or machine-generated state in tracked Git config
- If a credential requires a secret, store it in the external helper or ignored local machine config, not here
