#!/usr/bin/env python3
"""Focused tests for the additive selector outcome/request contract."""
import json
import sys
import tempfile
import unittest
from pathlib import Path

RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"
sys.path.insert(0, str(RUNTIME_DIR))

import core  # noqa: E402
from selector_service import (  # noqa: E402
    normalize_select_request,
    serialize_rejected,
    serialize_selection_result,
)


class TestModelSelectorContract(unittest.TestCase):
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

        providers = {
            "providers": [{
                "id": "codex-cli",
                "type": "cli",
                "cost_per_1k_tokens": 0.0,
                "priority": 1,
                "capabilities": ["text/small"],
                "models": ["gpt-test"],
            }]
        }
        task_types = {
            "task_types": {
                "selected_task": {"capability": "text/small"},
                "blocked_task": {"capability": "text/large"},
            }
        }
        selector_config = {"prefer_defer_over_paid": True}
        core.PROVIDERS_PATH.write_text(json.dumps(providers), encoding="utf-8")
        core.TASK_TYPES_PATH.write_text(json.dumps(task_types), encoding="utf-8")
        core.SELECTOR_CONFIG_PATH.write_text(json.dumps(selector_config), encoding="utf-8")
        core.BEDROCK_MODELS_PATH.write_text(json.dumps({"models": []}), encoding="utf-8")

    def tearDown(self):
        for name, value in self.old_paths.items():
            setattr(core, name, value)
        self.tmp.cleanup()

    def _selector(self):
        selector = core.ModelSelector()
        selector._check_health = lambda _provider: True
        return selector

    def test_selected_outcome_preserves_selected_fields(self):
        result = self._selector().select("selected_task", urgent=True)
        self.assertEqual(result.outcome, "selected")
        self.assertEqual(result.provider_id, "codex-cli")
        self.assertEqual(result.model, "gpt-test")
        self.assertEqual(serialize_selection_result(result)["outcome"], "selected")

    def test_deferred_outcome_is_explicit(self):
        result = self._selector().select("blocked_task", urgent=False)
        self.assertEqual(result.outcome, "deferred")
        self.assertTrue(result.deferred)
        self.assertTrue(serialize_selection_result(result)["deferred"])

    def test_unavailable_outcome_remains_fail_closed(self):
        with self.assertRaises(core.NoProviderAvailable) as raised:
            self._selector().select("blocked_task", urgent=True)
        self.assertEqual(raised.exception.outcome, "unavailable")

    def test_rejected_outcome_is_used_for_invalid_task_type(self):
        with self.assertRaises(ValueError):
            self._selector().select("unknown_task", urgent=True)
        self.assertEqual(serialize_rejected("unknown task", "unknown_task")["outcome"], "rejected")

    def test_selector_request_requires_canonical_task_type(self):
        normalized = normalize_select_request({"task_type": "selected_task"})
        self.assertEqual(normalized["task_type"], "selected_task")

    def test_selector_request_rejects_malformed_legacy_fields(self):
        with self.assertRaisesRegex(ValueError, "task_type is required"):
            normalize_select_request({"task": "free form task"})
        with self.assertRaisesRegex(ValueError, "array of strings"):
            normalize_select_request({
                "task_type": "selected_task",
                "task_metadata": {"allowed_providers": "codex-cli"},
            })


if __name__ == "__main__":
    unittest.main()
