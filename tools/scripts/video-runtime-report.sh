#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="${VIDEO_RUNTIME_REPORT_REPO_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
OUTPUT_DIR="${VIDEO_RUNTIME_REPORT_DIR:-$REPO_ROOT/runtime/local/video}"
JSON_OUTPUT="$OUTPUT_DIR/latest.json"
MD_OUTPUT="$OUTPUT_DIR/latest.md"
STARTED_AT="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
STARTED_EPOCH="$(date +%s)"

mkdir -p "$OUTPUT_DIR"
chmod 700 "$OUTPUT_DIR"

STORAGE_JSON="$(python3 - "$REPO_ROOT" "$OUTPUT_DIR" <<'PY'
import datetime as dt
import json
import os
import pathlib
import stat
import time

repo_root = pathlib.Path(os.path.abspath(os.path.expanduser(os.sys.argv[1])))
output_dir = pathlib.Path(os.path.abspath(os.path.expanduser(os.sys.argv[2])))
valid_classifications = {"CURRENT_DURABLE", "CURRENT_TEMPORARY", "LEGACY", "UNKNOWN"}
age_bucket_names = ("lt_1d", "1d_7d", "7d_30d", "30d_90d", "gt_90d", "unknown")


def empty_buckets():
    return {name: 0 for name in age_bucket_names}


def warning_code(root_id, code):
    return f"{root_id}:{code}"


def limit_from_env(name, default, minimum, maximum):
    raw = os.environ.get(name, "").strip()
    if not raw:
        return default
    try:
        value = int(raw)
    except ValueError:
        return default
    return max(minimum, min(maximum, value))


MAX_DEPTH = limit_from_env("VIDEO_RUNTIME_REPORT_MAX_DEPTH", 4, 0, 12)
MAX_FILES = limit_from_env("VIDEO_RUNTIME_REPORT_MAX_FILES", 5000, 1, 50000)
MAX_DIRECTORIES = limit_from_env("VIDEO_RUNTIME_REPORT_MAX_DIRECTORIES", 1000, 1, 20000)
TIMEOUT_SECONDS = limit_from_env("VIDEO_RUNTIME_REPORT_SCAN_TIMEOUT_SECONDS", 2, 1, 30)
LIMITS = {
    "maxDepth": MAX_DEPTH,
    "maxFilesPerRoot": MAX_FILES,
    "maxDirectoriesPerRoot": MAX_DIRECTORIES,
    "timeoutSeconds": TIMEOUT_SECONDS,
}


def default_roots():
    local_video = pathlib.Path(os.path.expanduser("~")) / ".local" / "video-orchestrator"
    return [
        {"id": "brain-video-analysis-runtime", "path": str(repo_root / "runtime" / "local" / "brain-core" / "video-analysis"), "classification": "CURRENT_TEMPORARY"},
        {"id": "brain-video-report", "path": str(output_dir), "classification": "CURRENT_DURABLE"},
        {"id": "video-orchestrator-data", "path": str(local_video / "data"), "classification": "UNKNOWN"},
        {"id": "video-orchestrator-packages", "path": str(local_video / "packages"), "classification": "UNKNOWN"},
        {"id": "video-orchestrator-output", "path": str(local_video / "output"), "classification": "UNKNOWN"},
        {"id": "video-orchestrator-artifacts", "path": str(local_video / "artifacts"), "classification": "UNKNOWN"},
        {"id": "video-orchestrator-archives", "path": str(local_video / "backups" / "storage-archives"), "classification": "LEGACY"},
    ]


def configured_roots():
    raw = os.environ.get("VIDEO_RUNTIME_REPORT_STORAGE_ROOTS_JSON", "").strip()
    if not raw:
        return default_roots(), []
    try:
        value = json.loads(raw)
    except json.JSONDecodeError:
        return [], ["storage-root-config:invalid-json"]
    if not isinstance(value, list):
        return [], ["storage-root-config:not-an-array"]
    if len(value) > 20:
        return [], ["storage-root-config:too-many-roots"]

    roots = []
    errors = []
    seen_ids = set()
    for item in value:
        if not isinstance(item, dict):
            errors.append("storage-root-config:invalid-entry")
            continue
        root_id = item.get("id")
        raw_path = item.get("path")
        classification = item.get("classification")
        if not isinstance(root_id, str) or not root_id or any(char not in "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789._-" for char in root_id):
            errors.append("storage-root-config:invalid-id")
            continue
        if root_id in seen_ids:
            errors.append(f"storage-root-config:duplicate-id:{root_id}")
            continue
        if not isinstance(raw_path, str) or not raw_path.strip():
            errors.append(f"storage-root-config:missing-path:{root_id}")
            continue
        if classification not in valid_classifications:
            errors.append(f"storage-root-config:invalid-classification:{root_id}")
            continue
        resolved_path = pathlib.Path(os.path.abspath(os.path.expanduser(raw_path)))
        if len(resolved_path.parts) < 3 or resolved_path == pathlib.Path(resolved_path.anchor) or resolved_path == pathlib.Path(os.path.expanduser("~")) or resolved_path == repo_root:
            errors.append(f"storage-root-config:broad-path:{root_id}")
            continue
        roots.append({"id": root_id, "path": str(resolved_path), "classification": classification})
        seen_ids.add(root_id)
    return roots, errors


