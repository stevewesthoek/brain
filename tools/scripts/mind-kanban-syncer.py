#!/usr/bin/env python3
"""
Mind Kanban Syncer: Obsidian Kanban Plugin markdown synchronization.

This script runs every 10 minutes (via cron) and:
1. Reads all task files from 04-tasks/ in the mind repo
2. Parses task metadata (title, status, priority, assigned_to)
3. Loads existing kanban.md (if it exists)
4. Preserves the To Do column (user drags)
5. Auto-generates Backlog, Doing, Done from task file status
6. Writes updated kanban.md in Obsidian Kanban plugin format
7. Only commits if kanban.md changed

Cron Schedule: Every 10 minutes
  */10 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py

Configuration:
  - GITHUB_TOKEN: Required, stored in ~/.config/github/.env or GITHUB_TOKEN env var
  - REPO: stevewesthoek/mind
  - LOG_DIR: ~/.local/share/brain/logs/

Logs:
  - Success syncs to LOG_DIR/kanban-syncer.log
  - Errors to both stdout and LOG_DIR/kanban-syncer-error.log

Manual Execution:
  python3 ~/Repos/stevewesthoek/brain/tools/scripts/mind-kanban-syncer.py
"""

import os
import sys
import re
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List, Set, Tuple
import subprocess

# Type hint for parse_kanban_md return type

# Configuration
REPO_USER = "stevewesthoek"
REPO_NAME = "mind"
REPO_BRANCH = "main"
TASKS_PATH = "04-tasks"
KANBAN_PATH = "kanban.md"
LOG_DIR = Path.home() / ".local" / "share" / "brain" / "logs"

# Setup logging
LOG_DIR.mkdir(parents=True, exist_ok=True)
log_file = LOG_DIR / "kanban-syncer.log"
error_log_file = LOG_DIR / "kanban-syncer-error.log"

logger = logging.getLogger("mind-kanban-syncer")
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

# ─── RETIREMENT GUARD ────────────────────────────────────────────────────────
# This script is retired. Do not remove this block or add bypass flags.
print(
    "RETIRED: mind-kanban-syncer.py is retired as of 2026-07-31. "
    "Reason: Legacy numbered roots (0x-*/) are historical paths per the canonical path registry. "
    "kanban.md is human-only authority per M1.4. "
    "See operations/reports/bs0-10-legacy-producer-migration-2026-07-31.md"
)
sys.exit(0)
# ─────────────────────────────────────────────────────────────────────────────


def get_github_token() -> str:
    """Get GitHub token from env var or config file."""
    token = os.environ.get("GITHUB_TOKEN") or os.environ.get("GITHUB_PAT")
    if token:
        return token

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


def get_task_files() -> list:
    """Get list of .md files in tasks folder."""
    try:
        output = run_git_command(["ls-tree", "-r", REPO_BRANCH, TASKS_PATH])
        files = []
        for line in output.split("\n"):
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 4 and parts[1] == "blob" and parts[3].endswith(".md"):
                files.append(parts[3])
        return files
    except Exception as e:
        logger.debug(f"Failed to list task files: {e}")
        return []


def get_file_content(filepath: str) -> Optional[str]:
    """Get file content from git."""
    try:
        content = run_git_command(["show", f"{REPO_BRANCH}:{filepath}"])
        return content
    except Exception:
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
        value = value.strip().strip('"').strip("'")

        # Try to parse as number
        if re.match(r"^[\d.]+$", value):
            try:
                data[key] = int(value)
            except:
                try:
                    data[key] = float(value)
                except:
                    data[key] = value
        else:
            data[key] = value

    return data


def parse_kanban_md(kanban_content: str) -> Tuple[Dict[str, Set[str]], Dict[str, List[str]]]:
    """
    Parse kanban.md and return:
    1. Dict of column_name -> set of file paths (file-backed tasks)
    2. Dict of column_name -> list of manual task lines (non-file-backed tasks)

    File-backed tasks have wikilinks: [[path/to/file.md|Display Title]]
    Manual tasks are plain checklist items: - [ ] Task name
    """
    file_backed = {
        "Backlog": set(),
        "To Do": set(),
        "Doing": set(),
        "Done": set()
    }
    manual_tasks = {
        "Backlog": [],
        "To Do": [],
        "Doing": [],
        "Done": []
    }

    current_column = None
    in_archive = False

    for line in kanban_content.split("\n"):
        original_line = line
        line = line.strip()

        # Skip settings block
        if "%%" in line:
            in_archive = True
            continue
        if in_archive:
            continue

        # Detect column heading
        if line.startswith("## "):
            heading = line.replace("## ", "").strip()
            # Remove WIP limit like "(5)"
            heading = re.sub(r"\s*\(\d+\)\s*$", "", heading).strip()

            if heading in file_backed:
                current_column = heading
            elif heading == "Archive":
                current_column = "Archive"
            continue

        # Extract checklist items
        if line.startswith("- [") and current_column and current_column in file_backed:
            # Check if it's a file-backed task (has wikilink)
            if "[[" in line and "]]" in line:
                # Format: - [ ] [[path/to/file.md|Title]] #tags
                match = re.search(r"\[\[([^\]]+?)\|", line)
                if match:
                    filepath = match.group(1).strip()
                    file_backed[current_column].add(filepath)
            else:
                # Manual task - preserve exactly as is
                manual_tasks[current_column].append(original_line)

    return file_backed, manual_tasks


