#!/usr/bin/env python3
"""Tests for MRU0-P2.3 lifecycle admission enforcement."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"
REPO_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RUNTIME_DIR))

import core  # noqa: E402


class TestModelRegistryLifecycle(unittest.TestCase):
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
            name: getattr(core, name)
            for name in (
                "CONFIG_DIR",
                "STATE_DIR",
                "LOG_DIR",
                "PROVIDERS_PATH",
                "TASK_TYPES_PATH",
                "SELECTOR_CONFIG_PATH",
                "BEDROCK_MODELS_PATH",
                "REGISTRY_PATH",
                "RATE_LIMITS_PATH",
                "CB_STATE_PATH",
                "BEDROCK_ACCESS_PATH",
                "BEDROCK_OUTCOMES_PATH",
                "AUDIT_LOG_PATH",
            )
        }
        core.CONFIG_DIR = self.config_dir
        core.STATE_DIR = self.state_dir
        core.LOG_DIR = self.log_dir
        core.PROVIDERS_PATH = self.config_dir / "ai-providers.json"
        core.TASK_TYPES_PATH = self.config_dir / "ai-task-types.json"
        core.SELECTOR_CONFIG_PATH = self.config_dir / "ai-selector-config.json"
        core.BEDROCK_MODELS_PATH = self.config_dir / "ai-bedrock-models.json"
        core.REGISTRY_PATH = self.config_dir / "ai-model-registry.json"
        core.RATE_LIMITS_PATH = self.state_dir / "rate-limits.json"
        core.CB_STATE_PATH = self.state_dir / "circuit-breakers.json"
        core.BEDROCK_ACCESS_PATH = self.state_dir / "bedrock-model-access.json"
        core.BEDROCK_OUTCOMES_PATH = self.state_dir / "bedrock-model-outcomes.json"
        core.AUDIT_LOG_PATH = self.log_dir / "ai-selections.jsonl"

    def tearDown(self):
        for name, value in self.old_paths.items():
            setattr(core, name, value)
        self.tmp.cleanup()

    def _write_config(self, lifecycle_state="admitted", enabled=True, upgrade_candidate=False):
        providers = {
            "providers": [
                {
                    "id": "claude-bedrock",
                    "label": "Amazon Bedrock model portfolio",
                    "type": "bedrock",
                    "cost_per_1k_tokens": 0.0,
                    "priority": 1,
                    "capabilities": ["text/review"],
                    "models": ["bedrock-model-portfolio"],
                }
            ]
        }
        task_types = {
            "task_types": {
                "orchestration": {
                    "capability": "text/review",
                    "typical_input_tokens": 2000,
                    "typical_output_tokens": 1000,
                }
            }
        }
        selector_config = {
            "batch_window": {"start_hour": 1, "end_hour": 7},
            "prefer_defer_over_paid": False,
        }
        bedrock_models = {
            "default_region": "us-east-1",
            "models": [
                {
                    "id": "claude-opus-4-6",
                    "model_id": "us.anthropic.claude-opus-4-6-v1",
                    "region": "us-east-1",
                    "enabled": enabled,
                    "upgrade_candidate": upgrade_candidate,
                    "priority": 95,
                    "capabilities": ["text/review"],
                    "price_input_per_1m": 15.0,
                    "price_output_per_1m": 75.0,
                    "quality_score": 0.95,
                    "task_affinity": {"orchestration": 1.18},
                }
            ],
        }
        source_registry = json.loads(
            (REPO_ROOT / "operations/system-configs/model-selector/config/ai-model-registry.json").read_text()
        )
        provider = next(item for item in source_registry["providers"] if item["provider_id"] == "claude-bedrock")
        model = next(item for item in source_registry["models"] if item["registry_model_id"] == "claude-bedrock/claude-opus-4-6")
        provider["model_refs"] = [model["registry_model_id"]]
        model["lifecycle_state"] = lifecycle_state
        source_registry["providers"] = [provider]
        source_registry["models"] = [model]

        self.config_dir.joinpath("ai-providers.json").write_text(json.dumps(providers, indent=2))
        self.config_dir.joinpath("ai-task-types.json").write_text(json.dumps(task_types, indent=2))
        self.config_dir.joinpath("ai-selector-config.json").write_text(json.dumps(selector_config, indent=2))
        self.config_dir.joinpath("ai-bedrock-models.json").write_text(json.dumps(bedrock_models, indent=2))
        self.config_dir.joinpath("ai-model-registry.json").write_text(json.dumps(source_registry, indent=2))

    def _selector(self):
        selector = core.ModelSelector()
        selector._bedrock_access_status = lambda _model: {"available": True, "checked_at": 1}
        return selector

    def test_only_admitted_and_preferred_models_are_selectable(self):
        for lifecycle_state in ("admitted", "preferred", "discovered", "evaluated", "deprecated", "retired"):
            with self.subTest(lifecycle_state=lifecycle_state):
                self._write_config(lifecycle_state=lifecycle_state)
                selector = self._selector()
                if lifecycle_state in {"admitted", "preferred"}:
                    result = selector.select("orchestration", input_token_count=1000, urgent=True)
                    self.assertEqual(result.model, "us.anthropic.claude-opus-4-6-v1")
                else:
                    with self.assertRaises(core.NoProviderAvailable):
                        selector.select("orchestration", input_token_count=1000, urgent=True)

    def test_upgrade_candidate_and_access_do_not_grant_admission(self):
        self._write_config(lifecycle_state="evaluated", enabled=False, upgrade_candidate=True)
        selector = self._selector()

        with self.assertRaises(core.NoProviderAvailable):
            selector.select("orchestration", input_token_count=1000, urgent=True)

    def test_health_matrix_does_not_advertise_evaluated_model_as_selectable(self):
        self._write_config(lifecycle_state="evaluated")
        selector = self._selector()

        entry = selector._bedrock_matrix_status(selector._bedrock_models[0], run_probe=True)

        self.assertEqual(entry["lifecycle_state"], "evaluated")
        self.assertFalse(entry["selectable"])


if __name__ == "__main__":
    unittest.main()
