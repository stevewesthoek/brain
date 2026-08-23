#!/usr/bin/env python3
"""Tests for MRU0-P2.2 registry shadow loading and comparison."""
import json
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"
REPO_ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(RUNTIME_DIR))

import core  # noqa: E402
from registry_shadow import compare_legacy_to_registry, load_registry  # noqa: E402


class TestModelRegistryShadow(unittest.TestCase):
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
        self._copy_source_configs()

    def tearDown(self):
        for name, value in self.old_paths.items():
            setattr(core, name, value)
        self.tmp.cleanup()

    def _copy_source_configs(self):
        source_dir = REPO_ROOT / "operations/system-configs/model-selector/config"
        for name in (
            "ai-providers.json",
            "ai-task-types.json",
            "ai-selector-config.json",
            "ai-bedrock-models.json",
            "ai-model-registry.json",
        ):
            shutil.copyfile(source_dir / name, self.config_dir / name)

    def _new_selector(self, registry_path):
        core.REGISTRY_PATH = registry_path
        selector = core.ModelSelector()
        selector._check_health = lambda _provider: True
        selector._bedrock_access_status = lambda _model: {"available": True, "checked_at": 1}
        return selector

    def test_shadow_report_matches_legacy_candidate_sets(self):
        selector = self._new_selector(core.REGISTRY_PATH)
        report = selector.registry_shadow_report()

        self.assertEqual(report["status"], "match")
        self.assertEqual(report["selection_authority"], "legacy")
        self.assertFalse(report["selection_affected"])
        self.assertEqual(report["matching_providers"], ["claude-bedrock", "codex-cli", "whisper-m1", "whisper-m4pro"])
        self.assertEqual(len(report["matching_models"]), 16)
        self.assertEqual(report["missing_models"], [])
        self.assertEqual(report["unexpected_models"], [])

    def test_shadow_mismatch_is_visible_without_rejecting_legacy_config(self):
        providers = json.loads((self.config_dir / "ai-providers.json").read_text())["providers"]
        bedrock = json.loads((self.config_dir / "ai-bedrock-models.json").read_text())
        registry = load_registry(core.REGISTRY_PATH)
        registry["models"] = [model for model in registry["models"] if model["registry_model_id"] != "claude-bedrock/claude-opus-4-7"]

        report = compare_legacy_to_registry(providers, bedrock, registry, registry_path="fixture")

        self.assertEqual(report["status"], "mismatch")
        self.assertIn(
            {"provider_id": "claude-bedrock", "model_id": "claude-opus-4-7"},
            report["missing_models"],
        )
        self.assertFalse(report["selection_affected"])

    def test_shadow_mode_does_not_change_legacy_selection(self):
        with_registry = self._new_selector(core.REGISTRY_PATH)
        with_registry_result = with_registry.select("metadata_generation", input_token_count=1000, urgent=True)

        without_registry_path = self.config_dir / "missing-ai-model-registry.json"
        without_registry = self._new_selector(without_registry_path)
        without_registry_result = without_registry.select("metadata_generation", input_token_count=1000, urgent=True)

        self.assertEqual(with_registry_result.provider_id, without_registry_result.provider_id)
        self.assertEqual(with_registry_result.model, without_registry_result.model)
        self.assertEqual(with_registry_result.cost_estimate, without_registry_result.cost_estimate)
        self.assertEqual(without_registry.registry_shadow_report()["status"], "unavailable")

    def test_evaluated_only_models_are_excluded_from_registry_selectable_view(self):
        selector = self._new_selector(core.REGISTRY_PATH)
        report = selector.registry_shadow_report()

        self.assertNotIn("claude-bedrock/claude-opus-4-7", report["registry_selectable_models"])
        self.assertIn("claude-bedrock/claude-opus-4-6", report["registry_selectable_models"])

    def test_private_mind_constraints_remain_unchanged(self):
        tasks = json.loads((self.config_dir / "ai-task-types.json").read_text())["task_types"]
        for task_id in (
            "mind_capture_classification",
            "mind_project_decomposition",
            "mind_maintenance_semantic_comparison",
        ):
            self.assertEqual(tasks[task_id]["privacy_policy"], "private-bedrock-only")
            self.assertEqual(tasks[task_id]["required_provider"], "claude-bedrock")
            self.assertEqual(tasks[task_id]["preferred_model"], "us.anthropic.claude-sonnet-4-6")
            self.assertIn("fail closed", tasks[task_id]["notes"].lower())


if __name__ == "__main__":
    unittest.main()