def iso_timestamp(value):
    try:
        return dt.datetime.fromtimestamp(value, tz=dt.timezone.utc).isoformat().replace("+00:00", "Z")
    except (OverflowError, OSError, ValueError):
        return None


def path_has_rejected_symlink(path_value):
    candidate = pathlib.Path(path_value)
    current = pathlib.Path(candidate.anchor)
    for part in candidate.parts[1:]:
        current /= part
        try:
            if stat.S_ISLNK(os.lstat(current).st_mode) and current not in {pathlib.Path("/tmp"), pathlib.Path("/var")}:
                return True
        except FileNotFoundError:
            break
        except PermissionError:
            return False
    return False


def age_bucket(mtime, now):
    if not isinstance(mtime, (int, float)) or mtime < 0 or mtime > now:
        return "unknown"
    age_seconds = now - mtime
    if age_seconds < 86400:
        return "lt_1d"
    if age_seconds < 604800:
        return "1d_7d"
    if age_seconds < 2592000:
        return "7d_30d"
    if age_seconds < 7776000:
        return "30d_90d"
    return "gt_90d"


def empty_root(root, status, exists, warnings):
    return {
        "id": root["id"],
        "classification": root["classification"],
        "status": status,
        "exists": exists,
        "bytes": 0,
        "fileCount": 0,
        "directoryCount": 0,
        "oldestModifiedAt": None,
        "newestModifiedAt": None,
        "ageBuckets": empty_buckets(),
        "warnings": sorted(set(warnings)),
    }


def scan_root(root, now):
    root_id = root["id"]
    root_path = pathlib.Path(root["path"])
    if path_has_rejected_symlink(root_path):
        return empty_root(root, "unavailable", True, [warning_code(root_id, "symlink-path-rejected")])

    try:
        root_stat = os.lstat(root_path)
    except FileNotFoundError:
        return empty_root(root, "missing", False, [warning_code(root_id, "root-missing")])
    except PermissionError:
        return empty_root(root, "unavailable", True, [warning_code(root_id, "permission-denied")])
    except OSError:
        return empty_root(root, "unavailable", True, [warning_code(root_id, "root-stat-failed")])

    if stat.S_ISLNK(root_stat.st_mode):
        return empty_root(root, "unavailable", True, [warning_code(root_id, "symlink-root-rejected")])
    if not stat.S_ISDIR(root_stat.st_mode):
        return empty_root(root, "unavailable", True, [warning_code(root_id, "root-not-directory")])

    result = empty_root(root, "ok", True, [])
    result["directoryCount"] = 1
    root_mtime = root_stat.st_mtime
    result["oldestModifiedAt"] = iso_timestamp(root_mtime)
    result["newestModifiedAt"] = iso_timestamp(root_mtime)
    result["ageBuckets"][age_bucket(root_mtime, now)] += 1
    warnings = set()
    started = time.monotonic()
    files_seen = 0
    directories_seen = 1

    def add_warning(code):
        warnings.add(warning_code(root_id, code))

    def update_mtime(mtime):
        timestamp = iso_timestamp(mtime)
        if timestamp is None:
            add_warning("invalid-mtime")
            result["ageBuckets"]["unknown"] += 1
            return
        if result["oldestModifiedAt"] is None or timestamp < result["oldestModifiedAt"]:
            result["oldestModifiedAt"] = timestamp
        if result["newestModifiedAt"] is None or timestamp > result["newestModifiedAt"]:
            result["newestModifiedAt"] = timestamp
        result["ageBuckets"][age_bucket(mtime, now)] += 1

    def scan_directory(directory, depth):
        nonlocal files_seen, directories_seen
        if time.monotonic() - started >= TIMEOUT_SECONDS:
            add_warning("scan-timeout")
            return
        if depth >= MAX_DEPTH:
            add_warning("max-depth-reached")
            return
        try:
            entries = sorted(os.scandir(directory), key=lambda entry: entry.name)
        except PermissionError:
            add_warning("permission-denied")
            return
        except OSError:
            add_warning("directory-read-failed")
            return

        for entry in entries:
            if time.monotonic() - started >= TIMEOUT_SECONDS:
                add_warning("scan-timeout")
                return
            try:
                entry_stat = entry.stat(follow_symlinks=False)
            except PermissionError:
                add_warning("permission-denied")
                continue
            except FileNotFoundError:
                add_warning("entry-disappeared")
                continue
            except OSError:
                add_warning("entry-stat-failed")
                continue

            if stat.S_ISLNK(entry_stat.st_mode):
                add_warning("symlink-entry-rejected")
                continue
            if stat.S_ISREG(entry_stat.st_mode):
                if files_seen >= MAX_FILES:
                    add_warning("max-files-reached")
                    return
                files_seen += 1
                result["fileCount"] += 1
                result["bytes"] += max(0, int(entry_stat.st_size))
                update_mtime(entry_stat.st_mtime)
                continue
            if stat.S_ISDIR(entry_stat.st_mode):
                if directories_seen >= MAX_DIRECTORIES:
                    add_warning("max-directories-reached")
                    return
                directories_seen += 1
                result["directoryCount"] += 1
                update_mtime(entry_stat.st_mtime)
                scan_directory(entry.path, depth + 1)
                continue
            add_warning("special-file-skipped")

    scan_directory(str(root_path), 0)
    result["warnings"] = sorted(warnings)
    if warnings:
        result["status"] = "partial"
    return result


