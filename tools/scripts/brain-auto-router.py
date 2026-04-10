#!/usr/bin/env python3
"""
Brain Auto-Router: Automated GTD routing for inbox notes.

This script runs every 1 minute (via cron) and:
1. Scans notes/01-inbox/ for files with status: unrouted
2. Extracts confidence and signal_quality scores from frontmatter
3. Routes based on decision tree:
   - confidence >= 0.8 AND signal_quality >= 0.8 → 03-projects/ or 02-strategy/brainstorm, status: ready-for-review
   - confidence >= 0.5 AND signal_quality >= 0.5 → stays in 01-inbox/, status: review-queue
   - signal_quality < 0.5 → 08-archive/, status: archived-low-signal
   - else → 08-archive/, status: archived-vague
4. Updates frontmatter and moves file to new location via GitHub API
5. Logs all actions to ~/.local/share/brain/logs/auto-router.log

Cron Schedule: Every 1 minute
  */1 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py

Configuration:
  - GITHUB_TOKEN: Required, stored in ~/.config/github/.env or GITHUB_TOKEN env var
  - REPO: stevewesthoek/brain
  - LOG_DIR: ~/.local/share/brain/logs/

Logs:
  - Success routed files to LOG_DIR/auto-router.log
  - Errors to both stdout and LOG_DIR/auto-router-error.log
  - Check logs with: tail -f ~/.local/share/brain/logs/auto-router.log

Manual Execution:
  python3 ~/Repos/stevewesthoek/brain/tools/scripts/brain-auto-router.py
"""

import os
import sys
import re
import json
import logging
import base64
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple
import subprocess

# Configuration
REPO_USER = "stevewesthoek"
REPO_NAME = "brain"
REPO_BRANCH = "main"
INBOX_PATH = "notes/01-inbox"
LOG_DIR = Path.home() / ".local" / "share" / "brain" / "logs"

# Setup logging
LOG_DIR.mkdir(parents=True, exist_ok=True)
log_file = LOG_DIR / "auto-router.log"
error_log_file = LOG_DIR / "auto-router-error.log"

logger = logging.getLogger("brain-auto-router")
logger.setLevel(logging.DEBUG)

# File handler for main log
fh = logging.FileHandler(log_file)
fh.setLevel(logging.INFO)

# File handler for error log
eh = logging.FileHandler(error_log_file)
eh.setLevel(logging.ERROR)

# Console handler
ch = logging.StreamHandler()
ch.setLevel(logging.ERROR)

formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
fh.setFormatter(formatter)
eh.setFormatter(formatter)
ch.setFormatter(formatter)

logger.addHandler(fh)
logger.addHandler(eh)
logger.addHandler(ch)


def get_github_token() -> str:
    """Get GitHub token from env var or config file."""
    # Try env vars
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_PAT")
    if token:
        return token

    # Try config file
    config_file = Path.home() / ".config" / "github" / ".env"
    if config_file.exists():
        with open(config_file) as f:
            for line in f:
                if line.startswith("GITHUB_TOKEN="):
                    return line.split("=", 1)[1].strip()
                elif line.startswith("GITHUB_PAT="):
                    return line.split("=", 1)[1].strip()

    raise RuntimeError("GITHUB_TOKEN/GITHUB_PAT not found in env or ~/.config/github/.env")


def run_git_command(args: list) -> str:
    """Run a git command and return output."""
    cmd = ["git", "-C", str(Path.home() / "Repos" / REPO_USER / REPO_NAME)] + args
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Git command failed: {' '.join(cmd)}\n{result.stderr}")
    return result.stdout.strip()


def get_inbox_files() -> list:
    """Get list of .md files in inbox folder."""
    try:
        output = run_git_command(["ls-tree", "-r", REPO_BRANCH, INBOX_PATH])
        files = []
        for line in output.split("\n"):
            if not line:
                continue
            # Format: 100644 blob <sha> <path>
            parts = line.split()
            if len(parts) >= 4 and parts[1] == "blob" and parts[3].endswith(".md"):
                files.append(parts[3])
        return files
    except Exception as e:
        logger.error(f"Failed to list inbox files: {e}")
        return []


def get_file_content(filepath: str) -> Optional[str]:
    """Get file content from git."""
    try:
        content = run_git_command(["show", f"{REPO_BRANCH}:{filepath}"])
        return content
    except Exception as e:
        logger.error(f"Failed to get file content {filepath}: {e}")
        return None


