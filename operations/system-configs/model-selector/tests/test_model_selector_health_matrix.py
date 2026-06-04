#!/usr/bin/env python3
"""Tests for the AI Model Selector health matrix contract."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"
sys.path.insert(0, str(RUNTIME_DIR))

import core  # noqa: E402


class TestHealthMatrix(unittest.TestCase):
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
                    "id": "ollama-local",
                    "label": "Local Ollama",
                    "type": "openai-compatible",
                    "base_url": "http://127.0.0.1:11434/v1",
                    "cost_per_1k_tokens": 0.0,
                    "priority": 1,
                    "capabilities": ["text/medium"],
                    "preferred_models": ["qwen2.5:14b"],
                    "health_check": {"endpoint": "http://127.0.0.1:11434/api/tags"},
                },
                {
                    "id": "claude-bedrock",
                    "label": "Amazon Bedrock model portfolio",
                    "type": "bedrock",
                    "cost_per_1k_tokens": 0.0,
                    "priority": 2,
                    "capabilities": ["text/medium"],
                    "models": ["bedrock-model-portfolio"],
                },
            ]
        }
        task_types = {
            "task_types": {
                "semantic_graph": {
                    "capability": "text/medium",
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
                    "id": "qwen3-coder-next",
                    "label": "Qwen3 Coder Next",
                    "model_id": "qwen.qwen3-coder-next",
                    "region": "us-east-1",
                    "enabled": True,
                    "capabilities": ["text/medium"],
                    "roles": ["coding"],
                    "price_input_per_1m": 0.5,
                    "price_output_per_1m": 1.2,
                }
            ],
        }
        access = {
            "us-east-1:qwen.qwen3-coder-next": {
                "available": True,
                "checked_at": 123.0,
                "region": "us-east-1",
                "model_id": "qwen.qwen3-coder-next",
            }
        }
        core.PROVIDERS_PATH.write_text(json.dumps(providers, indent=2))
        core.TASK_TYPES_PATH.write_text(json.dumps(task_types, indent=2))
        core.SELECTOR_CONFIG_PATH.write_text(json.dumps(selector_config, indent=2))
        core.BEDROCK_MODELS_PATH.write_text(json.dumps(bedrock_models, indent=2))
        core.BEDROCK_ACCESS_PATH.write_text(json.dumps(access, indent=2))

    def test_health_matrix_is_canonical_consumer_contract(self):
        selector = core.ModelSelector()
        selector._check_health = lambda provider: True
        selector._provider_models["ollama-local"] = ["qwen2.5:14b"]

        matrix = selector.health_matrix()

        self.assertEqual(matrix["id"], "ai-model-selector-health-matrix")
        self.assertEqual(matrix["probe_mode"], "cached")
        self.assertEqual(matrix["policy"]["selection_endpoint"], "POST /select")
        self.assertEqual(matrix["policy"]["consumer_provider_probes_allowed"], False)
        self.assertEqual(matrix["selector"]["provider_count"], 2)
        self.assertGreaterEqual(matrix["selector"]["selectable_model_count"], 2)

        model_ids = {entry["model_id"] for entry in matrix["models"]}
        self.assertIn("qwen2.5:14b", model_ids)
        self.assertIn("qwen.qwen3-coder-next", model_ids)


if __name__ == "__main__":
    unittest.main()
