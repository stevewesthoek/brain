#!/usr/bin/env python3
"""Contract tests for the staged Bedrock provider identity migration."""
import sys
import unittest
from pathlib import Path

RUNTIME_DIR = Path(__file__).resolve().parents[1] / "runtime"
sys.path.insert(0, str(RUNTIME_DIR))

from provider_identity import (  # noqa: E402
    CANONICAL_BEDROCK_PROVIDER_ID,
    canonical_provider_id,
    canonical_provider_ids,
    canonicalize_provider_document,
    canonicalize_task_metadata,
)


class TestProviderIdentity(unittest.TestCase):
    def test_legacy_provider_alias_normalizes_to_transport_identity(self):
        self.assertEqual(canonical_provider_id("claude-bedrock"), CANONICAL_BEDROCK_PROVIDER_ID)
        self.assertEqual(canonical_provider_id(CANONICAL_BEDROCK_PROVIDER_ID), CANONICAL_BEDROCK_PROVIDER_ID)

    def test_provider_lists_are_normalized_without_reordering(self):
        self.assertEqual(
            canonical_provider_ids(["claude-bedrock", "codex-cli", "amazon-bedrock"]),
            ["amazon-bedrock", "codex-cli"],
        )

    def test_loaded_provider_and_task_metadata_use_canonical_ids(self):
        document = canonicalize_provider_document({"providers": [{"id": "claude-bedrock"}]})
        self.assertEqual(document["providers"][0]["id"], CANONICAL_BEDROCK_PROVIDER_ID)
        metadata = canonicalize_task_metadata({
            "allowed_providers": ["claude-bedrock"],
            "preferred_providers": ["claude-bedrock", "codex-cli"],
        })
        self.assertEqual(metadata["allowed_providers"], [CANONICAL_BEDROCK_PROVIDER_ID])
        self.assertEqual(metadata["preferred_providers"], [CANONICAL_BEDROCK_PROVIDER_ID, "codex-cli"])


if __name__ == "__main__":
    unittest.main()
