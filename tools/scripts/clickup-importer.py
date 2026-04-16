#!/usr/bin/env python3
"""
ClickUp CSV Importer: Import ClickUp export tasks into Brain Obsidian task format.

This script reads a ClickUp CSV export and:
1. Parses task data (name, status, due date, priority, assignees)
2. Creates task.md files in 04-tasks/{task-slug}/ with proper YAML frontmatter in the mind repo
3. Maps ClickUp status to Brain task status:
   - complete → status: done
   - today → status: ready (will appear in To Do when synced)
   - backlog → status: ready
4. Generates wikilinks and front matter metadata
5. Commits all tasks atomically to GitHub
6. Logs import summary

Usage:
  python3 ~/Repos/stevewesthoek/brain/tools/scripts/clickup-importer.py <csv_file> [--dry-run]

Example:
  python3 ~/Repos/stevewesthoek/brain/tools/scripts/clickup-importer.py ~/Downloads/export.csv
  python3 ~/Repos/stevewesthoek/brain/tools/scripts/clickup-importer.py ~/Downloads/export.csv --dry-run
"""

import os
import sys
import re
import csv
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple, List, Dict
import subprocess

# Configuration
REPO_USER = "stevewesthoek"
REPO_NAME = "mind"
REPO_BRANCH = "main"
TASKS_PATH = "04-tasks"
LOG_DIR = Path.home() / ".local" / "share" / "brain" / "logs"

# Setup logging
LOG_DIR.mkdir(parents=True, exist_ok=True)
log_file = LOG_DIR / "clickup-importer.log"
error_log_file = LOG_DIR / "clickup-importer-error.log"

logger = logging.getLogger("clickup-importer")
logger.setLevel(logging.DEBUG)

# File handler for main log
fh = logging.FileHandler(log_file)
fh.setLevel(logging.INFO)

# File handler for error log
eh = logging.FileHandler(error_log_file)
eh.setLevel(logging.ERROR)

# Console handler
ch = logging.StreamHandler()
ch.setLevel(logging.INFO)

formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
fh.setFormatter(formatter)
eh.setFormatter(formatter)
ch.setFormatter(formatter)

logger.addHandler(fh)
logger.addHandler(eh)
logger.addHandler(ch)


def run_git_command(args: list) -> str:
    """Run a git command and return output."""
    cmd = ["git", "-C", str(Path.home() / "Repos" / REPO_USER / REPO_NAME)] + args
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        raise RuntimeError(f"Git command failed: {' '.join(cmd)}\n{result.stderr}")
    return result.stdout.strip()


def slug_from_title(title: str) -> str:
    """Generate a URL-safe slug from a title."""
    slug = re.sub(r'[^a-z0-9\s-]', '', title.lower())
    slug = re.sub(r'[\s-]+', '-', slug).strip('-')
    return slug[:50]


def parse_clickup_priority(priority_str: str) -> int:
    """Convert ClickUp priority to Brain priority (1-5)."""
    if not priority_str or priority_str == 'null':
        return 3  # default medium
    try:
        p = int(priority_str)
        # ClickUp uses 1=high, 2=medium, 3=low
        # Brain uses 1=critical, 2=high, 3=medium, 4=low, 5=someday
        # Map: 1→2, 2→3, 3→4
        return min(5, max(1, p + 1))
    except:
        return 3


def clickup_status_to_brain_status(status: str) -> str:
    """Map ClickUp status to Brain task status."""
    status_lower = status.lower().strip()
    if status_lower == 'complete':
        return 'done'
    elif status_lower in ('today', 'next', 'priority'):
        return 'ready'  # Active/urgent tasks - Will appear in To Do
    elif status_lower == 'backlog':
        return 'ready'  # Default backlog
    else:
        return 'ready'  # Default


def parse_csv_file(csv_path: Path) -> List[Dict]:
    """Parse ClickUp CSV export and return list of task dictionaries."""
    tasks = []

    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            # Normalize header names (strip leading/trailing whitespace)
            if reader.fieldnames:
                reader.fieldnames = [h.strip() if h else h for h in reader.fieldnames]

            for row in reader:
                # Normalize row keys
                row = {k.strip() if k else k: v for k, v in row.items()}

                task = {
                    'name': row.get('Task Name', '').strip(),
                    'content': row.get('Task Content', '').strip(),
                    'status': row.get('Status', 'backlog').strip(),
                    'due_date': row.get('Due Date', '').strip(),
                    'priority': row.get('Priority', 'null').strip(),
                    'assignees': row.get('Assignees', '').strip(),
                    'list': row.get('List Name', '').strip(),
                }

                # Skip tasks with no name
                if not task['name']:
                    continue

                tasks.append(task)

        logger.info(f"✓ Parsed {len(tasks)} tasks from {csv_path.name}")
        return tasks

    except Exception as e:
        logger.error(f"Failed to parse CSV: {e}")
        return []


