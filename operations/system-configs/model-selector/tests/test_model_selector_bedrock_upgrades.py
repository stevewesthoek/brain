#!/usr/bin/env python3
"""Tests for Bedrock premium fallback and upgrade-candidate routing."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"
sys.path.insert(0, str(RUNTIME_DIR))

import core  # noqa: E402


class TestBedrockUpgradeCandidates(unittest.TestCase):
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
            "GEMINI_QUOTA_PATH": core.GEMINI_QUOTA_PATH,
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
        self._write_config()

    def tearDown(self):
        for name, value in self.old_paths.items():
            setattr(core, name, value)
        self.tmp.cleanup()

    def _write_config(self):
        providers = {
            "providers": [
                {
                    "id": "claude-bedrock",
                    "label": "Amazon Bedrock model portfolio",
                    "type": "bedrock",
                    "cost_per_1k_tokens": 0.0,
                    "priority": 1,
                    "capabilities": ["text/large", "text/review"],
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
            "access_probe_ttl_hours": 24,
            "models": [
                {
                    "id": "claude-opus-4-6",
                    "model_id": "us.anthropic.claude-opus-4-6-v1",
                    "region": "us-east-1",
                    "enabled": True,
                    "priority": 95,
                    "capabilities": ["text/review"],
                    "price_input_per_1m": 15.0,
                    "price_output_per_1m": 75.0,
                    "quality_score": 0.95,
                    "task_affinity": {"orchestration": 1.18},
                },
                {
                    "id": "claude-opus-4-7",
                    "model_id": "us.anthropic.claude-opus-4-7",
                    "region": "us-east-1",
                    "enabled": False,
                    "upgrade_candidate": True,
                    "access_probe_ttl_hours": 48,
                    "priority": 100,
                    "capabilities": ["text/review"],
                    "price_input_per_1m": 15.0,
                    "price_output_per_1m": 75.0,
                    "quality_score": 0.96,
                    "task_affinity": {"orchestration": 1.2},
                },
            ],
        }
        core.PROVIDERS_PATH.write_text(json.dumps(providers, indent=2))
        core.TASK_TYPES_PATH.write_text(json.dumps(task_types, indent=2))
        core.SELECTOR_CONFIG_PATH.write_text(json.dumps(selector_config, indent=2))
        core.BEDROCK_MODELS_PATH.write_text(json.dumps(bedrock_models, indent=2))

    def test_opus_46_selected_when_47_upgrade_candidate_unavailable(self):
        selector = core.ModelSelector()

        def access(model):
            return {"available": model["id"] == "claude-opus-4-6", "checked_at": 1}

        selector._bedrock_access_status = access

        result = selector.select("orchestration", input_token_count=1000, urgent=True)

        self.assertEqual(result.model, "us.anthropic.claude-opus-4-6-v1")

    def test_opus_47_upgrade_candidate_selected_when_access_available(self):
        selector = core.ModelSelector()
        selector._bedrock_access_status = lambda model: {"available": True, "checked_at": 1}

        result = selector.select("orchestration", input_token_count=1000, urgent=True)

        self.assertEqual(result.model, "us.anthropic.claude-opus-4-7")


if __name__ == "__main__":
    unittest.main()
