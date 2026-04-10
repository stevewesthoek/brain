#!/usr/bin/env python3
"""
Brain Project Decomposer: Automated project decomposition into tasks.

This script runs every 5 minutes (via cron) and:
1. Scans notes/03-projects/ for files with status: ready-for-review and type: capture
2. Sends each project to Gemini to decompose into phases and atomic tasks
3. Replaces the project file with proper project.md template format
4. Creates task files in notes/04-tasks/{project-slug}/
5. Commits all changes atomically to GitHub
6. Logs all actions to ~/.local/share/brain/logs/project-decomposer.log

Cron Schedule: Every 5 minutes
  */5 * * * * /Users/Office/Repos/stevewesthoek/brain/tools/scripts/brain-project-decomposer.py

Configuration:
  - GITHUB_TOKEN: Required, stored in ~/.config/github/.env or GITHUB_TOKEN env var
  - REPO: stevewesthoek/brain
  - LOG_DIR: ~/.local/share/brain/logs/

Logs:
  - Success decompositions to LOG_DIR/project-decomposer.log
  - Errors to both stdout and LOG_DIR/project-decomposer-error.log

Manual Execution:
  python3 ~/Repos/stevewesthoek/brain/tools/scripts/brain-project-decomposer.py
"""

import os
import sys
import re
import json
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, Tuple, List, Dict
import subprocess

# Configuration
REPO_USER = "stevewesthoek"
REPO_NAME = "brain"
REPO_BRANCH = "main"
PROJECTS_PATH = "notes/03-projects"
TASKS_PATH = "notes/04-tasks"
LOG_DIR = Path.home() / ".local" / "share" / "brain" / "logs"

# Setup logging
LOG_DIR.mkdir(parents=True, exist_ok=True)
log_file = LOG_DIR / "project-decomposer.log"
error_log_file = LOG_DIR / "project-decomposer-error.log"

logger = logging.getLogger("brain-project-decomposer")
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


def get_projects_files() -> list:
    """Get list of .md files in projects folder."""
    try:
        output = run_git_command(["ls-tree", "-r", REPO_BRANCH, PROJECTS_PATH])
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
        logger.error(f"Failed to list projects files: {e}")
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
        value = value.strip().strip('"').strip("'")

        # Try to parse as float if it looks like a number
        if re.match(r"^[\d.]+$", value):
            try:
                data[key] = float(value)
            except:
                data[key] = value
        else:
            data[key] = value

    return data


def extract_body(content: str) -> str:
    """Extract body (after frontmatter) from markdown file."""
    parts = content.split("---", 2)
    if len(parts) >= 3:
        return parts[2].strip()
    return ""