def scan_storage():
    roots, config_errors = configured_roots()
    warnings = list(config_errors)
    if not roots and not config_errors:
        warnings.append("storage-root-config:no-roots")

    root_paths = []
    valid_roots = []
    for root in roots:
        current = pathlib.Path(root["path"])
        overlap = any(current == prior or prior in current.parents or current in prior.parents for prior in root_paths)
        if overlap:
            warnings.append(warning_code(root["id"], "overlapping-root-rejected"))
            continue
        root_paths.append(current)
        valid_roots.append(root)

    now = time.time()
    scanned_roots = [scan_root(root, now) for root in sorted(valid_roots, key=lambda item: item["id"])]
    totals = {"bytes": 0, "files": 0, "directories": 0, "temporaryBytes": 0, "durableBytes": 0, "legacyBytes": 0, "unknownBytes": 0}
    age_buckets = empty_buckets()
    collection_errors = []
    for root in scanned_roots:
        totals["bytes"] += root["bytes"]
        totals["files"] += root["fileCount"]
        totals["directories"] += root["directoryCount"]
        classification_total = {
            "CURRENT_TEMPORARY": "temporaryBytes",
            "CURRENT_DURABLE": "durableBytes",
            "LEGACY": "legacyBytes",
            "UNKNOWN": "unknownBytes",
        }[root["classification"]]
        totals[classification_total] += root["bytes"]
        for bucket, count in root["ageBuckets"].items():
            age_buckets[bucket] += count
        warnings.extend(root["warnings"])
        if root["status"] in {"partial", "unavailable"}:
            collection_errors.extend(root["warnings"])

    if totals["unknownBytes"] > 0:
        warnings.append("unknown-storage-present")
    if totals["legacyBytes"] > 0:
        warnings.append("legacy-storage-present")
    if age_buckets["30d_90d"] > 0 or age_buckets["gt_90d"] > 0:
        warnings.append("storage-older-than-30-days")

    statuses = {root["status"] for root in scanned_roots}
    if not scanned_roots:
        status = "unavailable"
    elif statuses & {"partial", "unavailable"}:
        status = "partial"
    else:
        status = "ok"
    return {
        "schemaVersion": "1.0.0",
        "status": status,
        "generatedAt": dt.datetime.fromtimestamp(now, tz=dt.timezone.utc).isoformat().replace("+00:00", "Z"),
        "rootCount": len(scanned_roots),
        "roots": scanned_roots,
        "totals": totals,
        "ageBuckets": age_buckets,
        "warningThresholds": {"staleAgeDays": 30, "unknownBytes": 1, "legacyBytes": 1},
        "bounds": LIMITS,
        "warnings": sorted(set(warnings)),
        "collectionErrors": sorted(set(collection_errors)),
        "candidateCount": 0,
        "safety": {
            "reportOnly": True,
            "writesToMind": False,
            "executableActions": False,
            "deletesFiles": False,
            "movesFiles": False,
            "archivesFiles": False,
            "networkAccess": False,
            "privateContentNames": False,
        },
    }


try:
    print(json.dumps(scan_storage(), sort_keys=True, separators=(",", ":")))
