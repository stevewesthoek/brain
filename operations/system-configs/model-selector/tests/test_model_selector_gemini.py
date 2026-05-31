#!/usr/bin/env python3
"""Focused tests for Gemini-first selector policy."""
import json
import os
import sys
import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path

RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"
sys.path.insert(0, str(RUNTIME_DIR))

import core  # noqa: E402


class TestGeminiProviderPolicy(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.config_dir = self.root / "config"
        self.state_dir = self.root / "state"
        self.log_dir = self.root / "logs"
        self.config_dir.mkdir()
        self.state_dir.mkdir()
        self.log_dir.mkdir()

        self.old_paths = {
            "CONFIG_DIR": core.CONFIG_DIR,
            "STATE_DIR": core.STATE_DIR,
            "LOG_DIR": core.LOG_DIR,
            "PROVIDERS_PATH": core.PROVIDERS_PATH,
            "TASK_TYPES_PATH": core.TASK_TYPES_PATH,
            "SELECTOR_CONFIG_PATH": core.SELECTOR_CONFIG_PATH,
            "BEDROCK_MODELS_PATH": core.BEDROCK_MODELS_PATH,
            "RATE_LIMITS_PATH": core.RATE_LIMITS_PATH,
            "CB_STATE_PATH": core.CB_STATE_PATH,
            "BEDROCK_ACCESS_PATH": core.BEDROCK_ACCESS_PATH,
            "BEDROCK_OUTCOMES_PATH": core.BEDROCK_OUTCOMES_PATH,
            "AUDIT_LOG_PATH": core.AUDIT_LOG_PATH,
            "GEMINI_QUOTA_PATH": getattr(core, "GEMINI_QUOTA_PATH", None),
        }
        core.CONFIG_DIR = self.config_dir
        core.STATE_DIR = self.state_dir
        core.LOG_DIR = self.log_dir
        core.PROVIDERS_PATH = self.config_dir / "ai-providers.json"
        core.TASK_TYPES_PATH = self.config_dir / "ai-task-types.json"
        core.SELECTOR_CONFIG_PATH = self.config_dir / "ai-selector-config.json"
        core.BEDROCK_MODELS_PATH = self.config_dir / "ai-bedrock-models.json"
        core.RATE_LIMITS_PATH = self.state_dir / "rate-limits.json"
        core.CB_STATE_PATH = self.state_dir / "circuit-breakers.json"
        core.BEDROCK_ACCESS_PATH = self.state_dir / "bedrock-model-access.json"
        core.BEDROCK_OUTCOMES_PATH = self.state_dir / "bedrock-model-outcomes.json"
        core.AUDIT_LOG_PATH = self.log_dir / "ai-selections.jsonl"
        core.GEMINI_QUOTA_PATH = self.state_dir / "gemini-quota.json"

        self.old_gemini_key = os.environ.get("GEMINI_API_KEY")
        self._write_common_config()

    def tearDown(self):
        for name, value in self.old_paths.items():
            if value is None:
                continue
            setattr(core, name, value)
        if self.old_gemini_key is None:
            os.environ.pop("GEMINI_API_KEY", None)
        else:
            os.environ["GEMINI_API_KEY"] = self.old_gemini_key
        self.tmp.cleanup()

    def _write_common_config(self):
        providers = {
            "version": 4,
            "providers": [
                {
                    "id": "gemini-free",
                    "label": "Gemini free-tier",
                    "type": "gemini",
                    "api_key_env": "GEMINI_API_KEY",
                    "expose_api_key": False,
                    "cost_per_1k_tokens": 0.0,
                    "priority": 1,
                    "capabilities": ["text/small", "text/medium", "text/large"],
                    "max_context_tokens": 1000000,
                    "health_check": {"env_exists": "GEMINI_API_KEY"},
                    "timeout_inference_sec": 180,
                    "schedule_preference": "any",
                    "models": ["gemini-2.5-flash"],
                },
                {
                    "id": "ollama-m4pro",
                    "label": "Mac Mini M4 Pro",
                    "type": "openai-compatible",
                    "base_url": "http://localhost:11434/v1",
                    "api_key": None,
                    "cost_per_1k_tokens": 0.0,
                    "priority": 2,
                    "capabilities": ["text/small", "text/medium", "text/large"],
                    "max_context_tokens": 128000,
                    "health_check": {"endpoint": "http://localhost:11434/api/tags"},
                    "timeout_inference_sec": 120,
                    "schedule_preference": "any",
                    "preferred_models": ["qwen2.5:14b"],
                },
                {
                    "id": "codex-cli",
                    "type": "cli",
                    "cost_per_1k_tokens": 0.0,
                    "priority": 4,
                    "capabilities": ["text/small", "text/medium", "text/large"],
                    "models": ["gpt-5.4"],
                },
            ],
        }
        task_types = {
            "task_types": {
                "metadata_generation": {
                    "capability": "text/medium",
                    "typical_input_tokens": 8000,
                    "typical_output_tokens": 2000,
                    "local_viable": True,
                    "min_local_model_params": "7B",
                }
            }
        }
        selector_config = {
            "batch_window": {"start_hour": 1, "end_hour": 7},
            "prefer_defer_over_paid": True,
            "rate_limit_state_persist_interval_sec": 60,
        }
        core.PROVIDERS_PATH.write_text(json.dumps(providers, indent=2))
        core.TASK_TYPES_PATH.write_text(json.dumps(task_types, indent=2))
        core.SELECTOR_CONFIG_PATH.write_text(json.dumps(selector_config, indent=2))

    def _selector_with_local_health(self):
        selector = core.ModelSelector()

        def fake_local_health(provider):
            selector._provider_models[provider["id"]] = ["qwen2.5vl:7b", *provider.get("preferred_models", [])]
            return True

        selector._check_openai_compatible_health = fake_local_health
        return selector

    def _seed_gemini_quota(self, *, rpm_used=0, tpm_used=0, rpd_used=0, rpm_limit=60, tpm_limit=1000000, rpd_limit=1000000):
        date = datetime.now(UTC).date().isoformat()
        payload = {
            f"gemini-free:{date}:UTC": {
                "date": date,
                "rpm_used": rpm_used,
                "tpm_used": tpm_used,
                "rpd_used": rpd_used,
                "rpm_limit": rpm_limit,
                "tpm_limit": tpm_limit,
                "rpd_limit": rpd_limit,
                "reservations": [],
            }
        }
        core.GEMINI_QUOTA_PATH.write_text(json.dumps(payload, indent=2))

    def _gemini_quota_key(self):
        return f"gemini-free:{datetime.now(UTC).date().isoformat()}:UTC"

    def test_gemini_selected_first_when_key_present(self):
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()

        result = selector.select("metadata_generation", input_token_count=1000)

        self.assertEqual(result.provider_id, "gemini-free")
        self.assertEqual(result.model, "gemini-2.5-flash")
        self.assertIsNone(result.api_key)

    def test_gemini_skipped_without_key_and_local_selected(self):
        os.environ.pop("GEMINI_API_KEY", None)
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()

        result = selector.select("metadata_generation", input_token_count=1000)

        self.assertEqual(result.provider_id, "ollama-m4pro")
        self.assertEqual(result.model, "qwen2.5:14b")

    def test_provider_health_uses_env_presence_without_exposing_secret(self):
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()

        providers = selector.providers_with_health()
        gemini = next(p for p in providers if p["id"] == "gemini-free")

        self.assertTrue(gemini["healthy"])
        self.assertEqual(gemini["api_key_env"], "GEMINI_API_KEY")
        self.assertNotIn("api_key", gemini)

    def test_gemini_quota_exhaustion_falls_back_to_local(self):
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota(rpm_used=60)
        selector = self._selector_with_local_health()

        result = selector.select("metadata_generation", input_token_count=1000)

        self.assertEqual(result.provider_id, "ollama-m4pro")
        self.assertEqual(result.model, "qwen2.5:14b")

    def test_gemini_reservation_updates_quota_state(self):
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota(rpm_used=1, tpm_used=1000, rpd_used=2000)
        selector = self._selector_with_local_health()

        result = selector.select("metadata_generation", input_token_count=500)

        self.assertEqual(result.provider_id, "gemini-free")
        quota = json.loads(core.GEMINI_QUOTA_PATH.read_text())
        entry = quota[self._gemini_quota_key()]
        self.assertEqual(entry["rpm_used"], 2)
        self.assertEqual(entry["tpm_used"], 1500)
        self.assertEqual(entry["rpd_used"], 4500)

    def test_sensitive_task_skips_gemini_even_with_quota(self):
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()
        task_metadata = core.TaskMetadata(sensitive=True)

        result = selector.select("metadata_generation", input_token_count=1000, task_metadata=task_metadata)

        self.assertEqual(result.provider_id, "ollama-m4pro")
        self.assertEqual(result.model, "qwen2.5:14b")

    def test_private_task_skips_gemini_even_with_quota(self):
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()
        task_metadata = core.TaskMetadata(private=True)

        result = selector.select("metadata_generation", input_token_count=1000, task_metadata=task_metadata)

        self.assertEqual(result.provider_id, "ollama-m4pro")
        self.assertEqual(result.model, "qwen2.5:14b")

    def test_offline_task_skips_gemini_even_with_quota(self):
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()
        task_metadata = core.TaskMetadata(offline=True)

        result = selector.select("metadata_generation", input_token_count=1000, task_metadata=task_metadata)

        self.assertEqual(result.provider_id, "ollama-m4pro")
        self.assertEqual(result.model, "qwen2.5:14b")

    def test_external_disallowed_task_skips_gemini_even_with_quota(self):
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()
        task_metadata = core.TaskMetadata(external_provider_disallowed=True)

        result = selector.select("metadata_generation", input_token_count=1000, task_metadata=task_metadata)

        self.assertEqual(result.provider_id, "ollama-m4pro")
        self.assertEqual(result.model, "qwen2.5:14b")

    def test_non_sensitive_task_selects_gemini_normally(self):
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()
        task_metadata = core.TaskMetadata(sensitive=False, private=False, offline=False, external_provider_disallowed=False)

        result = selector.select("metadata_generation", input_token_count=1000, task_metadata=task_metadata)

        self.assertEqual(result.provider_id, "gemini-free")
        self.assertEqual(result.model, "gemini-2.5-flash")

    def test_multiple_privacy_flags_skip_gemini(self):
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()
        task_metadata = core.TaskMetadata(sensitive=True, private=True)

        result = selector.select("metadata_generation", input_token_count=1000, task_metadata=task_metadata)

        self.assertEqual(result.provider_id, "ollama-m4pro")
        self.assertEqual(result.model, "qwen2.5:14b")

    def test_task_metadata_none_allows_gemini(self):
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()

        result = selector.select("metadata_generation", input_token_count=1000, task_metadata=None)

        self.assertEqual(result.provider_id, "gemini-free")
        self.assertEqual(result.model, "gemini-2.5-flash")

    def test_result_includes_task_metadata(self):
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()
        task_metadata = core.TaskMetadata(sensitive=True)

        result = selector.select("metadata_generation", input_token_count=1000, task_metadata=task_metadata)

        self.assertIsNotNone(result.task_metadata)
        self.assertTrue(result.task_metadata.sensitive)
        self.assertFalse(result.task_metadata.private)


if __name__ == "__main__":
    unittest.main()
