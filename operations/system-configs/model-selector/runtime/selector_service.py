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
from urllib.parse import parse_qs, urlparse

# Ensure this package is importable when run directly
sys.path.insert(0, str(Path(__file__).parent))
from core import ModelSelector, NoProviderAvailable, TaskMetadata

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


def _read_body(handler: BaseHTTPRequestHandler) -> dict:
    length = int(handler.headers.get("Content-Length", 0))
    if length:
        raw = handler.rfile.read(length)
        return json.loads(raw.decode("utf-8"))
    return {}


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
            body = _read_body(self)
            task_type = body.get("task_type", "")
            input_tokens = int(body.get("input_token_count", 0))
            urgent = bool(body.get("urgent", False))
            previous_failures = body.get("previous_failures", [])
            local_only = bool(body.get("local_only", False))

            if not task_type:
                _json_response(self, 400, {"error": "task_type is required"})
                return

            # Build task_metadata based on local_only flag
            if local_only:
                task_metadata = TaskMetadata(external_provider_disallowed=True, offline=True)
            else:
                task_metadata = TaskMetadata()

            try:
                result = _selector.select(
                    task_type=task_type,
                    input_token_count=input_tokens,
                    urgent=urgent,
                    previous_failures=previous_failures,
                    task_metadata=task_metadata,
                )
                if isinstance(result, dict):
                    _json_response(self, 200, result)
                else:
                    _json_response(self, 200, {
                        "provider_id": result.provider_id,
                        "model": result.model,
                        "base_url": result.base_url,
                        "reason": result.reason,
                        "cost_estimate": result.cost_estimate,
                        "timeout_inference_sec": result.timeout_inference_sec,
                    })
            except NoProviderAvailable as e:
                _json_response(self, 503, {"error": str(e), "task_type": task_type})
            except ValueError as e:
                _json_response(self, 400, {"error": str(e)})
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