except Exception:
    print(json.dumps({
        "schemaVersion": "1.0.0",
        "status": "unavailable",
        "generatedAt": None,
        "rootCount": 0,
        "roots": [],
        "totals": {"bytes": 0, "files": 0, "directories": 0, "temporaryBytes": 0, "durableBytes": 0, "legacyBytes": 0, "unknownBytes": 0},
        "ageBuckets": empty_buckets(),
        "warningThresholds": {"staleAgeDays": 30, "unknownBytes": 1, "legacyBytes": 1},
        "bounds": LIMITS,
        "warnings": ["storage-collection-failed"],
        "collectionErrors": ["storage-collection-failed"],
        "candidateCount": 0,
        "safety": {"reportOnly": True, "writesToMind": False, "executableActions": False, "deletesFiles": False, "movesFiles": False, "archivesFiles": False, "networkAccess": False, "privateContentNames": False},
    }, sort_keys=True, separators=(",", ":")))
PY
)"

ENDED_AT="$(TZ=Europe/Lisbon date '+%Y-%m-%d %H:%M:%S %Z')"
ENDED_EPOCH="$(date +%s)"
DURATION_SECONDS="$((ENDED_EPOCH - STARTED_EPOCH))"

python3 - "$JSON_OUTPUT" "$STARTED_AT" "$ENDED_AT" "$DURATION_SECONDS" "$STORAGE_JSON" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
started_at = sys.argv[2]
ended_at = sys.argv[3]
duration_seconds = int(sys.argv[4])
storage = json.loads(sys.argv[5])
payload = {
    "job": "video-runtime-report",
    "status": "success",
    "enabled": False,
    "message": "video runtime report generated with read-only storage telemetry",
    "startedAtLisbon": started_at,
    "endedAtLisbon": ended_at,
    "durationSeconds": duration_seconds,
    "mode": "report-only",
    "writesToMind": False,
    "executableActions": False,
    "deletesFiles": False,
    "queue": [],
    "storage": storage,
}
path.write_text(json.dumps(payload, indent=2) + "\n")
PY

python3 - "$STORAGE_JSON" "$STARTED_AT" "$ENDED_AT" "$DURATION_SECONDS" "$MD_OUTPUT" <<'PY'
import json
import pathlib
import sys

storage = json.loads(sys.argv[1])
started_at = sys.argv[2]
ended_at = sys.argv[3]
duration_seconds = sys.argv[4]
path = pathlib.Path(sys.argv[5])
totals = storage["totals"]
age_buckets = storage["ageBuckets"]
lines = [
    "# Video Runtime Report",
    "",
    "- Job: video-runtime-report",
    "- Status: success",
    "- Message: video runtime report generated with read-only storage telemetry",
    f"- Started: {started_at}",
    f"- Ended: {ended_at}",
    f"- Duration: {duration_seconds}s",
    "- Mode: report-only",
    "- Writes to Mind: false",
    "- Executable actions: false",
    "- Deletes files: false",
    "",
    "## Queue",
    "",
    "Queue is empty; this report does not inspect or mutate queue state.",
    "",
    "## Storage",
    "",
    f"- Collection status: {storage['status']}",
    f"- Roots observed: {storage['rootCount']}",
    f"- Total bytes: {totals['bytes']}",
    f"- Files / directories: {totals['files']} / {totals['directories']}",
    f"- Temporary bytes: {totals['temporaryBytes']}",
    f"- Durable bytes: {totals['durableBytes']}",
    f"- Legacy bytes: {totals['legacyBytes']}",
    f"- Unknown/unclassified bytes: {totals['unknownBytes']}",
    "",
    "| Root | Classification | Status | Exists | Files | Dirs | Bytes | Oldest mtime | Newest mtime |",
    "| --- | --- | --- | --- | ---: | ---: | ---: | --- | --- |",
]
for root in storage["roots"]:
    lines.append(f"| {root['id']} | {root['classification']} | {root['status']} | {str(root['exists']).lower()} | {root['fileCount']} | {root['directoryCount']} | {root['bytes']} | {root['oldestModifiedAt'] or '—'} | {root['newestModifiedAt'] or '—'} |")
lines.extend([
    "",
    "Age buckets: " + ", ".join(f"{key}={age_buckets[key]}" for key in age_buckets),
    "",
    "Warnings: " + (", ".join(storage["warnings"]) if storage["warnings"] else "none"),
    "",
    "## Safety",
    "",
    "This report only writes the bounded JSON and Markdown summaries into Brain runtime storage. It does not read media contents, emit private filenames, mutate queue state, write Mind, call external systems, archive files, move files, or delete files.",
])
path.write_text("\n".join(lines) + "\n")
PY

chmod 600 "$JSON_OUTPUT" "$MD_OUTPUT"
