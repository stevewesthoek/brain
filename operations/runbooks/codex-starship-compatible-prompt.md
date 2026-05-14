# Codex Starship Compatible Prompt

## Purpose

Codex App currently may render Nerd Font private-use glyphs incorrectly in its integrated terminal even when the Nerd Font is installed and works in Ghostty.

Keep the main Starship prompt for Ghostty at:

```text
operations/system-configs/starship/starship.toml
```

Use a Codex-specific Starship config next to it:

```text
operations/system-configs/starship/starship-codex.toml
```

The Codex config intentionally avoids Nerd Font glyphs, Powerline separators, and private-use icon ranges.

## `starship-codex.toml`

```toml
# Codex App compatible Starship prompt.
# Avoids Nerd Font private-use glyphs because Codex App's terminal may not render them.

scan_timeout = 30
command_timeout = 750

format = "$os$directory$git_branch$git_status$nodejs$docker_context$time$line_break$character"

[os]
disabled = false
format = "[$symbol]($style) "
style = "bold"

[os.symbols]
Macos = "macOS"
Linux = "Linux"
Ubuntu = "Ubuntu"
Windows = "Windows"

[directory]
format = "[$path]($style) "
style = "bold yellow"
truncation_length = 3
truncation_symbol = ".../"

[git_branch]
symbol = "git:"
format = "[$symbol$branch]($style) "
style = "bold green"

[git_status]
format = "([$all_status$ahead_behind]($style) )"
style = "bold green"

[nodejs]
symbol = "node:"
format = "[$symbol$version]($style) "
style = "bold cyan"

[docker_context]
symbol = "docker:"
format = "[$symbol$context]($style) "
style = "bold blue"

[time]
disabled = false
time_format = "%R"
format = "[$time]($style) "
style = "bold white"

[line_break]
disabled = false

[character]
success_symbol = "[>](bold green)"
error_symbol = "[>](bold red)"
vimcmd_symbol = "[<](bold green)"
vimcmd_replace_one_symbol = "[<](bold purple)"
vimcmd_replace_symbol = "[<](bold purple)"
vimcmd_visual_symbol = "[<](bold yellow)"
```

## Recommended symlink layout

Keep both files in the Brain repo:

```text
operations/system-configs/starship/starship.toml
operations/system-configs/starship/starship-codex.toml
```

Default Starship symlink:

```bash
ln -sf /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/starship/starship.toml ~/.config/starship.toml
```

Codex-specific config path:

```bash
ln -sf /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/starship/starship-codex.toml ~/.config/starship-codex.toml
```

## Shell activation

Set `STARSHIP_CONFIG` only when the shell is running under Codex App, before `eval "$(starship init zsh)"`:

```zsh
is_codex_app_terminal() {
  local pid=$$
  while [[ -n "$pid" && "$pid" != "1" ]]; do
    local comm
    comm="$(ps -p "$pid" -o comm= 2>/dev/null)"
    case "$comm" in
      *Codex.app*|*/Codex|*"/Applications/Codex.app"*)
        return 0
        ;;
    esac
    pid="$(ps -p "$pid" -o ppid= 2>/dev/null | tr -d ' ')"
  done
  return 1
}

if is_codex_app_terminal; then
  export STARSHIP_CONFIG="$HOME/.config/starship-codex.toml"
fi

eval "$(starship init zsh)"
```

## Verification

Inside Ghostty:

```bash
echo "$STARSHIP_CONFIG"
```

Expected: empty or `/Users/Office/.config/starship.toml` depending on local setup.

Inside Codex App terminal:

```bash
echo "$STARSHIP_CONFIG"
```

Expected:

```text
/Users/Office/.config/starship-codex.toml
```

Then run:

```bash
starship explain
```

The Codex prompt should use plain labels such as `macOS`, `git:main`, `node:v25.9.0`, `docker:orbstack`, and `>` instead of Nerd Font icons.

## Notes

The main Ghostty prompt remains the canonical Nerd Font prompt. Do not remove its icons unless the goal is to simplify the prompt everywhere.

If Codex App later renders Nerd Font glyphs reliably, remove the Codex override and use the main `starship.toml` again.
