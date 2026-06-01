# NotebookLM CLI — Authentication & Persistence Runbook

**Maintained by:** Operational procedures  
**Last Updated:** 2026-06-01  
**Status:** ✅ Production ready (authenticated)

## Quick Start

Once authenticated (see "Initial Authentication" below), NotebookLM CLI works out of the box:

```bash
# List existing notebooks
notebooklm list

# Create a notebook
notebooklm create "My Notebook"

# Add a source (YouTube URL, PDF, web URL)
notebooklm source add "https://www.youtube.com/watch?v=dQw4w9WgXcQ"

# Wait for processing
notebooklm source wait <source_id> --timeout 300

# Get full transcript
notebooklm source fulltext <source_id>

# Check auth status
notebooklm auth check --test
```

## Initial Authentication

### First Time Setup (One-Time)

```bash
notebooklm login
```

This will:
1. Open a browser window to Google login
2. Prompt you to complete Google OAuth
3. Show the NotebookLM homepage when complete
4. Save authentication to `~/.notebooklm/storage_state.json`

**Action required:** Press ENTER in the terminal when you see the NotebookLM homepage.

After this, authentication is **persistent and automatic**.

## Persistence: How It Works

### Storage Locations

```
~/.notebooklm/
├── browser_profile/           # Chromium browser profile (persistent)
│   └── ... (session data)
├── storage_state.json         # Authentication state (CRITICAL)
└── context.json               # CLI context metadata
```

### Authentication State

`storage_state.json` contains:
- **Google session cookies** (18 total, including SID and secure tokens)
- **NotebookLM cookies** (_ga, _ga_W0LDH41ZCB, _gcl_au)
- **Token metadata** (expiry times, scope, refresh tokens)

This is automatically:
- **Saved to disk** after successful login
- **Loaded on each CLI command** (persistent between invocations)
- **Persistent across reboots** (in home directory)

### Verification

Check persistence status:

```bash
notebooklm auth check --test
```

Expected output:
```
┏━━━━━━━━━━━━━━━━━┳━━━━━━━━┳─────────────────────────────────────┓
┃ Check           ┃ Status ┃ Details                             ┃
├─────────────────┼────────┼─────────────────────────────────────┤
│ Storage exists  │ ✓ pass │ file (/Users/Office/.notebooklm/... │
│ JSON valid      │ ✓ pass │                                     │
│ Cookies present │ ✓ pass │ 18 cookies                          │
│ SID cookie      │ ✓ pass │ .google.com, .notebooklm.google.com │
│ Token fetch     │ ✓ pass │                                     │
└─────────────────┴────────┴─────────────────────────────────────┘
```

If **Token fetch** shows ✗ fail, see troubleshooting below.

## Troubleshooting

### Symptom: `Token fetch` fails after days/weeks of working

**Root cause:** Google session has expired (typical: 30-90 days)

**Fix:**
```bash
notebooklm login
# Follow browser prompts, press ENTER when done
notebooklm auth check --test  # Verify it passes
```

### Symptom: `Storage exists` or `JSON valid` fails

**Root cause:** Storage file corrupted or deleted

**Fix:**
```bash
rm -rf ~/.notebooklm/
notebooklm login
# Follow browser prompts as above
```

### Symptom: `Cookies present` or `SID cookie` fails

**Root cause:** Browser profile deleted or file permissions issue

**Fix:**
```bash
# Check file permissions
ls -la ~/.notebooklm/storage_state.json  # Should be readable

# If permissions are wrong, fix them
chmod 600 ~/.notebooklm/storage_state.json

# If still failing, re-authenticate
notebooklm login
```

### Symptom: CLI commands timeout or fail with "connection refused"

**Root cause:** NotebookLM service unreachable or network issue

**Workaround:** Retry with longer timeout:
```bash
notebooklm source wait <source_id> --timeout 600  # 10 min instead of 5
```

If persistent, check internet connection and try again later.

### Symptom: "Authentication expired or invalid" error

**Root cause:** Most common — Google OAuth token refresh failed

**Fix:**
```bash
notebooklm login
notebooklm auth check --test  # Verify pass
```

## CLI Usage in Workflows

### Brain Console — Video Analyzer

The video analyzer script (`brain/projects/brain-core/services/video-analyzer/analyze.py`) calls NotebookLM CLI automatically:

```python
# Inside analyze.py:
notebooklm auth check --test        # Fail fast if not authenticated
notebooklm create "Brain Video Analyzer"  # Get/create notebook
notebooklm source add <url> --json  # Add YouTube source
notebooklm source wait <source_id>  # Wait for processing
notebooklm source fulltext <source_id>  # Extract transcript
notebooklm source remove <source_id>  # Cleanup
```

If auth fails at any step, the Python script returns a clear error:
```json
{"ok": false, "error": "NotebookLM auth expired — run: notebooklm login", "step": "auth"}
```

### n8n Workflows

To use NotebookLM in n8n:

1. **Execute Command** step:
   ```bash
   source ~/.notebooklm/storage_state.json 2>/dev/null
   notebooklm source add "<URL>" --json | jq -r '.id'
   ```

2. **Wait with polling** (in a Loop step):
   ```bash
   notebooklm source wait "<source_id>" --timeout 300
   ```

3. **Extract result**:
   ```bash
   notebooklm source fulltext "<source_id>"
   ```

## Rotation & Renewal

### When to Re-Authenticate

| Trigger | Action |
|---------|--------|
| After system restart | Just use the CLI — no action needed (persisted) |
| After moving to new Mac | Run `notebooklm login` once on the new machine |
| After ~30–90 days of inactivity | `notebooklm auth check --test` will tell you if expired |
| After accidental deletion of `~/.notebooklm/` | Run `notebooklm login` to recreate |

### Proactive Check (Optional)

Set a monthly reminder to verify auth:

```bash
# Add to crontab or scheduled task
0 9 1 * * notebooklm auth check --test && echo "NotebookLM auth OK" || echo "ALERT: NotebookLM auth failed"
```

## Security Notes

- **No secrets in git:** `~/.notebooklm/` is in home directory, never committed
- **File permissions:** Treated as sensitive (600 recommended)
- **Cookie scope:** Limited to Google + NotebookLM domains
- **Revocation:** Delete `~/.notebooklm/storage_state.json` to immediately revoke local access

## FAQs

**Q: Will I need to authenticate again if I restart my Mac?**  
A: No. Authentication persists in `~/.notebooklm/storage_state.json` and is reloaded automatically.

**Q: What if I use NotebookLM on multiple Macs?**  
A: Each Mac needs its own authentication. Run `notebooklm login` once on each machine.

**Q: Can I backup the auth to restore on another machine?**  
A: Not recommended. Storage state is machine-specific and contains session cookies. Instead, run `notebooklm login` on each machine.

**Q: What if I want to revoke access?**  
A: Delete `~/.notebooklm/storage_state.json` and disconnect the app in Google account settings.

**Q: How long does auth last?**  
A: Typically 30–90 days before Google refreshes the session. The CLI will warn you and prompt to re-login when needed.

**Q: What happens if auth expires while a script is running?**  
A: The script will fail gracefully with a clear error message. Re-authenticate and retry.

## Reference

- **CLI version:** 0.3.4 (verify with `notebooklm --version`)
- **Install:** `~/.local/bin/notebooklm` (via pip + system PATH)
- **Commands:** `notebooklm --help` for full documentation
- **Storage:** `~/.notebooklm/` (auto-created, ~1–2 MB)
- **Credentials index:** `brain/operations/accounts/credentials-index.md` (metadata entry added 2026-06-01)