def load_kanban_md() -> Optional[str]:
    """Load existing kanban.md from disk."""
    repo_path = Path.home() / "Repos" / REPO_USER / REPO_NAME
    kanban_file = repo_path / KANBAN_PATH

    if not kanban_file.exists():
        return None

    try:
        with open(kanban_file, "r") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Failed to read kanban.md: {e}")
        return None


def priority_to_tag(priority: int) -> str:
    """Convert priority number to tag."""
    priority = max(1, min(5, priority))
    return f"#p{priority}"


def assigned_to_tag(assigned: str) -> str:
    """Convert assigned_to to tag."""
    assigned_lower = assigned.lower() if assigned else "you"
    if "ai" in assigned_lower:
        return "#ai"
    return "#you"


def build_kanban_content(
    backlog_tasks: List[Tuple[str, dict]],
    todo_tasks: List[Tuple[str, dict]],
    doing_tasks: List[Tuple[str, dict]],
    done_tasks: List[Tuple[str, dict]],
    manual_tasks: Dict[str, List[str]]
) -> str:
    """Build kanban.md markdown content, preserving manual tasks."""
    lines = [
        "---",
        "",
        "kanban-plugin: board",
        "",
        "---",
        "",
        "## Backlog",
        ""
    ]

    # Backlog column - file-backed tasks first
    for filepath, task_data in backlog_tasks:
        title = task_data["title"]
        priority = task_data.get("priority", 3)
        assigned = task_data.get("assigned_to", "you")
        priority_tag = priority_to_tag(priority)
        assigned_tag = assigned_to_tag(assigned)
        lines.append(f'- [ ] [[{filepath}|{title}]] {priority_tag} {assigned_tag}')

    # Backlog manual tasks
    lines.extend(manual_tasks.get("Backlog", []))

    lines.extend(["", "## To Do", ""])

    # To Do column - file-backed tasks first
    for filepath, task_data in todo_tasks:
        title = task_data["title"]
        priority = task_data.get("priority", 3)
        assigned = task_data.get("assigned_to", "you")
        priority_tag = priority_to_tag(priority)
        assigned_tag = assigned_to_tag(assigned)
        lines.append(f'- [ ] [[{filepath}|{title}]] {priority_tag} {assigned_tag}')

    # To Do manual tasks
    lines.extend(manual_tasks.get("To Do", []))

    lines.extend(["", "## Doing", ""])

    # Doing column - file-backed tasks first
    for filepath, task_data in doing_tasks:
        title = task_data["title"]
        priority = task_data.get("priority", 3)
        assigned = task_data.get("assigned_to", "you")
        priority_tag = priority_to_tag(priority)
        assigned_tag = assigned_to_tag(assigned)
        lines.append(f'- [ ] [[{filepath}|{title}]] {priority_tag} {assigned_tag}')

    # Doing manual tasks
    lines.extend(manual_tasks.get("Doing", []))

    lines.extend(["", "## Done", "", "**Complete**", ""])

    # Done column - file-backed tasks first
    for filepath, task_data in done_tasks:
        title = task_data["title"]
        priority = task_data.get("priority", 3)
        assigned = task_data.get("assigned_to", "you")
        priority_tag = priority_to_tag(priority)
        assigned_tag = assigned_to_tag(assigned)
        lines.append(f'- [x] [[{filepath}|{title}]] {priority_tag} {assigned_tag}')

    # Done manual tasks
    lines.extend(manual_tasks.get("Done", []))

    # Add settings block
    lines.extend(["", "", "%% kanban:settings"])
    settings = {
        "tag-colors": [
            {"tagKey": "#p1", "color": "#fff", "backgroundColor": "#c0392b"},
            {"tagKey": "#p2", "color": "#fff", "backgroundColor": "#e67e22"},
            {"tagKey": "#p3", "color": "#000", "backgroundColor": "#f1c40f"},
            {"tagKey": "#p4", "color": "#000", "backgroundColor": "#2ecc71"},
            {"tagKey": "#p5", "color": "#fff", "backgroundColor": "#95a5a6"},
            {"tagKey": "#you", "color": "#fff", "backgroundColor": "#2980b9"},
            {"tagKey": "#ai", "color": "#fff", "backgroundColor": "#8e44ad"}
        ],
        "date-format": "YYYY-MM-DD",
        "time-format": "HH:mm",
        "link-date-to-daily-note": True
    }
    lines.append("```")
    lines.append(json.dumps(settings))
    lines.append("```")
    lines.append("%%")

    return "\n".join(lines)


