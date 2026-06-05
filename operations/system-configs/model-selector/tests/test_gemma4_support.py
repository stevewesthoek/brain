#!/usr/bin/env python3
"""Tests for Gemma 4 model support in the AI Model Selector."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"
sys.path.insert(0, str(RUNTIME_DIR))

import core  # noqa: E402


class TestGemma4Support(unittest.TestCase):
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
                    "id": "ollama-m4pro",
                    "label": "Mac Mini M4 Pro (local)",
                    "type": "openai-compatible",
                    "base_url": "http://localhost:11434/v1",
                    "cost_per_1k_tokens": 0.0,
                    "priority": 2,
                    "capabilities": ["text/small", "text/medium", "text/large"],
                    "preferred_models": ["qwen2.5:14b", "qwen2.5:32b", "llama3.1:8b", "gemma4:12b", "gemma4:e4b"],
                    "health_check": {"endpoint": "http://localhost:11434/api/tags"},
                },
                {
                    "id": "ollama-m1",
                    "label": "MacBook M1 (Thunderbolt node)",
                    "type": "openai-compatible",
                    "base_url": "http://192.168.2.2:11434/v1",
                    "cost_per_1k_tokens": 0.0,
                    "priority": 3,
                    "capabilities": ["text/small", "text/medium"],
                    "preferred_models": ["qwen2.5:14b", "llama3.1:8b", "llama3.2:3b", "gemma4:e4b", "gemma4:12b"],
                    "health_check": {"endpoint": "http://192.168.2.2:11434/api/tags"},
                },
            ]
        }
        task_types = {
            "task_types": {
                "metadata_generation": {
                    "capability": "text/medium",
                    "typical_input_tokens": 8000,
                    "typical_output_tokens": 2000,
                    "latency_tolerance": "minutes",
                    "local_viable": True,
                    "min_local_model_params": "7B",
                    "preferred_local_models": ["qwen2.5:14b", "gemma4:12b", "gemma4:e4b"],
                },
                "thumbnail_headline": {
                    "capability": "text/small",
                    "typical_input_tokens": 500,
                    "typical_output_tokens": 20,
                    "latency_tolerance": "seconds",
                    "local_viable": True,
                    "min_local_model_params": "7B",
                    "preferred_local_models": ["llama3.1:8b", "gemma4:e4b", "llama3.2:3b"],
                },
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

    def test_model_size_b_gemma4_e4b(self):
        """Test that _model_size_b correctly parses gemma4:e4b as 4B."""
        selector = core.ModelSelector()
        self.assertEqual(selector._model_size_b("gemma4:e4b"), 4.0)

    def test_model_size_b_gemma4_12b(self):
        """Test that _model_size_b correctly parses gemma4:12b as 12B."""
        selector = core.ModelSelector()
        self.assertEqual(selector._model_size_b("gemma4:12b"), 12.0)

    def test_model_size_b_gemma4_26b(self):
        """Test that _model_size_b correctly parses gemma4:26b as 26B."""
        selector = core.ModelSelector()
        self.assertEqual(selector._model_size_b("gemma4:26b"), 26.0)

    def test_model_size_b_gemma4_31b(self):
        """Test that _model_size_b correctly parses gemma4:31b as 31B."""
        selector = core.ModelSelector()
        self.assertEqual(selector._model_size_b("gemma4:31b"), 31.0)

    def test_model_size_b_qwen2_5_14b(self):
        """Test that _model_size_b still works for qwen2.5:14b."""
        selector = core.ModelSelector()
        self.assertEqual(selector._model_size_b("qwen2.5:14b"), 14.0)

    def test_model_size_b_llama3_1_8b(self):
        """Test that _model_size_b still works for llama3.1:8b."""
        selector = core.ModelSelector()
        self.assertEqual(selector._model_size_b("llama3.1:8b"), 8.0)

    def test_model_meets_min_params_gemma4_e4b_for_7b_task(self):
        """Test that gemma4:e4b (4B) is rejected for 7B minimum tasks."""
        selector = core.ModelSelector()
        task_spec = {"min_local_model_params": "7B"}
        self.assertFalse(selector._model_meets_min_params("gemma4:e4b", task_spec))

    def test_model_meets_min_params_gemma4_12b_for_7b_task(self):
        """Test that gemma4:12b (12B) is accepted for 7B minimum tasks."""
        selector = core.ModelSelector()
        task_spec = {"min_local_model_params": "7B"}
        self.assertTrue(selector._model_meets_min_params("gemma4:12b", task_spec))

    def test_model_meets_min_params_gemma4_26b_for_14b_task(self):
        """Test that gemma4:26b (26B) is accepted for 14B minimum tasks."""
        selector = core.ModelSelector()
        task_spec = {"min_local_model_params": "14B"}
        self.assertTrue(selector._model_meets_min_params("gemma4:26b", task_spec))

    def test_model_meets_min_params_gemma4_12b_for_14b_task(self):
        """Test that gemma4:12b (12B) is rejected for 14B minimum tasks."""
        selector = core.ModelSelector()
        task_spec = {"min_local_model_params": "14B"}
        self.assertFalse(selector._model_meets_min_params("gemma4:12b", task_spec))

    def test_provider_config_includes_gemma4_m4pro(self):
        """Test that M4 Pro provider config includes Gemma 4 models."""
        selector = core.ModelSelector()
        m4pro = next((p for p in selector._providers if p["id"] == "ollama-m4pro"), None)
        self.assertIsNotNone(m4pro)
        self.assertIn("gemma4:12b", m4pro["preferred_models"])
        self.assertIn("gemma4:e4b", m4pro["preferred_models"])

    def test_provider_config_includes_gemma4_m1(self):
        """Test that M1 provider config includes Gemma 4 models."""
        selector = core.ModelSelector()
        m1 = next((p for p in selector._providers if p["id"] == "ollama-m1"), None)
        self.assertIsNotNone(m1)
        self.assertIn("gemma4:e4b", m1["preferred_models"])
        self.assertIn("gemma4:12b", m1["preferred_models"])

    def test_task_preferred_local_models_metadata_generation(self):
        """Test that metadata_generation task includes Gemma 4 in preferred_local_models."""
        selector = core.ModelSelector()
        task = selector._task_types.get("metadata_generation")
        self.assertIsNotNone(task)
        preferred = task.get("preferred_local_models", [])
        self.assertIn("gemma4:12b", preferred)
        self.assertIn("gemma4:e4b", preferred)

    def test_task_preferred_local_models_thumbnail_headline(self):
        """Test that thumbnail_headline task includes Gemma 4 in preferred_local_models."""
        selector = core.ModelSelector()
        task = selector._task_types.get("thumbnail_headline")
        self.assertIsNotNone(task)
        preferred = task.get("preferred_local_models", [])
        self.assertIn("gemma4:e4b", preferred)


if __name__ == "__main__":
    unittest.main()