def extract_frontmatter(content: str) -> dict:
    """Extract frontmatter from markdown file."""
    match = re.match(r"---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return {}

    frontmatter = match.group(1)
    data = {}

    for line in frontmatter.split("\n"):
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        key = key.strip()
        value = value.strip().strip('"')

        # Try to parse as float if it looks like a number
        if re.match(r"^[\d.]+$", value):
            try:
                data[key] = float(value)
            except:
                data[key] = value
        else:
            data[key] = value

    return data


def decide_route(confidence: float, signal_quality: float, para_type: str) -> Tuple[str, str]:
    """
    Decision tree routing logic.

    Returns: (route_folder, new_status)
    """
    if signal_quality >= 0.8 and confidence >= 0.8:
        route = "03-projects" if para_type == "project" else "02-strategy/brainstorm"
        return route, "ready-for-review"
    elif signal_quality >= 0.5 and confidence >= 0.5:
        return "01-inbox", "review-queue"
    elif signal_quality < 0.5:
        return "08-archive", "archived-low-signal"
    else:
        return "08-archive", "archived-vague"


def update_file_status(content: str, new_status: str) -> str:
    """Update status field in frontmatter."""
    parts = content.split("---", 2)
    if len(parts) < 3:
        return content

    frontmatter = parts[1]
    body = parts[2]

    # Replace status field
    updated_frontmatter = re.sub(
        r"status:\s*\w+",
        f"status: {new_status}",
        frontmatter
    )

    return f"---{updated_frontmatter}---{body}"


def commit_file(filepath: str, new_filepath: str, content: str, route: str, new_status: str, token: str) -> bool:
    """
    Commit updated file to GitHub using git CLI.
    """
    try:
        repo_path = Path.home() / "Repos" / REPO_USER / REPO_NAME

        # Write temp file
        temp_file = repo_path / new_filepath
        temp_file.parent.mkdir(parents=True, exist_ok=True)
        with open(temp_file, "w") as f:
            f.write(content)

        # Stage
        subprocess.run(["git", "-C", str(repo_path), "add", new_filepath], check=True, capture_output=True)

        # If moving (different path), delete old file
        if filepath != new_filepath:
            subprocess.run(["git", "-C", str(repo_path), "rm", filepath], check=True, capture_output=True)

        # Commit
        commit_msg = f"brain: auto-route {route} — {new_status}"
        subprocess.run(
            ["git", "-C", str(repo_path), "commit", "-m", commit_msg],
            check=True,
            capture_output=True
        )

        # Pull first to avoid conflicts
        subprocess.run(
            ["git", "-C", str(repo_path), "pull", "--rebase", "origin", REPO_BRANCH],
            check=True,
            capture_output=True
        )

        # Push
        subprocess.run(
            ["git", "-C", str(repo_path), "push", "origin", REPO_BRANCH],
            check=True,
            capture_output=True
        )

        logger.info(f"✓ Routed {filepath.split('/')[-1]} → {route} ({new_status})")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to commit {new_filepath}: {e.stderr.decode() if e.stderr else str(e)}")
        return False
    except Exception as e:
        logger.error(f"Failed to commit {new_filepath}: {e}")
        return False


def main():
    """Main router loop."""
    try:
        token = get_github_token()
    except RuntimeError as e:
        logger.error(str(e))
        sys.exit(1)

    files = get_inbox_files()
    if not files:
        logger.debug("No inbox files found")
        return

    routed_count = 0

    for filepath in files:
        content = get_file_content(filepath)
        if not content:
            continue

        frontmatter = extract_frontmatter(content)

        # Skip if already routed or doesn't have required fields
        status = frontmatter.get("status", "unrouted")
        if status != "unrouted":
            continue

        confidence = frontmatter.get("confidence", 0)
        signal_quality = frontmatter.get("signal_quality", 0)
        para_type = frontmatter.get("para_type", "inbox")

        # Decide route
        route, new_status = decide_route(confidence, signal_quality, para_type)

        # Update content
        updated_content = update_file_status(content, new_status)

        # Determine new filepath
        filename = filepath.split("/")[-1]
        if route == "01-inbox":
            new_filepath = filepath  # Same location
        else:
            new_filepath = f"notes/{route}/{filename}"

        # Commit
        if commit_file(filepath, new_filepath, updated_content, route, new_status, token):
            routed_count += 1

    if routed_count > 0:
        logger.info(f"Routed {routed_count} file(s)")


if __name__ == "__main__":
    main()
