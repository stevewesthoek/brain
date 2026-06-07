#!/usr/bin/env python3
"""Resolve an AI Model Selector request for Graphify orchestration.

This wrapper is intentionally generic and thin: it converts JSON request
metadata into the existing AI Model Selector runtime API and returns a stable
JSON response. It does not call model providers directly and does not contain
model fallback logic.
"""
from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any

BRAIN_ROOT = Path(__file__).resolve().parents[2]
SELECTOR_RUNTIME = BRAIN_ROOT / "operations/system-configs/model-selector/runtime"
sys.path.insert(0, str(SELECTOR_RUNTIME))

try:
    import core  # type: ignore  # noqa: E402
except Exception as exc:  # pragma: no cover - defensive CLI boundary
    print(json.dumps({"status": "failed", "error": f"failed to import selector runtime: {exc}"}, indent=2))
    raise SystemExit(1)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Resolve an AI Model Selector request from JSON.")
    parser.add_argument("--request", required=True, help="Path to JSON request file.")
    return parser.parse_args()


def safe_result_dict(result: Any) -> dict[str, Any]:
    if is_dataclass(result):
        data = asdict(result)
    elif isinstance(result, dict):
        data = dict(result)
    else:
        data = {"raw": str(result)}

    if "api_key" in data:
        data["api_key"] = "redacted" if data["api_key"] else None
    if "task_metadata" in data and data["task_metadata"] is not None and is_dataclass(data["task_metadata"]):
        data["task_metadata"] = asdict(data["task_metadata"])
    return data


def main() -> int:
    args = parse_args()
    request_path = Path(args.request).resolve()
    request = json.loads(request_path.read_text())

    metadata = request.get("taskMetadata") or {}
    task_metadata = core.TaskMetadata(**metadata)

    try:
        selector = core.ModelSelector()
        result = selector.select(
            task_type=request["taskType"],
            input_token_count=int(request.get("inputTokenCount") or 0),
            urgent=bool(request.get("urgent") or False),
            previous_failures=list(request.get("previousFailures") or []),
            task_metadata=task_metadata,
        )
        response = {
            "status": "ok",
            "request": request,
            "selection": safe_result_dict(result),
        }
    except Exception as exc:  # pragma: no cover - CLI reports selector failures as JSON
        response = {
            "status": "failed",
            "request": request,
            "error": str(exc),
            "errorType": exc.__class__.__name__,
        }

    print(json.dumps(response, indent=2, sort_keys=True))
    return 0 if response["status"] == "ok" else 1


if __name__ == "__main__":
    raise SystemExit(main())
