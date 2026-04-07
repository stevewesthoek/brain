#!/usr/bin/env python3
# sync-credentials — scan ~/.config/ for .env files and append untracked
# credential variables to the Pending section of credentials-index.md.
#
# Usage:
#   sync-credentials          # prints summary + updates index
#   sync-credentials --quiet  # suppresses output, still updates index
#
# Only .env-style files are scanned (KEY=value or export KEY=value).
# JSON credential files (GWS, etc.) are tracked manually in the index.

import os
import sys
import re
import subprocess
from pathlib import Path
from datetime import date

quiet = "--quiet" in sys.argv
home = Path.home()
brain_root = home / "Repos/stevewesthoek/brain"
index_path = brain_root / "operations/accounts/credentials-index.md"
placeholder = "| — | — | — |"
today = date.today().isoformat()


def log(msg=""):
    if not quiet:
        print(msg)


if not index_path.exists():
    print(f"ERROR: credentials-index.md not found at {index_path}", file=sys.stderr)
    sys.exit(1)

index_content = index_path.read_text()

# Find all .env files under ~/.config
env_files = sorted(
    p for p in home.joinpath(".config").rglob("*")
    if p.is_file()
    and (p.name == ".env" or p.name.endswith(".env"))
    and not any(p.name.endswith(s) for s in (".env.example", ".env.sample", ".env.template"))
)

log(f"Scanning {len(env_files)} .env file(s) under ~/.config...")

new_rows = []

for env_file in env_files:
    rel_path = "~/" + str(env_file.relative_to(home))
    file_fragment = env_file.parent.name + "/" + env_file.name

    try:
        raw = env_file.read_text(errors="replace")
    except Exception:
        continue

    for line in raw.splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        line = re.sub(r"^export\s+", "", line)
        if "=" not in line:
            continue
        var_name = line.split("=")[0].strip().strip('"\'')
        if not re.match(r"^[A-Z][A-Z0-9_]{2,}$", var_name):
            continue

        # Check if (file_fragment, var_name) already exists on any index line
        already_tracked = any(
            var_name in idx_line and file_fragment in idx_line
            for idx_line in index_content.splitlines()
        )
        if already_tracked:
            continue

        row = f"| `{var_name}` | `{rel_path}` | {today} |"
        new_rows.append(row)
        log(f"  + {var_name}  ({rel_path})")

if not new_rows:
    log("All credentials already tracked. No changes.")
    sys.exit(0)

new_block = "\n".join(new_rows)

if placeholder in index_content:
    updated = index_content.replace(placeholder, new_block, 1)
else:
    updated = index_content.rstrip() + "\n" + new_block + "\n"

index_path.write_text(updated)

log()
log(f"Added {len(new_rows)} new entry/entries to Pending in credentials-index.md.")
log("Next step: move each row to the right section and fill in Purpose, Rotation, and Regenerate.")
