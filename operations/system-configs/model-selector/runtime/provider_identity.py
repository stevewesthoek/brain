"""Canonical provider identities and staged compatibility aliases.

Provider identity names the transport, not the model vendor.  Callers may
still send the retired ``claude-bedrock`` spelling during migration, but all
loaded configuration, selector output, state keys, and policy comparisons use
the canonical ``amazon-bedrock`` identity.
"""
from __future__ import annotations

from copy import deepcopy
from typing import Any

CANONICAL_BEDROCK_PROVIDER_ID = "amazon-bedrock"
LEGACY_PROVIDER_ALIASES = {"claude-bedrock": CANONICAL_BEDROCK_PROVIDER_ID}


def canonical_provider_id(provider_id: str) -> str:
    """Return the canonical transport identity for a provider reference."""
    return LEGACY_PROVIDER_ALIASES.get(provider_id, provider_id)


def canonical_provider_ids(provider_ids: list[str]) -> list[str]:
    """Normalize provider lists while retaining declaration order."""
    return list(dict.fromkeys(canonical_provider_id(provider_id) for provider_id in provider_ids))


def canonicalize_provider_document(document: dict[str, Any]) -> dict[str, Any]:
    """Normalize provider IDs in a loaded JSON document without mutating it."""
    normalized = deepcopy(document)
    providers = normalized.get("providers", [])
    for provider in providers:
        if isinstance(provider, dict) and isinstance(provider.get("id"), str):
            provider["id"] = canonical_provider_id(provider["id"])
    return normalized


def canonicalize_task_metadata(metadata: dict[str, Any]) -> dict[str, Any]:
    """Normalize provider references in selector request metadata."""
    normalized = dict(metadata)
    for field_name in ("preferred_providers", "allowed_providers", "disallowed_providers"):
        values = normalized.get(field_name)
        if isinstance(values, list):
            normalized[field_name] = canonical_provider_ids(values)
    return normalized