def build_task_content(task: Dict, task_index: int, list_name: str) -> str:
    """Build task.md file content."""
    name = task['name']
    content = task['content']
    brain_status = clickup_status_to_brain_status(task['status'])
    priority = parse_clickup_priority(task['priority'])

    # Determine assigned_to
    assignees = task['assignees'].lower() if task['assignees'] else 'you'
    assigned_to = 'ai' if 'ai' in assignees else 'you'

    # Determine effort (heuristic: content length → effort)
    content_len = len(content)
    if content_len > 500:
        effort = 'large'
    elif content_len > 200:
        effort = 'medium'
    else:
        effort = 'small'

    # Build frontmatter
    fm_lines = [
        "---",
        "type: task",
        f'title: "{name}"',
        f"assigned_to: {assigned_to}",
        f"status: {brain_status}",
        f"priority: {priority}",
        f"effort: {effort}",
        f"source: clickup-import",
        f"imported: {datetime.now().strftime('%Y-%m-%d')}",
        "---",
    ]

    # Build body
    body_parts = ["\n## What to Do\n"]
    if content:
        body_parts.append(content)
    else:
        body_parts.append(name)

    body_parts.append("\n\n## Notes\n")
    body_parts.append(f"Imported from ClickUp list: {list_name}\n")

    if task['due_date']:
        body_parts.append(f"Original ClickUp due date: {task['due_date']}\n")

    if task['status']:
        body_parts.append(f"Original ClickUp status: {task['status']}\n")

    return "\n".join(fm_lines) + "".join(body_parts)


def import_tasks(csv_path: Path, dry_run: bool = False) -> Tuple[int, List[str]]:
    """
    Import tasks from CSV and write to disk.
    Returns (count, list of created files)
    """
    tasks = parse_csv_file(csv_path)
    if not tasks:
        logger.error("No tasks found in CSV")
        return 0, []

    repo_path = Path.home() / "Repos" / REPO_USER / REPO_NAME
    created_files = []

    # Group tasks by status for logging
    status_counts = {}

    for idx, task in enumerate(tasks, 1):
        # Generate slug and filename
        list_slug = slug_from_title(task['list'])
        task_slug = slug_from_title(task['name'])

        # Create unique filename within list folder
        task_filename = f"{list_slug}/{idx:04d}-{task_slug}.md"
        task_path = repo_path / TASKS_PATH / task_filename

        # Build content
        task_content = build_task_content(task, idx, task['list'])

        if dry_run:
            logger.info(f"[DRY RUN] Would create: {TASKS_PATH}/{task_filename}")
            created_files.append(task_filename)
        else:
            # Create directory if needed
            task_path.parent.mkdir(parents=True, exist_ok=True)

            # Write file
            with open(task_path, 'w') as f:
                f.write(task_content)

            logger.debug(f"Created: {TASKS_PATH}/{task_filename}")
            created_files.append(task_filename)

        # Track status
        status = task['status']
        status_counts[status] = status_counts.get(status, 0) + 1

    logger.info(f"✓ Imported {len(tasks)} tasks")
    for status, count in sorted(status_counts.items()):
        logger.info(f"  - {status}: {count} tasks")

    return len(tasks), created_files


def commit_import(task_files: List[str], dry_run: bool = False) -> bool:
    """Commit imported tasks to git."""
    if dry_run:
        logger.info("[DRY RUN] Would commit all tasks")
        return True

    if not task_files:
        logger.debug("No files to commit")
        return True

    try:
        repo_path = Path.home() / "Repos" / REPO_USER / REPO_NAME

        # Stage all task files
        for task_file in task_files:
            full_path = f"{TASKS_PATH}/{task_file}"
            subprocess.run(
                ["git", "-C", str(repo_path), "add", full_path],
                check=True,
                capture_output=True
            )

        # Commit
        commit_msg = f"brain: import {len(task_files)} tasks from ClickUp"
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

        logger.info(f"✓ Committed and pushed {len(task_files)} tasks")
        return True

    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to commit: {e.stderr.decode() if e.stderr else str(e)}")
        return False
    except Exception as e:
        logger.error(f"Failed to commit: {e}")
        return False


def main():
    """Main import flow."""
    if len(sys.argv) < 2:
        print("Usage: clickup-importer.py <csv_file> [--dry-run]")
        sys.exit(1)

    csv_path = Path(sys.argv[1]).expanduser()
    dry_run = "--dry-run" in sys.argv

    if not csv_path.exists():
        logger.error(f"CSV file not found: {csv_path}")
        sys.exit(1)

    logger.info(f"{'[DRY RUN] ' if dry_run else ''}Importing from: {csv_path}")

    # Import tasks
    count, files = import_tasks(csv_path, dry_run)

    if count == 0:
        logger.error("No tasks imported")
        sys.exit(1)

    # Commit to git
    if not dry_run:
        commit_import(files, dry_run)

    logger.info(f"✓ Import complete: {count} tasks")
    if dry_run:
        print(f"\n[DRY RUN] Would import {count} tasks from ClickUp")
        print(f"Run without --dry-run to actually import")


if __name__ == "__main__":
    main()
