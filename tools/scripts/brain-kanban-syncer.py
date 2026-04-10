#!/usr/bin/env python3
"""
Brain Kanban Syncer: Automated Kanban board synchronization.

This script runs every 10 minutes (via cron) and:
1. Scans notes/04-tasks/ for all task files
2. Parses task metadata (status, priority, assigned_to)
3. Loads notes/kanban.canvas (Obsidian canvas JSON)
4. Removes all task nodes (type: "file", id: "task-*")
5. Rebuilds task nodes mapped to correct columns by status
6. Writes updated canvas back to disk
7. Commits if canvas changed
8. Logs all actions to ~/.local/share/brain/logs/kanban-syncer.log

Cron Schedule: Every 10 minutes
  */10 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py

Configuration:
  - GITHUB_TOKEN: Required, stored in ~/.config/github/.env or GITHUB_TOKEN env var
  - REPO: stevewesthoek/brain
  - LOG_DIR: ~/.local/share/brain/logs/

Logs:
  - Success syncs to LOG_DIR/kanban-syncer.log
  - Errors to both stdout and LOG_DIR/kanban-syncer-error.log

Manual Execution:
  python3 ~/Repos/stevewesthoek/brain/tools/scripts/brain-kanban-syncer.py
"""

import os
import sys
import re
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, List, Tuple
import subprocess

# Configuration
REPO_USER = "stevewesthoek"
REPO_NAME = "brain"
REPO_BRANCH = "main"
TASKS_PATH = "notes/04-tasks"
CANVAS_PATH = "notes/kanban.canvas"
LOG_DIR = Path.home() / ".local" / "share" / "brain" / "logs"

# Setup logging
LOG_DIR.mkdir(parents=True, exist_ok=True)
log_file = LOG_DIR / "kanban-syncer.log"
error_log_file = LOG_DIR / "kanban-syncer-error.log"

logger = logging.getLogger("brain-kanban-syncer")
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
            # Format: 100644 blob <sha> <path>
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


def slug_from_filepath(filepath: str) -> str:
    """Generate a slug from a filepath for the node ID."""
    # Extract just the filename without extension
    filename = filepath.split("/")[-1].replace(".md", "")
    # Slugify: lowercase, keep alphanumeric and dashes
    slug = re.sub(r'[^a-z0-9-]', '', filename.lower())
    return slug[:60]


def get_status_column(status: str) -> Tuple[int, str]:
    """Map status to canvas column x-coordinate and column name."""
    status_lower = status.lower() if status else "ready"

    if status_lower == "in-progress":
        return 180, "DOING"
    elif status_lower == "done":
        return 540, "DONE"
    else:  # ready or any other status defaults to BACKLOG
        return -540, "BACKLOG"


def build_task_nodes(task_files: List[str]) -> Dict[str, List[Dict]]:
    """
    Build task nodes organized by column, sorted by priority.
    Returns dict: {column_name: [node, node, ...]}
    """
    # Group tasks by column
    columns = {
        "BACKLOG": [],
        "DOING": [],
        "DONE": []
    }

    for filepath in task_files:
        content = get_file_content(filepath)
        if not content:
            continue

        frontmatter = extract_frontmatter(content)

        # Only process task files
        if frontmatter.get("type") != "task":
            continue

        status = frontmatter.get("status", "ready")
        priority = frontmatter.get("priority", 3)
        title = frontmatter.get("title", "Untitled Task")

        # Map to column
        x_coord, column_name = get_status_column(status)

        # Create node
        node_id = f"task-{slug_from_filepath(filepath)}"
        node = {
            "id": node_id,
            "type": "file",
            "file": filepath,
            "x": x_coord,
            "y": -160,  # Will be adjusted when stacking
            "width": 200,
            "height": 80
        }

        # Store with priority for sorting
        columns[column_name].append((priority, node))

    # Sort each column by priority (lower number = higher priority)
    # and adjust y coordinates
    result = {}
    for column_name, tasks_with_priority in columns.items():
        tasks_with_priority.sort(key=lambda x: x[0])  # Sort by priority
        nodes = [node for _, node in tasks_with_priority]

        # Adjust y coordinates
        y_pos = -160
        for node in nodes:
            node["y"] = y_pos
            y_pos += 100  # 100px spacing between cards

        result[column_name] = nodes

    return result


