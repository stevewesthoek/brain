#!/usr/bin/env python3
"""Tests for AI Model Selector fallback ladder: Gemini → Local → Codex → Bedrock."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"
sys.path.insert(0, str(RUNTIME_DIR))

import core  # noqa: E402


class TestFallbackLadder(unittest.TestCase):
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
        """Setup: Gemini → Local Ollama → Codex CLI → Bedrock Claude."""
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
                    "label": "Codex CLI",
                    "type": "cli",
                    "cost_per_1k_tokens": 0.0,
                    "priority": 3,
                    "capabilities": ["text/small", "text/medium", "text/large"],
                    "models": ["gpt-5.4"],
                    "health_check": {"binary_exists": "codex"},
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

    def _seed_gemini_quota(self, *, rpm_used=0, tpm_used=0, rpd_used=0, rpm_limit=60, tpm_limit=1000000, rpd_limit=1000000):
        payload = {
            "gemini-free:2026-05-24:UTC": {
                "date": "2026-05-24",
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

    def _selector_with_local_health(self):
        selector = core.ModelSelector()

        def fake_local_health(provider):
            selector._provider_models[provider["id"]] = ["qwen2.5vl:7b", *provider.get("preferred_models", [])]
            return True

        selector._check_openai_compatible_health = fake_local_health
        return selector

    def test_codex_selected_after_gemini_unavailable_and_local_degraded(self):
        """Codex CLI selected when Gemini is missing and local Ollama is circuit-broken."""
        os.environ.pop("GEMINI_API_KEY", None)
        self._seed_gemini_quota()
        selector = core.ModelSelector()

        # Manually mark local Ollama as open circuit (simulating repeated failures)
        selector._circuit_breaker.register_failure("ollama-m4pro")
        selector._circuit_breaker.register_failure("ollama-m4pro")
        selector._circuit_breaker.register_failure("ollama-m4pro")
        selector._check_cli_health = lambda provider: True

        result = selector.select("metadata_generation", input_token_count=1000)

        self.assertEqual(result.provider_id, "codex-cli")
        self.assertEqual(result.model, "gpt-5.4")

    def test_local_selected_before_codex_when_healthy(self):
        """Local always wins over Codex when health check passes."""
        os.environ.pop("GEMINI_API_KEY", None)
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()

        result = selector.select("metadata_generation", input_token_count=1000)

        self.assertEqual(result.provider_id, "ollama-m4pro")
        self.assertEqual(result.model, "qwen2.5:14b")

    def test_gemini_preferred_over_local_when_quota_available(self):
        """Gemini is preferred over local when both healthy and quota available."""
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()

        result = selector.select("metadata_generation", input_token_count=1000)

        self.assertEqual(result.provider_id, "gemini-free")
        self.assertEqual(result.model, "gemini-2.5-flash")

    def test_codex_not_selected_when_local_available(self):
        """Codex is skipped even if present when local is healthy."""
        os.environ.pop("GEMINI_API_KEY", None)
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()

        result = selector.select("metadata_generation", input_token_count=1000)

        self.assertNotEqual(result.provider_id, "codex-cli")
        self.assertEqual(result.provider_id, "ollama-m4pro")

    def test_fallback_ladder_gemini_local_codex(self):
        """Full fallback sequence: try Gemini (skip - no key) → Local (pass) → done."""
        os.environ.pop("GEMINI_API_KEY", None)
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()

        result = selector.select("metadata_generation", input_token_count=1000)

        self.assertEqual(result.provider_id, "ollama-m4pro")

    def test_direct_openai_provider_rejected_if_present(self):
        """Direct OpenAI API provider (if present) is never selected."""
        # Simulate a malicious or legacy provider config with direct OpenAI
        providers_data = json.loads(core.PROVIDERS_PATH.read_text())
        providers_data["providers"].append({
            "id": "openai-direct",
            "label": "Direct OpenAI (NOT ALLOWED)",
            "type": "openai-api",
            "api_key_env": "OPENAI_API_KEY",
            "cost_per_1k_tokens": 0.01,
            "priority": 99,
            "capabilities": ["text/small", "text/medium", "text/large"],
            "models": ["gpt-4o"],
        })
        core.PROVIDERS_PATH.write_text(json.dumps(providers_data, indent=2))

        os.environ.pop("GEMINI_API_KEY", None)
        self._seed_gemini_quota()
        with self.assertRaisesRegex(ValueError, "Unsupported provider type"):
            core.ModelSelector()

    def test_direct_anthropic_provider_rejected_if_present(self):
        """Direct Anthropic API provider (if present) is never selected."""
        # Simulate a malicious or legacy provider config with direct Anthropic
        providers_data = json.loads(core.PROVIDERS_PATH.read_text())
        providers_data["providers"].append({
            "id": "anthropic-direct",
            "label": "Direct Anthropic (NOT ALLOWED)",
            "type": "anthropic-api",
            "api_key_env": "ANTHROPIC_API_KEY",
            "cost_per_1k_tokens": 0.02,
            "priority": 99,
            "capabilities": ["text/small", "text/medium", "text/large"],
            "models": ["claude-opus"],
        })
        core.PROVIDERS_PATH.write_text(json.dumps(providers_data, indent=2))

        os.environ.pop("GEMINI_API_KEY", None)
        self._seed_gemini_quota()
        with self.assertRaisesRegex(ValueError, "Unsupported provider type"):
            core.ModelSelector()

    def test_cli_provider_requires_binary_health(self):
        """CLI providers are not selected when their configured binary is unavailable."""
        os.environ.pop("GEMINI_API_KEY", None)
        self._seed_gemini_quota()
        selector = core.ModelSelector()
        selector._check_cli_health = lambda provider: False

        selector._circuit_breaker.register_failure("ollama-m4pro")
        selector._circuit_breaker.register_failure("ollama-m4pro")
        selector._circuit_breaker.register_failure("ollama-m4pro")

        result = selector.select("metadata_generation", input_token_count=1000)

        self.assertIsInstance(result, dict)
        self.assertTrue(result["deferred"])

    def test_cli_provider_selected_when_binary_health_passes(self):
        """CLI providers remain selectable after local providers fail when binary health passes."""
        os.environ.pop("GEMINI_API_KEY", None)
        self._seed_gemini_quota()
        selector = core.ModelSelector()
        selector._check_cli_health = lambda provider: True

        selector._circuit_breaker.register_failure("ollama-m4pro")
        selector._circuit_breaker.register_failure("ollama-m4pro")
        selector._circuit_breaker.register_failure("ollama-m4pro")

        result = selector.select("metadata_generation", input_token_count=1000)

        self.assertEqual(result.provider_id, "codex-cli")
        self.assertEqual(result.model, "gpt-5.4")

    def test_provider_order_respects_priority_and_policy(self):
        """Providers are sorted by priority, not insertion order."""
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()

        # Even though local Ollama appears second in config, Gemini (priority 1) is tried first
        result = selector.select("metadata_generation", input_token_count=1000)

        self.assertEqual(result.provider_id, "gemini-free")

    def test_policy_enforced_even_with_budget_available(self):
        """Policy order (Gemini → Local → Codex) is enforced, not cost."""
        os.environ["GEMINI_API_KEY"] = "test-secret"
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()

        result = selector.select("metadata_generation", input_token_count=1000)

        # Gemini is free (cost 0.0) and preferred, selected even though local is also free
        self.assertEqual(result.provider_id, "gemini-free")
        self.assertEqual(result.cost_estimate, 0.0)

    def test_result_reason_reflects_fallback_chain(self):
        """The reason field explains which providers were tried."""
        os.environ.pop("GEMINI_API_KEY", None)
        self._seed_gemini_quota()
        selector = self._selector_with_local_health()

        result = selector.select("metadata_generation", input_token_count=1000)

        # When local is selected after Gemini is skipped, reason should indicate it
        self.assertIn("priority=2", result.reason)
        self.assertIn("free", result.reason)


if __name__ == "__main__":
    unittest.main()
