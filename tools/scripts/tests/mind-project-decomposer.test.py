#!/usr/bin/env python3
import subprocess
import sys
import unittest
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SCRIPT = REPO_ROOT / "tools" / "scripts" / "mind-project-decomposer.py"


class MindProjectDecomposerRetirementTests(unittest.TestCase):
    def test_retired_entrypoint_exits_cleanly_without_reactivation(self):
        proc = subprocess.run(
            [sys.executable, str(SCRIPT)],
            cwd=REPO_ROOT,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        self.assertEqual(proc.returncode, 0)
        self.assertIn("RETIRED: mind-project-decomposer.py is retired as of 2026-07-31", proc.stdout)
        self.assertNotIn("aws", proc.stdout.lower())
        self.assertNotIn("ollama", proc.stdout.lower())
        self.assertEqual(proc.stderr, "")

    def test_retired_source_contains_no_network_or_model_execution_dependencies(self):
        source = SCRIPT.read_text(encoding="utf-8")
        for forbidden in [
            "requests.post",
            "subprocess.run(",
            "bedrock-runtime",
            "ollama",
            "AI_SELECTOR_URL",
            "GITHUB_TOKEN",
        ]:
            self.assertNotIn(forbidden, source)


if __name__ == "__main__":
    unittest.main(verbosity=2)