def load_canvas() -> Dict:
    """Load existing kanban.canvas from disk."""
    repo_path = Path.home() / "Repos" / REPO_USER / REPO_NAME
    canvas_file = repo_path / CANVAS_PATH

    if not canvas_file.exists():
        logger.error(f"Canvas file not found: {canvas_file}")
        return {"nodes": [], "edges": []}

    try:
        with open(canvas_file, "r") as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse canvas JSON: {e}")
        return {"nodes": [], "edges": []}


def preserve_static_nodes(canvas: Dict) -> List[Dict]:
    """
    Extract and return the static nodes that should never be touched.
    Removes and returns all non-task nodes.
    """
    static_ids = {
        "backlog-header", "todo-header", "doing-header", "done-header",
        "instructions", "blocked-section"
    }

    static_nodes = []
    task_nodes = []

    for node in canvas.get("nodes", []):
        node_id = node.get("id", "")
        if node_id in static_ids or not node_id.startswith("task-"):
            static_nodes.append(node)
        else:
            # This is a task node we'll replace
            pass

    return static_nodes


def build_canvas(static_nodes: List[Dict], task_nodes_by_column: Dict[str, List[Dict]]) -> Dict:
    """Build the final canvas JSON with static and task nodes."""
    all_task_nodes = []
    for column_name in ["BACKLOG", "DOING", "DONE"]:
        all_task_nodes.extend(task_nodes_by_column.get(column_name, []))

    return {
        "nodes": static_nodes + all_task_nodes,
        "edges": []
    }


def write_canvas(canvas: Dict) -> bool:
    """Write canvas to disk. Return True if changed, False if no change."""
    repo_path = Path.home() / "Repos" / REPO_USER / REPO_NAME
    canvas_file = repo_path / CANVAS_PATH

    # Load current canvas to compare
    try:
        with open(canvas_file, "r") as f:
            current = json.load(f)
    except:
        current = None

    # Check if anything changed
    if current and json.dumps(current, sort_keys=True) == json.dumps(canvas, sort_keys=True):
        logger.debug("Canvas unchanged, skipping commit")
        return False

    # Write new canvas
    try:
        with open(canvas_file, "w") as f:
            json.dump(canvas, f, indent=2)
        return True
    except Exception as e:
        logger.error(f"Failed to write canvas: {e}")
        return False


def commit_canvas(token: str) -> bool:
    """Commit and push the canvas if it changed."""
    try:
        repo_path = Path.home() / "Repos" / REPO_USER / REPO_NAME

        # Check if there are changes
        result = subprocess.run(
            ["git", "-C", str(repo_path), "status", "--porcelain", CANVAS_PATH],
            capture_output=True,
            text=True
        )

        if not result.stdout.strip():
            logger.debug("Canvas not changed, skipping commit")
            return True

        # Stage
        subprocess.run(["git", "-C", str(repo_path), "add", CANVAS_PATH], check=True, capture_output=True)

        # Commit
        commit_msg = "brain: sync kanban canvas from tasks"
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

        logger.info("✓ Synced kanban canvas")
        return True

    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to commit canvas: {e.stderr.decode() if e.stderr else str(e)}")
        return False
    except Exception as e:
        logger.error(f"Failed to commit canvas: {e}")
        return False


def main():
    """Main syncer loop."""
    try:
        token = get_github_token()
    except RuntimeError as e:
        logger.error(str(e))
        sys.exit(1)

    # Get task files
    task_files = get_task_files()
    if not task_files:
        logger.debug("No task files found")
        return

    # Build task nodes organized by column
    task_nodes_by_column = build_task_nodes(task_files)

    # Load existing canvas
    canvas = load_canvas()

    # Preserve static nodes
    static_nodes = preserve_static_nodes(canvas)

    # Build new canvas
    new_canvas = build_canvas(static_nodes, task_nodes_by_column)

    # Write canvas
    if write_canvas(new_canvas):
        # Commit if changed
        commit_canvas(token)


if __name__ == "__main__":
    main()
