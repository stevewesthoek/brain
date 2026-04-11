#!/usr/bin/env python3
"""
Lightweight HTTP server for n8n workflow callbacks.

Exposes mutation approval/rejection/application endpoints that n8n workflows call
to approve/reject/apply mutations triggered from the CLI.

This server runs in parallel with the CLI and allows asynchronous n8n workflows
to control mutation lifecycle without blocking the CLI.

Usage:
    python3 tools/google-ads/http_server.py [--port 8001] [--host localhost]

Or via supervisor/systemd for persistent operation.
"""

import argparse
import json
import logging
import sqlite3
import subprocess
import sys
from datetime import datetime
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / "data" / "google-ads"
DB_PATH = DATA_DIR / "google_ads.sqlite3"
LOG_DIR = DATA_DIR / "logs"
LOG_DIR.mkdir(parents=True, exist_ok=True)

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(LOG_DIR / "http_server.log"),
        logging.StreamHandler(sys.stderr),
    ],
)
logger = logging.getLogger(__name__)


def connect_db() -> sqlite3.Connection:
    """Connect to SQLite database."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    return conn


def utc_now_iso() -> str:
    """Return current UTC time in ISO format."""
    return datetime.utcnow().isoformat() + "Z"


class GoogleAdsHTTPHandler(BaseHTTPRequestHandler):
    """HTTP handler for mutation lifecycle callbacks."""

    def log_message(self, format: str, *args: Any) -> None:
        """Override to use logger instead of stderr."""
        logger.info(f"{self.client_address[0]} - {format % args}")

    def do_POST(self) -> None:
        """Handle POST requests."""
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length)

        try:
            payload = json.loads(body.decode("utf-8"))
        except json.JSONDecodeError:
            self.send_error(400, "Invalid JSON")
            return

        # Route by path
        if self.path == "/approve":
            self._handle_approve(payload)
        elif self.path == "/reject":
            self._handle_reject(payload)
        elif self.path == "/apply":
            self._handle_apply(payload)
        elif self.path == "/status":
            self._handle_status(payload)
        else:
            self.send_error(404, "Not found")

    def _handle_approve(self, payload: dict) -> None:
        """Approve a mutation by ID."""
        mutation_id = payload.get("mutation_id")
        if not mutation_id:
            self.send_error(400, "Missing mutation_id")
            return

        try:
            with connect_db() as conn:
                conn.execute(
                    "UPDATE pending_mutations SET status = ?, updated_at = ? WHERE id = ?",
                    ("approved", utc_now_iso(), mutation_id),
                )
                conn.commit()

                # Log to change_events
                today = datetime.now().strftime("%Y-%m-%d")
                conn.execute(
                    """
                    INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        today,
                        "mutation_approved_via_webhook",
                        "mutation",
                        str(mutation_id),
                        json.dumps({"approved_by": "n8n_workflow", "source": "http_server"}),
                        utc_now_iso(),
                    ),
                )
                conn.commit()

            logger.info(f"Approved mutation {mutation_id}")
            self._send_json({"success": True, "mutation_id": mutation_id, "status": "approved"})
        except Exception as e:
            logger.error(f"Error approving mutation {mutation_id}: {e}")
            self.send_error(500, str(e))

    def _handle_reject(self, payload: dict) -> None:
        """Reject a mutation by ID."""
        mutation_id = payload.get("mutation_id")
        reason = payload.get("reason", "Rejected via webhook")
        if not mutation_id:
            self.send_error(400, "Missing mutation_id")
            return

        try:
            with connect_db() as conn:
                conn.execute(
                    "UPDATE pending_mutations SET status = ?, updated_at = ? WHERE id = ?",
                    ("rejected", utc_now_iso(), mutation_id),
                )
                conn.commit()

                # Log to change_events
                today = datetime.now().strftime("%Y-%m-%d")
                conn.execute(
                    """
                    INSERT INTO change_events (change_date, change_type, resource_type, resource_id, details, created_at)
                    VALUES (?, ?, ?, ?, ?, ?)
                    """,
                    (
                        today,
                        "mutation_rejected_via_webhook",
                        "mutation",
                        str(mutation_id),
                        json.dumps({"rejected_by": "n8n_workflow", "reason": reason}),
                        utc_now_iso(),
                    ),
                )
                conn.commit()

            logger.info(f"Rejected mutation {mutation_id}: {reason}")
            self._send_json({"success": True, "mutation_id": mutation_id, "status": "rejected"})
        except Exception as e:
            logger.error(f"Error rejecting mutation {mutation_id}: {e}")
            self.send_error(500, str(e))

    def _handle_apply(self, payload: dict) -> None:
        """
        Apply an approved mutation by ID.

        This calls the CLI directly via subprocess:
            bash tools/google-ads/run.sh apply --id {id} --live
        """
        mutation_id = payload.get("mutation_id")
        if not mutation_id:
            self.send_error(400, "Missing mutation_id")
            return

        try:
            cli_script = ROOT / "tools" / "google-ads" / "run.sh"
            result = subprocess.run(
                ["bash", str(cli_script), "apply", "--id", str(mutation_id), "--live"],
                capture_output=True,
                text=True,
                timeout=30,
            )

            if result.returncode == 0:
                logger.info(f"Applied mutation {mutation_id}")
                self._send_json(
                    {
                        "success": True,
                        "mutation_id": mutation_id,
                        "status": "applied",
                        "output": result.stdout,
                    }
                )
            else:
                logger.error(f"Failed to apply mutation {mutation_id}: {result.stderr}")
                self._send_json(
                    {
                        "success": False,
                        "mutation_id": mutation_id,
                        "error": result.stderr,
                    },
                    status_code=400,
                )
        except subprocess.TimeoutExpired:
            logger.error(f"Timeout applying mutation {mutation_id}")
            self.send_error(504, "Application timeout")
        except Exception as e:
            logger.error(f"Error applying mutation {mutation_id}: {e}")
            self.send_error(500, str(e))

    def _handle_status(self, payload: dict) -> None:
        """Get status of a mutation by ID."""
        mutation_id = payload.get("mutation_id")
        if not mutation_id:
            self.send_error(400, "Missing mutation_id")
            return

        try:
            with connect_db() as conn:
                row = conn.execute(
                    "SELECT id, status, mutation_type, resource_type FROM pending_mutations WHERE id = ?",
                    (mutation_id,),
                ).fetchone()

                if not row:
                    self._send_json({"success": False, "error": "Not found"}, status_code=404)
                    return

                self._send_json(
                    {
                        "success": True,
                        "mutation_id": mutation_id,
                        "status": row["status"],
                        "type": row["mutation_type"],
                        "resource_type": row["resource_type"],
                    }
                )
        except Exception as e:
            logger.error(f"Error getting mutation status {mutation_id}: {e}")
            self.send_error(500, str(e))

    def _send_json(self, data: dict, status_code: int = 200) -> None:
        """Send JSON response."""
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(json.dumps(data).encode("utf-8"))


def main() -> None:
    """Start HTTP server."""
    parser = argparse.ArgumentParser(description="Google Ads HTTP server for n8n callbacks")
    parser.add_argument("--port", type=int, default=8001, help="Port to listen on")
    parser.add_argument("--host", default="localhost", help="Host to listen on")
    args = parser.parse_args()

    server_address = (args.host, args.port)
    server = HTTPServer(server_address, GoogleAdsHTTPHandler)

    logger.info(f"Starting HTTP server on {args.host}:{args.port}")
    logger.info("Endpoints: /approve, /reject, /apply, /status")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logger.info("Shutting down")
        server.shutdown()


if __name__ == "__main__":
    main()
