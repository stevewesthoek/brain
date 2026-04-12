# ProBot Sessions & macOS Accessibility

## Overview

ProBot displays and manages sessions from three AI tools: Claude, Codex, and Gemini. This document explains how sessions work, how to use them, and an important technical detail about macOS Accessibility permissions.

## What are Sessions?

A session is a continuous conversation thread within a specific AI tool (Claude, Codex, or Gemini) in a specific repository/directory.

### Session Types

**Claude Sessions:**
- Stored in `~/.claude/projects/**/*.jsonl`
- Each session is a JSONL file (one JSON object per line)
- Session headline is extracted from the first user message
- Session ID is the filename (UUID format)
- Resume command: `claude --resume <session-id>`

**Codex Sessions:**
- Stored in `~/.codex/sessions/**/*.jsonl`
- Similar JSONL format with different message structure
- Session headline extracted from first user message
- Session ID derived from filename
- Resume command: `codex resume <session-id>`

**Gemini Sessions:**
- Stored in `~/.gemini/tmp/<project-name>/chats/*.json`
- JSON files (not JSONL)
- Session headline uses `sessionId` or first user message
- Resume command: `gemini --resume <index>` where index is per-project position
- Indexed by project name

## Session Display in ProBot Dashboard

The ProBot dashboard shows the top resumable sessions across all three tools.

### Session Information

Each session card displays:

- **Tool badge**: Claude | Codex | Gemini (color-coded)
- **Repository**: Where the session took place
- **Intent label**: Inferred category (e.g., "deploy · brain", "bugfix · probot")
- **Age**: How long ago the session was last active
- **Headline**: Multi-line description (up to 3 lines, 250 characters) of what the session was about
- **Live badge**: Whether the session has an active tmux window
- **Open in Ghostty button**: Resumes the session in a new Ghostty window

### Session Headline Extraction

Session headlines are automatically extracted from each tool's first user message:

1. **Claude**: First user message, stripped of metadata
2. **Codex**: First developer message content, with system/permissions messages filtered out
3. **Gemini**: Session ID or first user message

Headlines are limited to 250 characters and wrap across up to 3 lines in the dashboard for readability.

## Opening Sessions with "Open in Ghostty"

The "Open in Ghostty" button in the dashboard opens a new Ghostty window and resumes the session automatically.

### How It Works

1. **If Ghostty is already running**:
   - Opens a new window in the existing Ghostty application (Cmd+N)
   - Automatically pastes the session resume command (Cmd+V)
   - Automatically presses Enter
   - Session starts in the new window

2. **If Ghostty is not running**:
   - Starts Ghostty
   - Waits 500ms for the window to appear
   - Pastes the session resume command (Cmd+V)
   - Presses Enter
   - Session starts

### Behind the Scenes

- The command is copied to your clipboard as a fallback
- If AppleScript keystroke automation fails, you can manually paste (Cmd+V) and press Enter
- Each session includes the correct working directory and tool-specific resume ID

## macOS Accessibility Permission: "node" vs "ProBot"

### Important ⚠️

When ProBot opens a new Ghostty window with "Open in Ghostty", macOS will ask for **Accessibility permission**. 

**The permission dialog will show "node", NOT "ProBot".**

This is expected and correct. **Do not delete "node" from your Accessibility permissions**, as it is actually ProBot.

### Why Does It Say "node"?

ProBot is distributed as a compiled standalone executable using `pkg`, which bundles Node.js runtime with the application. When ProBot requests Accessibility permission to automate Ghostty keystrokes (paste + Enter), macOS identifies the requesting process by the underlying Node.js runtime name, not the app name.

### Technical Details

- ProBot runs as an app bundle: `ProBot.app/Contents/MacOS/ProBot`
- The executable wrapper uses `exec` to call the embedded Node.js binary
- macOS's permission system checks the actual runtime binary name at the OS level, which is the Node.js process
- Therefore, the Accessibility permission dialog displays "node"

We attempted to work around this:
1. Setting `process.title = "ProBot"` — worked in Activity Monitor but not in Accessibility dialogs
2. Creating macOS app bundle with Info.plist — still identified as "node" at permission-check time
3. Shell wrapper with `exec` — same result

The fundamental constraint is that macOS Accessibility permission checks occur at the OS level before user code executes, so it sees the runtime executable name ("node"), not the application wrapper name.

### What This Means for You

**In macOS System Preferences → Security & Privacy → Accessibility:**

- You will see **"node"** in the list of apps with Accessibility permission
- This is **ProBot** — do not delete it
- If you accidentally delete it, the "Open in Ghostty" feature will prompt you to re-grant permission

### If You See Multiple "node" Entries

If you have multiple Node.js applications on your Mac, you may see more than one "node" entry in Accessibility. Deleting the wrong one could affect those apps. To be safe:

1. Leave all "node" entries in place (they are unlikely to cause problems)
2. Identify ProBot's "node" entry by checking **System Preferences → Security & Privacy → Accessibility → Details** and looking for the newest entry after you used "Open in Ghostty"

Alternatively, if you need to be certain:
1. Disable all "node" entries in Accessibility
2. Restart ProBot: `open /Users/Office/Repos/stevewesthoek/brain/projects/probot/ProBot.app`
3. Click "Open in Ghostty" in the dashboard
4. macOS will prompt for permission — approve it
5. The "node" entry that appears is ProBot

## Running ProBot

### Starting ProBot

```bash
# Via app bundle (preferred for daily use)
open /Users/Office/Repos/stevewesthoek/brain/projects/probot/ProBot.app

# Via command line
/Users/Office/Repos/stevewesthoek/brain/projects/probot/ProBot.app/Contents/MacOS/ProBot &
```

### Configuration

1. Copy `.env.example` to `~/.config/probot/.env`
2. Fill in your Telegram token and user IDs
3. Optionally add Slack bot/app tokens and user IDs
4. Restart ProBot for changes to take effect

### Building from Source

```bash
npm install
npm run build
pkg . --targets node18-macos-x64 --output probot-new
cp probot-new ProBot.app/Contents/MacOS/probot-bin
```

## Troubleshooting

### "Open in Ghostty" Opens Multiple Windows

- Each click should create exactly one new window
- If multiple windows appear, check System Preferences → Accessibility and make sure the ProBot "node" entry is enabled
- Restart ProBot if needed

### Session Headlines Show as "(unnamed)"

- This should not happen anymore — all Codex and Claude sessions extract their first user message
- If you see "(unnamed)", it means the session file was corrupted or empty
- Try scrolling to other sessions or restarting ProBot

### "Open in Ghostty" Doesn't Paste the Command Automatically

- Check System Preferences → Security & Privacy → Accessibility
- Make sure "node" has Accessibility permission enabled
- If it's disabled, click the lock icon, approve it, then try again

### I Accidentally Deleted "node" from Accessibility

- Simply use "Open in Ghostty" again
- macOS will prompt you to grant permission again
- Approve it, and the entry will be re-added

## Related

- Main README: [README.md](./README.md)
- Technical Spec: [SPEC.md](./SPEC.md)
- Dashboard Guide: See README.md "Dashboard" section