def decompose_with_gemini(content: str) -> Optional[Dict]:
    """
    Call Gemini CLI to decompose the project into structured tasks.
    Returns parsed JSON dict or None on failure.
    """
    frontmatter = extract_frontmatter(content)
    body = extract_body(content)
    title = frontmatter.get("title", "Untitled Project")

    prompt = f"""You are a GTD project decomposer. Analyze this project and return ONLY a valid JSON object (no markdown, no explanation).

The JSON must have this exact structure:
{{
  "project": {{
    "title": "string (refined project title if needed)",
    "goal": "string (one sentence goal statement)",
    "priority": 1-5,
    "target_end_date": "YYYY-MM-DD or null",
    "tags": ["tag1", "tag2"]
  }},
  "tasks": [
    {{
      "title": "string (task name)",
      "what_to_do": "string (clear action description)",
      "acceptance_criteria": ["criterion 1", "criterion 2"],
      "assigned_to": "you or ai",
      "priority": 1-5,
      "effort": "small or medium or large"
    }}
  ]
}}

PROJECT TITLE: {title}

PROJECT CONTENT:
{body}

Return only valid JSON. No explanation, no markdown fences."""

    try:
        result = subprocess.run(
            ["gemini", "--model", "gemini-2.5-flash"],
            input=prompt,
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode != 0:
            logger.error(f"Gemini call failed for {title}: {result.stderr}")
            return None

        response = result.stdout.strip()

        # Strip markdown code fences if present
        if response.startswith("```"):
            response = response.split("```")[1]
            if response.startswith("json"):
                response = response[4:]
            response = response.strip()
        if response.endswith("```"):
            response = response.rsplit("```", 1)[0]
            response = response.strip()

        # Try to parse JSON response
        try:
            data = json.loads(response)
            return data
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response for {title}: {e}\nResponse: {response[:200]}")
            return None

    except subprocess.TimeoutExpired:
        logger.error(f"Gemini call timed out for {title}")
        return None
    except Exception as e:
        logger.error(f"Gemini call failed for {title}: {e}")
        return None


def slug_from_title(title: str) -> str:
    """Generate a URL-safe slug from a title."""
    # Simple slugification: lowercase, replace spaces with dashes, remove special chars
    slug = re.sub(r'[^a-z0-9\s-]', '', title.lower())
    slug = re.sub(r'[\s-]+', '-', slug).strip('-')
    return slug[:50]  # Max 50 chars


def build_project_content(frontmatter: dict, body: str, decomposition: Dict, original_filename: str, tasks_filenames: List[str]) -> str:
    """Build the new project file content using the project.md template format."""
    project_info = decomposition.get("project", {})

    title = project_info.get("title", frontmatter.get("title", "Untitled"))
    goal = project_info.get("goal", "")
    priority = project_info.get("priority", 3)
    target_end_date = project_info.get("target_end_date", "")
    tags = project_info.get("tags", [])

    # Build frontmatter
    fm_lines = [
        "---",
        "type: project",
        f'title: "{title}"',
        "status: in-progress",
        f"priority: {priority}",
        f"start_date: {datetime.now().strftime('%Y-%m-%d')}",
    ]

    if target_end_date:
        fm_lines.append(f"target_end_date: {target_end_date}")

    if tags:
        tags_str = json.dumps(tags)
        fm_lines.append(f"tags: {tags_str}")

    fm_lines.append("decomposed: true")
    fm_lines.append(f"source_capture: {original_filename}")
    fm_lines.append("---")

    # Build body
    body_parts = [
        "\n## Goal\n",
        goal,
        "\n\n## What Needs to Happen\n",
        body,  # Original note body
    ]

    # Add task links
    if tasks_filenames:
        body_parts.append("\n\n## Related Tasks\n")
        for task_file in tasks_filenames:
            task_path = f"notes/04-tasks/{task_file}"
            body_parts.append(f"- [[{task_path}]]\n")

    return "\n".join(fm_lines) + "".join(body_parts)


def build_task_content(task_data: Dict, project_title: str, project_filename: str, task_index: int) -> str:
    """Build a task file content using the task.md template format."""
    title = task_data.get("title", f"Task {task_index}")
    what_to_do = task_data.get("what_to_do", "")
    criteria = task_data.get("acceptance_criteria", [])
    assigned_to = task_data.get("assigned_to", "you")
    priority = task_data.get("priority", 3)
    effort = task_data.get("effort", "medium")

    # Normalize assigned_to to "you" or "ai"
    if assigned_to.lower().startswith("ai"):
        assigned_to = "ai"
    else:
        assigned_to = "you"

    # Build frontmatter
    fm_lines = [
        "---",
        "type: task",
        f'title: "{title}"',
        f"assigned_to: {assigned_to}",
        "status: ready",
        f"priority: {priority}",
        f"effort: {effort}",
        f"project: [[notes/03-projects/{project_filename}]]",
        "---",
    ]

    # Build body
    body_parts = [
        "\n## What to Do\n",
        what_to_do,
        "\n\n## Acceptance Criteria\n",
    ]

    for criterion in criteria:
        body_parts.append(f"- [ ] {criterion}\n")

    return "\n".join(fm_lines) + "".join(body_parts)


def commit_decomposition(project_filepath: str, project_content: str, tasks_data: List[Tuple[str, str]], original_title: str, token: str) -> bool:
    """
    Commit updated project file and new task files to GitHub using git CLI.
    tasks_data: list of (filename, content) tuples
    """
    try:
        repo_path = Path.home() / "Repos" / REPO_USER / REPO_NAME

        # Write project file
        project_file_path = repo_path / project_filepath
        project_file_path.parent.mkdir(parents=True, exist_ok=True)
        with open(project_file_path, "w") as f:
            f.write(project_content)

        # Stage project file
        subprocess.run(["git", "-C", str(repo_path), "add", project_filepath], check=True, capture_output=True)

        # Write and stage task files
        for task_filename, task_content in tasks_data:
            task_file_path = repo_path / TASKS_PATH / task_filename
            task_file_path.parent.mkdir(parents=True, exist_ok=True)
            with open(task_file_path, "w") as f:
                f.write(task_content)

            subprocess.run(["git", "-C", str(repo_path), "add", f"{TASKS_PATH}/{task_filename}"], check=True, capture_output=True)

        # Commit
        commit_msg = f"brain: decompose {original_title}"
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

        logger.info(f"✓ Decomposed {original_title} → project + {len(tasks_data)} tasks")
        return True
    except subprocess.CalledProcessError as e:
        logger.error(f"Failed to commit decomposition for {original_title}: {e.stderr.decode() if e.stderr else str(e)}")
        return False
    except Exception as e:
        logger.error(f"Failed to commit decomposition for {original_title}: {e}")
        return False


def main():
    """Main decomposer loop."""
    try:
        token = get_github_token()
    except RuntimeError as e:
        logger.error(str(e))
        sys.exit(1)

    files = get_projects_files()
    if not files:
        logger.debug("No project files found")
        return

    decomposed_count = 0

    for filepath in files:
        content = get_file_content(filepath)
        if not content:
            continue

        frontmatter = extract_frontmatter(content)

        # Skip if already decomposed or wrong type/status
        file_type = frontmatter.get("type", "capture")
        status = frontmatter.get("status", "")

        if file_type != "capture" or status != "ready-for-review":
            continue

        title = frontmatter.get("title", "Untitled")

        # Call Gemini to decompose
        decomposition = decompose_with_gemini(content)
        if not decomposition:
            continue

        # Build project content
        project_slug = slug_from_title(title)
        original_filename = filepath.split("/")[-1]

        project_info = decomposition.get("project", {})
        tasks_list = decomposition.get("tasks", [])

        # Build task filenames and contents
        tasks_data = []
        for idx, task_data in enumerate(tasks_list, 1):
            task_slug = slug_from_title(task_data.get("title", f"task-{idx}"))
            task_filename = f"{project_slug}/{idx:03d}-{task_slug}.md"
            task_content = build_task_content(task_data, title, original_filename, idx)
            tasks_data.append((task_filename, task_content))

        # Build new project content
        tasks_filenames = [filename.replace(".md", "") for _, filename in tasks_data]
        project_content = build_project_content(frontmatter, extract_body(content), decomposition, original_filename, tasks_filenames)

        # Commit everything
        if commit_decomposition(filepath, project_content, tasks_data, title, token):
            decomposed_count += 1

    if decomposed_count > 0:
        logger.info(f"Decomposed {decomposed_count} project(s)")


if __name__ == "__main__":
    main()
