---
name: ghostty-term-zshrc-conflict
description: When Ghostty terminal mangles wrapped lines or paste output, check for unconditional TERM override in .zshrc — it breaks readline cursor/width calculation by replacing Ghostty's precise terminfo.
---

# Ghostty TERM Override Conflict

## The insight
Ghostty sets `TERM=xterm-ghostty` at launch, which points to a terminfo entry with Ghostty-specific capabilities. If `.zshrc` unconditionally runs `export TERM=xterm-256color`, it replaces this before readline initializes — causing zsh and readline to miscalculate prompt width and cursor position. When a line wraps at the terminal edge, the shell thinks the cursor is somewhere it isn't, and subsequent output overwrites the wrong location.

## When this applies
- Long commands or paste output gets visually corrupted/overwritten when reaching the right edge of the terminal
- Prompt appears to "eat" typed characters after a line wrap
- Copy-pasting multi-line text produces garbled output
- Only happens in Ghostty, not in other terminals

## The approach
Check what `TERM` is actually set to in the running shell: `echo $TERM`. If it's `xterm-256color` but you're running Ghostty, something in your shell config is overriding it. Search `.zshrc` and `.zprofile` for unconditional `export TERM=`.

## The fix
Make the override conditional so it only applies when Ghostty hasn't already set `TERM`:

```zsh
# In .zshrc — only fallback to xterm-256color on remote servers, not locally in Ghostty
[[ "$TERM" == "xterm-ghostty" ]] || export TERM=xterm-256color
```

File: `brain/operations/system-configs/shell/.zshrc`

The original unconditional line was added for SSH compatibility (remote servers don't have the `xterm-ghostty` terminfo entry). The conditional preserves that behavior: local Ghostty keeps its own TERM, remote SSH sessions still get `xterm-256color`.

## Gotchas
- Running `source ~/.zshrc` mid-session won't test the fix properly — `TERM` is already set. Open a **new tab** to verify.
- If you SSH to a remote server and see "unknown terminal type", check that the server's `.zshrc` (if zsh) has this same conditional, or add `SetEnv TERM=xterm-256color` to `~/.ssh/config` on the client.

## Context
Repo: brain  
Discovered: 2026-04-06  
Area: `operations/system-configs/shell/.zshrc`
