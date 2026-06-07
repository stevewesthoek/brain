#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="${MIND_STEWARD_REPO_ROOT:-$(cd "$SCRIPT_DIR/../.." && pwd)}"
MIND_ROOT="${MIND_STEWARD_MIND_ROOT:-$HOME/Repos/stevewesthoek/mind}"
RUNTIME_DIR="$REPO_ROOT/runtime/local/mind-steward"
JSON_OUT="$RUNTIME_DIR/inbox-queue-latest.json"
MD_OUT="$RUNTIME_DIR/inbox-queue-latest.md"

mkdir -p "$RUNTIME_DIR"
chmod 700 "$RUNTIME_DIR"

python3 - "$REPO_ROOT" "$MIND_ROOT" "$JSON_OUT" "$MD_OUT" <<'PY'
from __future__ import annotations

import json
import os
import sys
from datetime import datetime
from pathlib import Path

repo_root = Path(sys.argv[1]).resolve()
mind_root = Path(sys.argv[2]).expanduser().resolve()
json_out = Path(sys.argv[3]).resolve()
md_out = Path(sys.argv[4]).resolve()
inbox_dir = mind_root / 'capture' / 'inbox'
generated_at = datetime.now().astimezone().isoformat()
large_threshold_bytes = 2 * 1024 * 1024
sample_limit = 3
queue_mode = 'dry-run-report-only'
settings = {
    'max_concurrent_jobs': 1,
    'max_files_per_run': 3,
    'debounce_seconds': 30,
    'max_retries': 2,
    'large_file_threshold_mb': 2,
    'minimum_seconds_between_runs': 300,
}

sampled: list[dict] = []
blocked_large: list[dict] = []
skipped_capacity: list[dict] = []
errors: list[str] = []
status = 'success'
message = 'Mind Steward inbox queue preflight completed in report-only mode.'
infra_failure = False


def build_entry(file_path: Path, stat_result: os.stat_result, entry_status: str, reason: str | None = None) -> dict:
    entry = {
        'name': file_path.name,
        'path': str(file_path),
        'size_bytes': stat_result.st_size,
        'modified_at': datetime.fromtimestamp(stat_result.st_mtime).astimezone().isoformat(),
        'observed_at': generated_at,
        'status': entry_status,
    }
    if reason:
        entry['reason'] = reason
    return entry


def build_report(current_status: str, current_message: str) -> dict:
    return {
        'job': 'mind-steward-inbox-queue-dry-run',
        'mode': queue_mode,
        'status': current_status,
        'message': current_message,
        'generatedAt': generated_at,
        'endedAtLisbon': datetime.now().astimezone().isoformat(),
        'durationSeconds': 0,
        'writesToMind': False,
        'externalSideEffects': False,
        'executableActions': False,
        'queue_mode': queue_mode,
        **settings,
        'inbox': {
            'path': str(inbox_dir),
            'total_inbox_files': total_inbox_files,
            'observed_at': generated_at,
            'candidate_files_selected_for_next_run': sampled,
            'blocked_large_file_entries': blocked_large,
            'skipped_entries': skipped_capacity,
            'summary_counts': {
                'total_inbox_files': total_inbox_files,
                'pending': len(sampled),
                'blocked_large_file': len(blocked_large),
                'skipped_capacity': len(skipped_capacity),
            },
        },
        'errors': errors,
    }


total_inbox_files = 0

try:
    if not inbox_dir.exists():
        status = 'blocked'
        message = 'Mind Steward inbox path is missing. The queue preflight only inspects read-only inbox files.'
    else:
        files = sorted((p for p in inbox_dir.iterdir() if p.is_file()), key=lambda p: (p.stat().st_mtime, p.name.lower()))
        total_inbox_files = len(files)
        for file_path in files:
            try:
                stat_result = file_path.stat()
                if stat_result.st_size > large_threshold_bytes:
                    blocked_large.append(build_entry(file_path, stat_result, 'blocked_large_file', 'larger-than-2mb'))
                    continue

                if len(sampled) >= sample_limit:
                    skipped_capacity.append(build_entry(file_path, stat_result, 'skipped_capacity', 'capacity-limit'))
                    continue

                preview_bytes = file_path.read_bytes()[:4096]
                preview_text = preview_bytes.decode('utf-8', errors='replace').replace('\x00', ' ').strip()
                entry = build_entry(file_path, stat_result, 'pending')
                entry['preview'] = preview_text[:2000]
                sampled.append(entry)
            except Exception as err:  # pragma: no cover - defensive runtime guard
                errors.append(f'{file_path.name}: {err}')
                blocked_large.append({
                    'name': file_path.name,
                    'path': str(file_path),
                    'status': 'blocked_large_file',
                    'reason': 'read-error',
                    'error': str(err)[:240],
                    'observed_at': generated_at,
                })
        if total_inbox_files == 0:
            message = 'Mind Steward inbox is empty. The queue preflight is report-only and has no candidate files.'
except Exception as err:
    status = 'blocked'
    message = f'Infrastructure failure while generating queue report: {err}'
    errors.append(str(err))
    infra_failure = True

report = build_report(status, message)
json_out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
md_lines = [
    '# Mind Steward Inbox Queue Dry-Run',
    '',
    f"- Status: {report['status']}",
    f"- Mode: {report['mode']}",
    f"- Queue mode: {report['queue_mode']}",
    f"- Writes to Mind: {str(report['writesToMind']).lower()}",
    f"- External side effects: {str(report['externalSideEffects']).lower()}",
    f"- Executable actions: {str(report['executableActions']).lower()}",
    f"- Inbox path: {report['inbox']['path']}",
    f"- Total inbox files: {report['inbox']['total_inbox_files']}",
    f"- Candidate files selected: {len(report['inbox']['candidate_files_selected_for_next_run'])}",
    f"- Blocked large files: {len(report['inbox']['blocked_large_file_entries'])}",
    f"- Skipped capacity entries: {len(report['inbox']['skipped_entries'])}",
    '',
    '## Queue Settings',
    f"- Max concurrent jobs: {report['max_concurrent_jobs']}",
    f"- Max files per run: {report['max_files_per_run']}",
    f"- Debounce seconds: {report['debounce_seconds']}",
    f"- Max retries: {report['max_retries']}",
    f"- Large file threshold MB: {report['large_file_threshold_mb']}",
    f"- Minimum seconds between runs: {report['minimum_seconds_between_runs']}",
]

if report['inbox']['candidate_files_selected_for_next_run']:
    md_lines.extend(['', '## Candidate Files'])
    for item in report['inbox']['candidate_files_selected_for_next_run']:
        md_lines.append(f"- {item['name']} ({item['size_bytes']} bytes, {item['status']})")

if report['inbox']['blocked_large_file_entries']:
    md_lines.extend(['', '## Blocked Large Files'])
    for item in report['inbox']['blocked_large_file_entries']:
        md_lines.append(f"- {item['name']} ({item['size_bytes']} bytes, {item['status']})")

if report['inbox']['skipped_entries']:
    md_lines.extend(['', '## Skipped Entries'])
    for item in report['inbox']['skipped_entries']:
        md_lines.append(f"- {item['name']} ({item['size_bytes']} bytes, {item['status']})")

if errors:
    md_lines.extend(['', '## Errors'])
    for error in errors:
        md_lines.append(f"- {error}")

md_out.write_text('\n'.join(md_lines) + '\n', encoding='utf-8')
json_out.chmod(0o600)
md_out.chmod(0o600)

if infra_failure:
    raise SystemExit(1)

if status == 'blocked':
    raise SystemExit(0)
PY
