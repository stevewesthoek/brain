#!/usr/bin/env python3
"""
AI Model Selector — HTTP microservice at localhost:4890.
Serves all consumers: VO worker, Claude Code, Codex, Gemini CLI.
"""
from __future__ import annotations

import json
import logging
import os
import sys
import time
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, urlparse

# Ensure this package is importable when run directly
sys.path.insert(0, str(Path(__file__).parent))
from core import DeferredSelection, ModelSelector, NoProviderAvailable, SelectionResult, TaskMetadata

LOG_DIR = Path.home() / ".local/video-orchestrator/logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(LOG_DIR / "model-selector.log"),
    ],
)
log = logging.getLogger("selector_service")

PORT = int(os.environ.get("AI_SELECTOR_PORT", "4890"))

_selector = ModelSelector()


def _json_response(handler: BaseHTTPRequestHandler, status: int, data: object) -> None:
    body = json.dumps(data, default=str).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def _read_body(handler: BaseHTTPRequestHandler) -> object:
    length = int(handler.headers.get("Content-Length", 0))
    if length:
        raw = handler.rfile.read(length)
        return json.loads(raw.decode("utf-8"))
    return {}


_METADATA_BOOL_FIELDS = {
    "sensitive",
    "private",
    "offline",
    "external_provider_disallowed",
}
_METADATA_LIST_FIELDS = {
    "preferred_models",
    "preferred_providers",
    "allowed_models",
    "disallowed_models",
    "allowed_providers",
    "disallowed_providers",
}
_METADATA_STRING_FIELDS = {
    "quality_tier",
    "fallback_policy",
    "selection_policy",
}


def normalize_select_request(body: object) -> dict[str, Any]:
    """Validate the public /select shape without widening selector behavior."""
    if not isinstance(body, dict):
        raise ValueError("request body must be a JSON object")

    task_type = body.get("task_type")
    if not isinstance(task_type, str) or not task_type.strip():
        raise ValueError("task_type is required")

    input_tokens = body.get("input_token_count", 0)
    if isinstance(input_tokens, bool) or not isinstance(input_tokens, int) or input_tokens < 0:
        raise ValueError("input_token_count must be a non-negative integer")

    urgent = body.get("urgent", False)
    if not isinstance(urgent, bool):
        raise ValueError("urgent must be a boolean")

    previous_failures = body.get("previous_failures", [])
    if not isinstance(previous_failures, list) or not all(isinstance(item, str) for item in previous_failures):
        raise ValueError("previous_failures must be an array of strings")

    local_only = body.get("local_only", False)
    if not isinstance(local_only, bool):
        raise ValueError("local_only must be a boolean")

    metadata = body.get("task_metadata", {})
    if not isinstance(metadata, dict):
        raise ValueError("task_metadata must be an object")
    for field_name in _METADATA_BOOL_FIELDS:
        if field_name in metadata and not isinstance(metadata[field_name], bool):
            raise ValueError(f"task_metadata.{field_name} must be a boolean")
    for field_name in _METADATA_LIST_FIELDS:
        if field_name in metadata and (
            not isinstance(metadata[field_name], list)
            or not all(isinstance(item, str) for item in metadata[field_name])
        ):
            raise ValueError(f"task_metadata.{field_name} must be an array of strings")
    for field_name in _METADATA_STRING_FIELDS:
        if field_name in metadata and metadata[field_name] is not None and not isinstance(metadata[field_name], str):
            raise ValueError(f"task_metadata.{field_name} must be a string or null")

    return {
        "task_type": task_type.strip(),
        "input_token_count": input_tokens,
        "urgent": urgent,
        "previous_failures": previous_failures,
        "local_only": local_only,
        "task_metadata": dict(metadata),
    }


def serialize_selection_result(result: SelectionResult | DeferredSelection) -> dict[str, Any]:
    if isinstance(result, DeferredSelection):
        return {
            "outcome": result.outcome,
            "deferred": result.deferred,
            "scheduled_after": result.scheduled_after,
            "reason": result.reason,
        }
    return {
        "outcome": result.outcome,
        "provider_id": result.provider_id,
        "model": result.model,
        "base_url": result.base_url,
        "reason": result.reason,
        "cost_estimate": result.cost_estimate,
        "timeout_inference_sec": result.timeout_inference_sec,
    }


def serialize_rejected(message: str, task_type: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "outcome": "rejected",
        "error": message,
        "reason": message,
    }
    if task_type:
        payload["task_type"] = task_type
    return payload


class SelectorHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt: str, *args: object) -> None:
        log.info(fmt, *args)

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == "/health":
            providers = _selector.providers_with_health()
            _json_response(self, 200, {
                "status": "ok",
                "providers": providers,
                "provider_count": len(providers),
            })

        elif path == "/providers":
            _json_response(self, 200, {"providers": _selector.providers_with_health()})

        elif path == "/health/matrix":
            run_probe = qs.get("probe", ["0"])[0] in {"1", "true", "yes"}
            _json_response(self, 200, _selector.health_matrix(run_probe=run_probe))

        elif path == "/audit":
            limit = int(qs.get("limit", ["20"])[0])
            task_type = qs.get("task_type", [None])[0]
            _json_response(self, 200, {"entries": _selector.audit_recent(limit=limit, task_type=task_type)})

        elif path == "/config":
            cfg = dict(_selector._config)
            _json_response(self, 200, cfg)

        else:
            _json_response(self, 404, {"error": f"Not found: {path}"})

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/select":
            try:
                request = normalize_select_request(_read_body(self))
            except (ValueError, json.JSONDecodeError) as error:
                _json_response(self, 400, serialize_rejected(str(error)))
                return

            task_type = request["task_type"]
            input_tokens = request["input_token_count"]
            urgent = request["urgent"]
            previous_failures = request["previous_failures"]
            local_only = request["local_only"]

            # Build task_metadata from request body.
            # local_only is a legacy convenience shorthand and overrides external/offline constraints.
            task_metadata_body = request["task_metadata"]
            if local_only:
                task_metadata = TaskMetadata(
                    external_provider_disallowed=True,
                    offline=True,
                )
            else:
                task_metadata = TaskMetadata(
                    sensitive=bool(task_metadata_body.get("sensitive", False)),
                    private=bool(task_metadata_body.get("private", False)),
                    offline=bool(task_metadata_body.get("offline", False)),
                    external_provider_disallowed=bool(task_metadata_body.get("external_provider_disallowed", False)),
                    quality_tier=task_metadata_body.get("quality_tier") or None,
                    preferred_models=list(task_metadata_body.get("preferred_models") or []),
                    preferred_providers=list(task_metadata_body.get("preferred_providers") or []),
                    allowed_models=list(task_metadata_body.get("allowed_models") or []),
                    disallowed_models=list(task_metadata_body.get("disallowed_models") or []),
                    allowed_providers=list(task_metadata_body.get("allowed_providers") or []),
                    disallowed_providers=list(task_metadata_body.get("disallowed_providers") or []),
                    fallback_policy=task_metadata_body.get("fallback_policy") or None,
                    selection_policy=task_metadata_body.get("selection_policy") or None,
                )

            try:
                result = _selector.select(
                    task_type=task_type,
                    input_token_count=input_tokens,
                    urgent=urgent,
                    previous_failures=previous_failures,
                    task_metadata=task_metadata,
                )
                _json_response(self, 200, serialize_selection_result(result))
            except NoProviderAvailable as e:
                _json_response(self, 503, {
                    "outcome": e.outcome,
                    "error": str(e),
                    "reason": str(e),
                    "task_type": task_type,
                })
            except ValueError as e:
                _json_response(self, 400, serialize_rejected(str(e), task_type))
            except Exception as e:
                log.exception("select error")
                _json_response(self, 500, {"error": str(e)})

        elif path == "/report-failure":
            body = _read_body(self)
            provider_id = body.get("provider_id", "")
            error_type = body.get("error_type", "error")
            error_message = body.get("error_message", "")
            model_id = body.get("model") or body.get("model_id") or ""
            if not provider_id:
                _json_response(self, 400, {"error": "provider_id is required"})
                return
            _selector.report_failure(provider_id, error_type, error_message, model_id)
            _selector.persist_rate_limits()
            _json_response(self, 200, {"ok": True})

        elif path == "/report-success":
            body = _read_body(self)
            provider_id = body.get("provider_id", "")
            model_id = body.get("model") or body.get("model_id") or ""
            if not provider_id:
                _json_response(self, 400, {"error": "provider_id is required"})
                return
            _selector.report_success(provider_id, model_id)
            _json_response(self, 200, {"ok": True})

        else:
            _json_response(self, 404, {"error": f"Not found: {path}"})

    def do_OPTIONS(self) -> None:
        self.send_response(200)
        self.send_header("Allow", "GET, POST, OPTIONS")
        self.end_headers()


def main() -> None:
    log.info("AI Model Selector starting on port %d", PORT)
    server = HTTPServer(("127.0.0.1", PORT), SelectorHandler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log.info("AI Model Selector stopped")
    finally:
        _selector.persist_rate_limits()


if __name__ == "__main__":
    main()
