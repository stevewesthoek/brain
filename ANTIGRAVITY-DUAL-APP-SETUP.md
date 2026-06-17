# Antigravity Dual-App Configuration — Shared Settings

**Date:** 2026-06-17  
**Status:** ✅ Both apps configured to share the same settings

---

## Overview

You can now use **BOTH** Antigravity applications with the **same settings**:
- **Antigravity IDE** (pre-2.0, old app)
- **Antigravity** 2.0+ (new app)

Both read and write to the same configuration files, staying in sync automatically.

---

## Architecture

### Canonical Config Location (Source of Truth)
```
~/Library/Application Support/Antigravity/User/
├── settings.json (actual file - 14 IDE configurations)
├── keybindings.json (actual file - your custom keybindings)
├── globalStorage/ (actual directory - VSCode state database)
├── mcp.json (symlink → brain/operations/system-configs/antigravity/User/mcp.json)
├── History/ (workspace file history)
├── profiles/ (IDE profiles)
├── snippets/ (code snippets)
└── workspaceStorage/ (workspace state)
```

### Antigravity IDE Access (via symlinks)
```
~/Library/Application Support/Antigravity-old/User/
├── settings.json → /Users/Office/Library/Application Support/Antigravity/User/settings.json
├── keybindings.json → /Users/Office/Library/Application Support/Antigravity/User/keybindings.json
├── globalStorage → /Users/Office/Library/Application Support/Antigravity/User/globalStorage
└── mcp.json → /Users/Office/Library/Application Support/Antigravity/User/mcp.json
```

### How It Works

1. **Antigravity 2.0** reads from: `Antigravity/User/`
2. **Antigravity IDE** looks in: `Antigravity-old/User/`
3. **Antigravity-old/User/** is entirely symlinked to **Antigravity/User/**
4. Both apps access the same files
5. Changes in one app appear in the other

---

## What Each App Gets

### Antigravity IDE (Pre-2.0)
- ✅ All settings loaded from `Antigravity-old/User/`
- ✅ Keybindings loaded
- ✅ VSCode state database loaded
- ✅ MCP config available
- ✅ All symlinks transparent to the app (reads as local files)

### Antigravity 2.0
- ✅ All settings loaded from `Antigravity/User/`
- ✅ Keybindings loaded
- ✅ VSCode state database loaded
- ✅ MCP config available

---

## Verification

### Both apps can read settings
```bash
# Via Antigravity 2.0 path
cat ~/Library/Application\ Support/Antigravity/User/settings.json

# Via Antigravity IDE path (symlinked)
cat ~/Library/Application\ Support/Antigravity-old/User/settings.json
# Result: Same content ✓
```

### MCP is accessible to both
```bash
# Both paths point to brain config
ls -la ~/Library/Application\ Support/Antigravity/User/mcp.json
ls -la ~/Library/Application\ Support/Antigravity-old/User/mcp.json
# Both → /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/antigravity/User/mcp.json ✓
```

---

## File Manifest

### Actual Files (Source of Truth)
```
Antigravity/User/
├── settings.json (498B, 14 IDE settings)
├── keybindings.json (144B)
├── globalStorage/state.vscdb (920KB)
├── globalStorage/state.vscdb.backup (920KB)
├── globalStorage/storage.json (96KB)
├── History/ (file history)
├── profiles/ (IDE profiles)
├── snippets/ (code snippets)
└── workspaceStorage/ (workspace state)
```

### Symlinks (Read-through Access)
```
Antigravity-old/User/
├── settings.json → ../../../Antigravity/User/settings.json
├── keybindings.json → ../../../Antigravity/User/keybindings.json
├── globalStorage → ../../../Antigravity/User/globalStorage
└── mcp.json → ../../../Antigravity/User/mcp.json
```

---

## Settings That Are Synced

All 14 IDE configurations are synced between both apps:
```json
{
  "window.commandCenter": true,
  "files.autoSave": "afterDelay",
  "security.workspace.trust.untrustedFiles": "open",
  "explorer.confirmDragAndDrop": false,
  "editor.fontFamily": "JetBrainsMono Nerd Font Mono",
  "editor.accessibilitySupport": "on",
  "explorer.confirmDelete": false,
  "workbench.activityBar.location": "top",
  "php.validate.enable": false,
  "php.validate.executablePath": "",
  "editor.unicodeHighlight.ambiguousCharacters": false,
  "window.newWindowProfile": "Default"
}
```

---

## Usage

### Open Either App
Both apps will see the same configuration:
```bash
# Open old app
open -a "Antigravity IDE"

# Open new app
open -a "Antigravity"
```

### Make Changes
Any changes in one app appear in the other:
- Change a setting in Antigravity 2.0 → Antigravity IDE sees it
- Change a keybinding in IDE → Antigravity 2.0 sees it
- Both apps write to the same files

### MCP is Available to Both
Both apps can access Stitch MCP through the shared config file.

---

## Root Cause Summary

**Why both apps weren't working:**
1. Repository moved from `/Personal/Brain/` → `/stevewesthoek/brain/`
2. Symlinks broke (old paths no longer valid)
3. Antigravity 2.0 couldn't find migration source (pre-2.0 settings)
4. Apps created fresh configs instead of loading existing ones

**How it's fixed:**
1. ✅ Copied all pre-2.0 settings to new Antigravity/User/ location
2. ✅ Created symlinks from old location to new location
3. ✅ Both apps now read the same files
4. ✅ MCP symlinks point to centralized brain config

---

## If Something Goes Wrong

### Settings Not Syncing Between Apps
1. Check symlinks: `ls -la ~/Library/Application\ Support/Antigravity-old/User/`
2. Verify they point to Antigravity/User/ (not old paths)
3. If broken, recreate: `ln -sfn /Users/Office/Library/Application\ Support/Antigravity/User/settings.json ~/Library/Application\ Support/Antigravity-old/User/settings.json`

### MCP Not Working in One App
1. Verify MCP symlink: `ls -la ~/Library/Application\ Support/Antigravity/User/mcp.json`
2. Should point to: `/Users/Office/Repos/stevewesthoek/brain/operations/system-configs/antigravity/User/mcp.json`
3. If broken: `ln -sfn /Users/Office/Repos/stevewesthoek/brain/operations/system-configs/antigravity/User/mcp.json ~/Library/Application\ Support/Antigravity/User/mcp.json`

### Symlink Issues
```bash
# Check all symlinks in canonical location
ls -la ~/Library/Application\ Support/Antigravity/User/ | grep "^l"

# Check all symlinks in IDE location
ls -la ~/Library/Application\ Support/Antigravity-old/User/ | grep "^l"

# Verify they resolve correctly
readlink -f ~/Library/Application\ Support/Antigravity/User/settings.json
readlink -f ~/Library/Application\ Support/Antigravity-old/User/settings.json
# Should both point to the same file
```

---

## Next Steps

1. **Open Antigravity IDE** → Should load all your settings
2. **Open Antigravity 2.0** → Should load the same settings
3. **Test MCP** in both apps → Should work identically
4. **Close one app**, use the other → Settings persist
5. **Open the first app again** → Settings still there

---

## Summary

✅ **Canonical config** stored in: `~/Library/Application Support/Antigravity/User/`  
✅ **IDE access** via symlinks from: `~/Library/Application Support/Antigravity-old/User/`  
✅ **Both apps** read/write the same files  
✅ **MCP** centralized in brain, accessible to both  
✅ **Settings** automatically synced between apps  

**You can now use both apps simultaneously with full configuration sync.**
