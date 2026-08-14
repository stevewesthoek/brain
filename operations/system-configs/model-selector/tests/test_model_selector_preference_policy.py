#!/usr/bin/env python3
"""Tests for generic model selector preference and fallback policy."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"
sys.path.insert(0, str(RUNTIME_DIR))

import core  # noqa: E402


class TestPreferencePolicy(unittest.TestCase):
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
        self._write_config()

    def tearDown(self):
        for name, value in self.old_paths.items():
            setattr(core, name, value)
        self.tmp.cleanup()

    def _write_config(self):
        providers = {
            "providers": [
                {
                    "id": "codex-cli",
                    "type": "cli",
                    "cost_per_1k_tokens": 0.0,
                    "priority": 1,
                    "capabilities": ["text/medium"],
                    "models": ["gpt-5.4-mini"],
                },
                {
                    "id": "claude-bedrock",
                    "type": "bedrock",
                    "cost_per_1k_tokens": 0.0,
                    "priority": 2,
                    "capabilities": ["text/medium"],
                    "models": ["bedrock-model-portfolio"],
                },
                {
                    "id": "ollama-local",
                    "type": "openai-compatible",
                    "base_url": "http://127.0.0.1:11434/v1",
                    "cost_per_1k_tokens": 0.0,
                    "priority": 3,
                    "capabilities": ["text/medium"],
                    "preferred_models": ["qwen2.5:14b"],
                },
            ]
        }
        task_types = {
            "task_types": {
                "text_task": {
                    "capability": "text/medium",
                    "typical_input_tokens": 2000,
                    "typical_output_tokens": 1000,
                    "min_local_model_params": "7B",
                }
            }
        }
        selector_config = {
            "batch_window": {"start_hour": 1, "end_hour": 7},
            "prefer_defer_over_paid": False,
        }
        core.PROVIDERS_PATH.write_text(json.dumps(providers, indent=2))
        core.TASK_TYPES_PATH.write_text(json.dumps(task_types, indent=2))
        core.SELECTOR_CONFIG_PATH.write_text(json.dumps(selector_config, indent=2))
        core.BEDROCK_MODELS_PATH.write_text(json.dumps({"models": []}, indent=2))

    def test_no_metadata_preference_uses_default_priority(self):
        """Without preference metadata, selector uses default priority order."""
        selector = core.ModelSelector()
        selector._check_health = lambda provider: True
        selector._provider_models["ollama-local"] = ["qwen2.5:14b"]

        result = selector.select(
            "text_task",
            input_token_count=1000,
            urgent=True,
        )

        # Default priority: codex-cli (1) < claude-bedrock (2) < ollama-local (3)
        self.assertEqual(result.provider_id, "codex-cli")

    def test_preferred_providers_chosen_when_healthy(self):
        """preferred_providers reorders providers to put preferred first."""
        selector = core.ModelSelector()
        selector._check_health = lambda provider: True
        selector._provider_models["ollama-local"] = ["qwen2.5:14b"]

        result = selector.select(
            "text_task",
            input_token_count=1000,
            urgent=True,
            task_metadata=core.TaskMetadata(
                preferred_providers=["ollama-local"],
            ),
        )

        # ollama-local preferred, so it should be chosen despite higher default priority
        self.assertEqual(result.provider_id, "ollama-local")

    def test_disallowed_providers_excluded(self):
        """disallowed_providers removes a provider from eligibility."""
        selector = core.ModelSelector()
        selector._check_health = lambda provider: True
        selector._provider_models["ollama-local"] = ["qwen2.5:14b"]

        result = selector.select(
            "text_task",
            input_token_count=1000,
            urgent=True,
            task_metadata=core.TaskMetadata(
                disallowed_providers=["codex-cli"],
            ),
        )

        # codex-cli is disallowed, so next in priority (bedrock) would be tried,
        # but bedrock has no models. ollama-local is next.
        self.assertEqual(result.provider_id, "ollama-local")

    def test_allowed_providers_restricts_to_list(self):
        """allowed_providers creates a whitelist; only those can be selected."""
        selector = core.ModelSelector()
        selector._check_health = lambda provider: True
        selector._provider_models["ollama-local"] = ["qwen2.5:14b"]

        result = selector.select(
            "text_task",
            input_token_count=1000,
            urgent=True,
            task_metadata=core.TaskMetadata(
                allowed_providers=["ollama-local"],
            ),
        )

        # Only ollama-local is allowed, even though codex has higher priority
        self.assertEqual(result.provider_id, "ollama-local")

    def test_preferred_models_chosen_when_available(self):
        """preferred_models reorders model selection."""
        selector = core.ModelSelector()
        selector._check_health = lambda provider: True
        selector._provider_models["ollama-local"] = ["qwen2.5:32b", "qwen2.5:14b"]
        selector._local_resource_status = lambda: {
            "memory_pressure_free_percent": 72,
            "load_per_cpu": 0.2,
            "ollama_loaded_models": [],
        }

        result = selector.select(
            "text_task",
            input_token_count=1000,
            urgent=True,
            task_metadata=core.TaskMetadata(
                preferred_models=["qwen2.5:32b"],
                allowed_providers=["ollama-local"],
            ),
        )

        self.assertEqual(result.provider_id, "ollama-local")
        self.assertEqual(result.model, "qwen2.5:32b")

    def test_disallowed_models_excluded_from_selection(self):
        """disallowed_models removes a specific model option, provider skipped if no viable model."""
        selector = core.ModelSelector()
        selector._check_health = lambda provider: True
        # Only 14b is loaded; 32b is not available
        selector._provider_models["ollama-local"] = ["qwen2.5:14b"]

        # When the only available model is disallowed and it's the only provider allowed,
        # no provider is available
        with self.assertRaises(core.NoProviderAvailable):
            selector.select(
                "text_task",
                input_token_count=1000,
                urgent=True,
                task_metadata=core.TaskMetadata(
                    disallowed_models=["qwen2.5:14b"],
                    allowed_providers=["ollama-local"],
                ),
            )

    def test_allowed_models_restricts_model_choice(self):
        """allowed_models restricts to specific models only."""
        selector = core.ModelSelector()
        selector._check_health = lambda provider: True
        selector._provider_models["ollama-local"] = ["qwen2.5:14b", "qwen2.5:32b"]
        selector._local_resource_status = lambda: {
            "memory_pressure_free_percent": 72,
            "load_per_cpu": 0.2,
            "ollama_loaded_models": [],
        }

        result = selector.select(
            "text_task",
            input_token_count=1000,
            urgent=True,
            task_metadata=core.TaskMetadata(
                allowed_models=["qwen2.5:32b"],
                allowed_providers=["ollama-local"],
            ),
        )

        # Only 32b is allowed
        self.assertEqual(result.provider_id, "ollama-local")
        self.assertEqual(result.model, "qwen2.5:32b")

    def test_ordered_then_selector_default_falls_back(self):
        """ordered policy (default) falls back if preferred unavailable."""
        selector = core.ModelSelector()
        # codex-cli is unhealthy, ollama-local is healthy
        selector._check_health = lambda provider: provider["id"] != "codex-cli"
        selector._provider_models["ollama-local"] = ["qwen2.5:14b"]

        result = selector.select(
            "text_task",
            input_token_count=1000,
            urgent=True,
            task_metadata=core.TaskMetadata(
                preferred_providers=["codex-cli"],
                fallback_policy="ordered_then_selector_default",
            ),
        )

        # codex-cli (preferred) is unhealthy, falls back to ollama-local
        self.assertEqual(result.provider_id, "ollama-local")

    def test_ordered_strict_raises_when_preferred_unavailable(self):
        """ordered_strict raises NoProviderAvailable if no preferred option works."""
        selector = core.ModelSelector()
        # codex-cli is unhealthy
        selector._check_health = lambda provider: provider["id"] != "codex-cli"
        selector._provider_models["ollama-local"] = ["qwen2.5:14b"]

        with self.assertRaises(core.NoProviderAvailable):
            selector.select(
                "text_task",
                input_token_count=1000,
                urgent=True,
                task_metadata=core.TaskMetadata(
                    preferred_providers=["codex-cli"],
                    fallback_policy="ordered_strict",
                ),
            )

    def test_none_raises_when_exact_preferred_provider_is_unavailable(self):
        """none permits exactly one declared provider and never widens fallback."""
        selector = core.ModelSelector()
        selector._check_health = lambda provider: provider["id"] != "codex-cli"
        selector._provider_models["ollama-local"] = ["qwen2.5:14b"]

        with self.assertRaises(core.NoProviderAvailable):
            selector.select(
                "text_task",
                input_token_count=1000,
                urgent=True,
                task_metadata=core.TaskMetadata(
                    preferred_providers=["codex-cli"],
                    fallback_policy="none",
                ),
            )

    def test_unknown_fallback_policy_is_rejected(self):
        selector = core.ModelSelector()

        with self.assertRaisesRegex(ValueError, "Unknown fallback_policy"):
            selector.select(
                "text_task",
                input_token_count=1000,
                urgent=True,
                task_metadata=core.TaskMetadata(fallback_policy="silent-widening"),
            )

    def test_external_provider_disallowed_overrides_preferred(self):
        """Hard constraint external_provider_disallowed prevents external preference."""
        selector = core.ModelSelector()
        selector._check_health = lambda provider: True
        selector._provider_models["ollama-local"] = ["qwen2.5:14b"]

        result = selector.select(
            "text_task",
            input_token_count=1000,
            urgent=True,
            task_metadata=core.TaskMetadata(
                preferred_providers=["codex-cli"],
                external_provider_disallowed=True,
            ),
        )

        # codex-cli is external, disallowed by hard constraint, so ollama-local chosen
        self.assertEqual(result.provider_id, "ollama-local")

    def test_offline_overrides_external_preference(self):
        """Hard constraint offline prevents external preference."""
        selector = core.ModelSelector()
        selector._check_health = lambda provider: True
        selector._provider_models["ollama-local"] = ["qwen2.5:14b"]

        result = selector.select(
            "text_task",
            input_token_count=1000,
            urgent=True,
            task_metadata=core.TaskMetadata(
                preferred_providers=["codex-cli"],
                offline=True,
            ),
        )

        # codex-cli is external, offline mode blocks it, so ollama-local chosen
        self.assertEqual(result.provider_id, "ollama-local")


    def test_preferred_providers_order_honored_over_global_priority(self):
        """preferred_providers list order must be honored, even when a listed provider has
        a higher global priority number (lower precedence) than another listed provider.

        Regression test for the Graphify Bedrock-before-Ollama bug:
        ollama-m4pro has priority=2 (higher precedence) than claude-bedrock (priority=5).
        When preferred_providers=["claude-bedrock", "ollama-local"], claude-bedrock must
        be selected first because it appears first in the list — not because of global priority.
        """
        # Use a fresh providers config where ollama-local has lower priority number (higher
        # precedence) than claude-bedrock, mirroring the real ollama-m4pro (2) vs
        # claude-bedrock (5) configuration.
        providers = {
            "providers": [
                {
                    "id": "ollama-local",
                    "type": "openai-compatible",
                    "base_url": "http://127.0.0.1:11434/v1",
                    "cost_per_1k_tokens": 0.0,
                    "priority": 2,  # lower number = higher default precedence
                    "capabilities": ["text/medium", "graphify_semantic_backend"],
                    "preferred_models": ["qwen2.5:14b"],
                },
                {
                    "id": "claude-bedrock",
                    "type": "bedrock",
                    "cost_per_1k_tokens": 0.0,
                    "priority": 5,  # higher number = lower default precedence
                    "capabilities": ["text/medium", "graphify_semantic_backend"],
                    "models": ["bedrock-model-portfolio"],
                },
            ]
        }
        bedrock_models = {
            "models": [
                {
                    "id": "haiku-test",
                    "model_id": "us.anthropic.claude-3-5-haiku-20241022-v1:0",
                    "label": "Claude Haiku (test)",
                    "capabilities": ["text/medium"],
                    "enabled": True,
                    "quality_score": 0.7,
                    "priority": 10,
                    "region": "us-east-1",
                    "price_input_per_1m": 0.25,
                    "price_output_per_1m": 1.25,
                }
            ]
        }
        import core as _core  # noqa: F811
        _core.PROVIDERS_PATH.write_text(json.dumps(providers, indent=2))
        _core.BEDROCK_MODELS_PATH.write_text(json.dumps(bedrock_models, indent=2))

        selector = _core.ModelSelector()
        selector._check_health = lambda provider: True
        selector._provider_models["ollama-local"] = ["qwen2.5:14b"]
        # Make Bedrock model appear accessible without a real AWS probe
        selector._bedrock_access_status = lambda model: {"available": True, "checked_at": 0}

        # Without preferred_providers: ollama-local wins (priority 2 < 5)
        result_default = selector.select(
            "text_task",
            input_token_count=1000,
            urgent=True,
        )
        self.assertEqual(result_default.provider_id, "ollama-local",
                         "Without preferred_providers, lower priority number should win")

        # With preferred_providers listing claude-bedrock first: claude-bedrock must win
        # even though its global priority number is higher (lower default precedence).
        result_preferred = selector.select(
            "text_task",
            input_token_count=1000,
            urgent=True,
            task_metadata=_core.TaskMetadata(
                preferred_providers=["claude-bedrock", "ollama-local"],
            ),
        )
        self.assertEqual(result_preferred.provider_id, "claude-bedrock",
                         "claude-bedrock must be selected first when listed first in preferred_providers, "
                         "regardless of its higher global priority number")


if __name__ == "__main__":
    unittest.main()
