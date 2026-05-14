# Codex Starship Config

## Problem

Ghostty renders the normal Starship prompt correctly, but Codex App's integrated terminal does not render the Nerd Font private-use glyphs reliably. The canonical Starship config uses Nerd Font and Powerline glyphs in:

```text
operations/system-configs/starship/starship.toml
```

That file is the source behind:

```text
~/.config/starship.toml
```

Use a separate Codex-only Starship config so Ghostty keeps the nice prompt while Codex gets a glyph-safe prompt.

## Desired files

Place this file next to the normal Starship config:

```text
operations/system-configs/starship/starship-codex.toml
```

Then symlink it to:

```text
~/.config/starship-codex.toml
```

## `starship-codex.toml`

```toml
# Starship config for Codex App and other terminals that fail Nerd Font glyph rendering.
#
# Keep the normal Nerd Font prompt in starship.toml for Ghostty.
# Point Codex-only shells at this file with:
#   export STARSHIP_CONFIG="$HOME/.config/starship-codex.toml"

scan_timeout = 30
command_timeout = 750

format = "$os$username$directory$git_branch$git_status$nodejs$docker_context$time$line_break$character"

palette = 'gruvbox_dark'

[palettes.gruvbox_dark]
color_fg0 = '#fbf1c7'
color_bg1 = '#3c3836'
color_bg3 = '#665c54'
color_blue = '#458588'
color_aqua = '#689d6a'
color_green = '#98971a'
color_orange = '#d65d0e'
color_purple = '#b16286'
color_red = '#cc241d'
color_yellow = '#d79921'

[os]
disabled = false
format = "[$symbol]($style) "
style = "bold fg:color_orange"

[os.symbols]
Windows = "win"
Ubuntu = "ubuntu"
SUSE = "suse"
Raspbian = "raspbian"
Mint = "mint"
Macos = "mac"
Manjaro = "manjaro"
Linux = "linux"
Gentoo = "gentoo"
Fedora = "fedora"
Alpine = "alpine"
Amazon = "aws"
Android = "android"
AOSC = "aosc"
Arch = "arch"
Artix = "artix"
EndeavourOS = "endeavouros"
CentOS = "centos"
Debian = "debian"
Redhat = "redhat"
RedHatEnterprise = "rhel"
Pop = "pop"

[username]
show_always = false
style_user = "bold fg:color_orange"
style_root = "bold fg:color_red"
format = '[$user@]($style)'

[directory]
style = "bold fg:color_yellow"
format = "[$path]($style) "
truncation_length = 3
truncation_symbol = ".../"

[directory.substitutions]
"Documents" = "Documents"
"Downloads" = "Downloads"
"Music" = "Music"
"Pictures" = "Pictures"
"Developer" = "Developer"

[git_branch]
symbol = "git:"
style = "bold fg:color_aqua"
format = '[$symbol$branch]($style) '

[git_status]
style = "fg:color_aqua"
format = '[$all_status$ahead_behind]($style) '

[nodejs]
symbol = "node "
style = "fg:color_blue"
format = '[$symbol($version)]($style) '

[c]
symbol = "c "
style = "fg:color_blue"
format = '[$symbol($version)]($style) '

[cpp]
symbol = "cpp "
style = "fg:color_blue"
format = '[$symbol($version)]($style) '

[rust]
symbol = "rust "
style = "fg:color_blue"
format = '[$symbol($version)]($style) '

[golang]
symbol = "go "
style = "fg:color_blue"
format = '[$symbol($version)]($style) '

[php]
symbol = "php "
style = "fg:color_blue"
format = '[$symbol($version)]($style) '

[java]
symbol = "java "
style = "fg:color_blue"
format = '[$symbol($version)]($style) '

[kotlin]
symbol = "kotlin "
style = "fg:color_blue"
format = '[$symbol($version)]($style) '

[haskell]
symbol = "haskell "
style = "fg:color_blue"
format = '[$symbol($version)]($style) '

[python]
symbol = "python "
style = "fg:color_blue"
format = '[$symbol($version)]($style) '

[docker_context]
symbol = "docker:"
style = "fg:color_bg3"
format = '[$symbol$context]($style) '

[conda]
style = "fg:color_bg3"
format = '[(conda $environment)]($style) '

[pixi]
style = "fg:color_bg3"
format = '[(pixi $version $environment)]($style) '

[time]
disabled = false
time_format = "%R"
style = "fg:color_bg1"
format = '[$time]($style) '

[line_break]
disabled = false

[character]
disabled = false
success_symbol = '[>](bold fg:color_green)'
error_symbol = '[>](bold fg:color_red)'
vimcmd_symbol = '[<](bold fg:color_green)'
vimcmd_replace_one_symbol = '[<](bold fg:color_purple)'
vimcmd_replace_symbol = '[<](bold fg:color_purple)'
vimcmd_visual_symbol = '[<](bold fg:color_yellow)'
```

## Symlink

Run from the `brain` repo root:

```bash
ln -sf "$PWD/operations/system-configs/starship/starship-codex.toml" "$HOME/.config/starship-codex.toml"
```

The normal Starship symlink should remain:

```text
~/.config/starship.toml -> brain/operations/system-configs/starship/starship.toml
```

## Shell selection for Codex

Add this before `eval "$(starship init zsh)"` in the shared `.zshrc` once the shell config file is available for editing:

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
```

Keep the existing Starship init line after this block:

```zsh
eval "$(starship init zsh)"
```

## Verification

In Ghostty:

```bash
echo "$STARSHIP_CONFIG"
```

Expected: empty or `~/.config/starship.toml`, depending on current shell setup.

In Codex App:

```bash
echo "$STARSHIP_CONFIG"
```

Expected:

```text
/Users/Office/.config/starship-codex.toml
```

Then reload the prompt:

```bash
exec zsh -l
```

Codex should show ASCII-safe labels such as `mac`, `git:main`, `node v25.9.0`, `docker:orbstack`, and `>` instead of missing icon boxes.

## Implementation note

A BuildFlow preflight on 2026-05-13 found the target file path `operations/system-configs/starship/starship-codex.toml` is readable but blocked by the current source write policy. The runbook is saved here until the write policy allows direct edits under `operations/system-configs/starship/` or the file is created manually.