def write_kanban_md(content: str) -> bool:
    """Write kanban.md to disk. Return True if changed."""
    repo_path = Path.home() / "Repos" / REPO_USER / REPO_NAME
    kanban_file = repo_path / KANBAN_PATH

    # Load current to compare
    try:
        with open(kanban_file, "r") as f:
            current = f.read()
    except:
        current = None

    # Check if changed
    if current and current == content:
        logger.debug("Kanban unchanged, skipping commit")
        return False

    # Write new kanban
    try:
        with open(kanban_file, "w") as f:
            f.write(content)
        return True
    except Exception as e:
        logger.error(f"Failed to write kanban.md: {e}")
        return False


def commit_kanban(token: str) -> bool:
    """Commit and push kanban.md if it changed."""
    try:
        repo_path = Path.home() / "Repos" / REPO_USER / REPO_NAME

        # Check if there are changes
        result = subprocess.run(
            ["git", "-C", str(repo_path), "status", "--porcelain", KANBAN_PATH],
            capture_output=True,
            text=True
        )

        if not result.stdout.strip():
            logger.debug("Kanban not changed in git")
            return True

        # Stage
        subprocess.run(["git", "-C", str(repo_path), "add", KANBAN_PATH], check=True, capture_output=True)

        # Commit
        commit_msg = "mind: sync kanban board from tasks"
        subprocess.run(
            ["git", "-C", str(repo_path), "commit", "-m", commit_msg],
            check=True,
            capture_output=True
        )

        # Pull first
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

        logger.info("✓ Synced Kanban board")
        return True

    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to commit kanban: {e.stderr.decode() if e.stderr else str(e)}")
        return False
    except Exception as e:
        logger.error(f"Failed to commit kanban: {e}")
        return False


def main():
    """Main syncer loop."""
    logger.info("Run started")
    try:
        token = get_github_token()
    except RuntimeError as e:
        logger.error(str(e))
        sys.exit(1)

    # Get task files
    task_files = get_task_files()

    # Parse existing kanban to preserve manual tasks and file-backed task tracking
    existing_kanban = load_kanban_md()
    file_backed_tasks = {}
    manual_tasks = {}
    if existing_kanban:
        file_backed_tasks, manual_tasks = parse_kanban_md(existing_kanban)

    to_do_paths = file_backed_tasks.get("To Do", set())

    # Read all task files and organize by status
    all_tasks: Dict[str, dict] = {}

    for filepath in task_files:
        content = get_file_content(filepath)
        if not content:
            continue

        frontmatter = extract_frontmatter(content)

        # Only process task files
        if frontmatter.get("type") != "task":
            continue

        title = frontmatter.get("title", "Untitled")
        status = frontmatter.get("status", "ready")
        priority = frontmatter.get("priority", 3)
        assigned_to = frontmatter.get("assigned_to", "you")

        all_tasks[filepath] = {
            "title": title,
            "status": status,
            "priority": priority,
            "assigned_to": assigned_to
        }

    # Sort tasks by priority within each column
    backlog_tasks = []
    todo_tasks = []
    doing_tasks = []
    done_tasks = []

    for filepath, task_data in all_tasks.items():
        status = task_data["status"]
        priority = task_data["priority"]

        # Determine column
        if status == "done":
            done_tasks.append((filepath, task_data))
        elif status == "in-progress":
            doing_tasks.append((filepath, task_data))
        elif filepath in to_do_paths:
            # Preserve To Do column (user drags)
            todo_tasks.append((filepath, task_data))
        else:
            # Ready or other → Backlog
            backlog_tasks.append((filepath, task_data))

    # Sort each by priority
    for task_list in [backlog_tasks, todo_tasks, doing_tasks, done_tasks]:
        task_list.sort(key=lambda x: x[1]["priority"])

    # Build kanban with manual tasks preserved
    kanban_content = build_kanban_content(backlog_tasks, todo_tasks, doing_tasks, done_tasks, manual_tasks)

    # Write kanban
    if not write_kanban_md(kanban_content):
        logger.info("Kanban unchanged, skipping commit")
    else:
        # Commit if changed
        commit_kanban(token)
    logger.info("Run complete")


if __name__ == "__main__":
    main()
