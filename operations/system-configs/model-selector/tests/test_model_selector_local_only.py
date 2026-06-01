#!/usr/bin/env python3
"""Tests for local-only provider filtering."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"
sys.path.insert(0, str(RUNTIME_DIR))

import core  # noqa: E402


class TestLocalOnlySelection(unittest.TestCase):
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
                "mind_capture_classification": {
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

    def test_local_only_excludes_cli_and_bedrock(self):
        selector = core.ModelSelector()
        selector._check_health = lambda provider: provider["id"] == "ollama-local"
        selector._provider_models["ollama-local"] = ["qwen2.5:14b"]

        result = selector.select(
            "mind_capture_classification",
            input_token_count=1000,
            urgent=True,
            task_metadata=core.TaskMetadata(
                offline=True,
                external_provider_disallowed=True,
            ),
        )

        self.assertEqual(result.provider_id, "ollama-local")
        self.assertEqual(result.model, "qwen2.5:14b")


if __name__ == "__main__":
    unittest.main()
