"""Read-only registry loading and legacy-vs-registry shadow comparison.

This module deliberately has no provider, network, subprocess, or selector
side effects. It gives the runtime an observable comparison report while the
legacy configuration remains the sole selection authority.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

LIFECYCLE_STATES = {
    "discovered",
    "evaluated",
    "admitted",
    "preferred",
    "deprecated",
    "retired",
}
SELECTABLE_LIFECYCLE_STATES = frozenset({"admitted", "preferred"})


class RegistryShadowValidationError(ValueError):
    """Raised when the registry cannot satisfy the shadow loader contract."""


def _sorted_unique(values: list[str]) -> list[str]:
    return sorted(set(values))


def _assert(condition: bool, message: str) -> None:
    if not condition:
        raise RegistryShadowValidationError(message)


def load_registry(path: Path) -> dict[str, Any]:
    """Load and validate only the structural assumptions needed for shadowing."""
    with path.open(encoding="utf-8") as handle:
        registry = json.load(handle)

    _assert(isinstance(registry, dict), "registry must be a JSON object")
    _assert(registry.get("registry_id") == "ai-model-registry", "unexpected registry_id")
    _assert(registry.get("registry_version") == 1, "unsupported registry_version")
    _assert(registry.get("source_provenance", {}).get("mode") == "parity-only", "registry must be parity-only")

    providers = registry.get("providers")
    models = registry.get("models")
    _assert(isinstance(providers, list), "registry.providers must be an array")
    _assert(isinstance(models, list), "registry.models must be an array")

    provider_ids = [provider.get("provider_id") for provider in providers]
    model_ids = [model.get("registry_model_id") for model in models]
    _assert(all(isinstance(value, str) and value for value in provider_ids), "every provider needs provider_id")
    _assert(all(isinstance(value, str) and value for value in model_ids), "every model needs registry_model_id")
    _assert(len(set(provider_ids)) == len(provider_ids), "registry contains duplicate provider IDs")
    _assert(len(set(model_ids)) == len(model_ids), "registry contains duplicate model IDs")

    provider_map = {provider["provider_id"]: provider for provider in providers}
    model_map = {model["registry_model_id"]: model for model in models}
    for provider in providers:
        for field_name in ("adapter_ref", "lifecycle_state", "access_state", "health_state", "model_refs"):
            _assert(field_name in provider, f"provider {provider['provider_id']} missing {field_name}")
        _assert(provider["lifecycle_state"] in LIFECYCLE_STATES, f"provider {provider['provider_id']} has invalid lifecycle_state")
        for model_id in provider["model_refs"]:
            _assert(model_id in model_map, f"provider {provider['provider_id']} references missing model {model_id}")
            _assert(model_map[model_id].get("provider_id") == provider["provider_id"], f"model/provider mismatch for {model_id}")

    for model in models:
        for field_name in ("provider_id", "provider_model_binding", "lifecycle_state", "compatibility_aliases"):
            _assert(field_name in model, f"model {model['registry_model_id']} missing {field_name}")
        _assert(model["provider_id"] in provider_map, f"model {model['registry_model_id']} references missing provider")
        _assert(model["lifecycle_state"] in LIFECYCLE_STATES, f"model {model['registry_model_id']} has invalid lifecycle_state")
        binding = model["provider_model_binding"]
        _assert(isinstance(binding, dict) and isinstance(binding.get("model_id"), str) and binding["model_id"], f"model {model['registry_model_id']} has invalid binding")

    return registry


def _legacy_model_candidates(providers: list[dict[str, Any]], bedrock_config: dict[str, Any]) -> dict[str, list[str]]:
    candidates: dict[str, list[str]] = {}
    for provider in providers:
        provider_id = provider["id"]
        if provider_id == "claude-bedrock":
            candidates[provider_id] = sorted(model["id"] for model in bedrock_config.get("models", []))
        else:
            candidates[provider_id] = sorted(str(model_id) for model_id in provider.get("models", []))
    return candidates


def _registry_model_candidates(registry: dict[str, Any]) -> dict[str, list[str]]:
    candidates: dict[str, list[str]] = {}
    for model in registry["models"]:
        provider_id = model["provider_id"]
        aliases = model.get("compatibility_aliases", [])
        source_aliases = [
            alias["value"]
            for alias in aliases
            if alias.get("source") == "ai-providers.json" and alias.get("kind") == "provider_model_label"
        ]
        if provider_id == "claude-bedrock":
            source_aliases = [
                alias["value"]
                for alias in aliases
                if alias.get("source") == "ai-bedrock-models.json" and alias.get("kind") == "registry_model_key"
            ]
        if not source_aliases:
            source_aliases = [model["provider_model_binding"]["model_id"]]
        candidates.setdefault(provider_id, []).extend(source_aliases)
    return {provider_id: _sorted_unique(values) for provider_id, values in candidates.items()}


def _legacy_lifecycle(providers: list[dict[str, Any]], bedrock_config: dict[str, Any]) -> dict[str, str]:
    lifecycle: dict[str, str] = {}
    provider_map = {provider["id"]: provider for provider in providers}
    for provider_id, provider in provider_map.items():
        if provider_id != "claude-bedrock":
            for model_id in provider.get("models", []):
                lifecycle[f"{provider_id}/{model_id}"] = "admitted"
    for model in bedrock_config.get("models", []):
        state = "admitted" if model.get("enabled", True) else "evaluated" if model.get("upgrade_candidate") else "retired"
        lifecycle[f"claude-bedrock/{model['id']}"] = state
    return lifecycle


def _registry_lifecycle(registry: dict[str, Any]) -> dict[str, str]:
    return {model["registry_model_id"]: model["lifecycle_state"] for model in registry["models"]}


def registry_model_lifecycle(report: dict[str, Any], provider_id: str, model_id: str) -> str | None:
    """Return the registry lifecycle for a legacy provider/model identity."""
    return report.get("registry_lifecycle", {}).get(f"{provider_id}/{model_id}")


def registry_model_selectable(report: dict[str, Any], provider_id: str, model_id: str) -> bool:
    """Apply lifecycle admission without making the registry a candidate source.

    A missing registry is a rollout compatibility state: legacy-enabled models
    remain usable until the registry is installed. Once a registry is present,
    a known model must be explicitly admitted or preferred. Unknown models are
    rejected when the registry is present so discovery cannot become admission.
    """
    lifecycle = registry_model_lifecycle(report, provider_id, model_id)
    if lifecycle is None:
        return report.get("status") == "unavailable"
    return lifecycle in SELECTABLE_LIFECYCLE_STATES


def compare_legacy_to_registry(
    providers: list[dict[str, Any]],
    bedrock_config: dict[str, Any],
    registry: dict[str, Any],
    *,
    registry_path: str = "",
) -> dict[str, Any]:
    """Compare candidate identity and lifecycle without affecting selection."""
    legacy_providers = sorted(provider["id"] for provider in providers)
    registry_providers = sorted(provider["provider_id"] for provider in registry["providers"])
    legacy_models = _legacy_model_candidates(providers, bedrock_config)
    registry_models = _registry_model_candidates(registry)
    all_provider_ids = sorted(set(legacy_providers) | set(registry_providers))

    matching_providers = sorted(set(legacy_providers) & set(registry_providers))
    missing_providers = sorted(set(legacy_providers) - set(registry_providers))
    unexpected_providers = sorted(set(registry_providers) - set(legacy_providers))
    matching_models: list[dict[str, str]] = []
    missing_models: list[dict[str, str]] = []
    unexpected_models: list[dict[str, str]] = []
    for provider_id in all_provider_ids:
        legacy_set = set(legacy_models.get(provider_id, []))
        registry_set = set(registry_models.get(provider_id, []))
        for model_id in sorted(legacy_set & registry_set):
            matching_models.append({"provider_id": provider_id, "model_id": model_id})
        for model_id in sorted(legacy_set - registry_set):
            missing_models.append({"provider_id": provider_id, "model_id": model_id})
        for model_id in sorted(registry_set - legacy_set):
            unexpected_models.append({"provider_id": provider_id, "model_id": model_id})

    legacy_lifecycle = _legacy_lifecycle(providers, bedrock_config)
    registry_lifecycle = _registry_lifecycle(registry)
    lifecycle_differences: list[dict[str, str]] = []
    for model_id in sorted(set(legacy_lifecycle) | set(registry_lifecycle)):
        legacy_state = legacy_lifecycle.get(model_id)
        registry_state = registry_lifecycle.get(model_id)
        if legacy_state != registry_state:
            lifecycle_differences.append({"registry_model_id": model_id, "legacy_state": legacy_state or "missing", "registry_state": registry_state or "missing"})

    missing_metadata: list[dict[str, str]] = []
    for model in registry["models"]:
        for field_name in ("capabilities", "profile_compatibility", "health_state", "access_state", "evaluation_evidence", "safety_constraints", "last_verified_at"):
            if field_name not in model:
                missing_metadata.append({"registry_model_id": model["registry_model_id"], "field": field_name})

    status = "match" if not (missing_providers or unexpected_providers or missing_models or unexpected_models or lifecycle_differences or missing_metadata) else "mismatch"
    selectable_registry_models = sorted(
        model["registry_model_id"]
        for model in registry["models"]
        if model["lifecycle_state"] in {"admitted", "preferred"}
    )
    return {
        "mode": "shadow",
        "status": status,
        "selection_authority": "legacy",
        "registry_path": registry_path,
        "matching_providers": matching_providers,
        "missing_providers": missing_providers,
        "unexpected_providers": unexpected_providers,
        "matching_models": matching_models,
        "missing_models": missing_models,
        "unexpected_models": unexpected_models,
        "lifecycle_differences": lifecycle_differences,
        "missing_metadata": missing_metadata,
        "legacy_candidates": {"providers": legacy_providers, "models": legacy_models},
        "registry_candidates": {"providers": registry_providers, "models": registry_models},
        "registry_lifecycle": registry_lifecycle,
        "registry_selectable_models": selectable_registry_models,
        "selection_affected": False,
    }


def unavailable_report(registry_path: str, reason: str) -> dict[str, Any]:
    """Return a visible but non-blocking report when shadow input is absent/invalid."""
    return {
        "mode": "shadow",
        "status": "unavailable",
        "selection_authority": "legacy",
        "registry_path": registry_path,
        "reason": reason,
        "registry_lifecycle": {},
        "selection_affected": False,
    }


def load_and_compare(
    registry_path: Path,
    providers: list[dict[str, Any]],
    bedrock_config: dict[str, Any],
) -> dict[str, Any]:
    """Load a registry and return a non-blocking comparison report."""
    try:
        registry = load_registry(registry_path)
        return compare_legacy_to_registry(providers, bedrock_config, registry, registry_path=str(registry_path))
    except FileNotFoundError:
        return unavailable_report(str(registry_path), "registry_not_found")
    except (OSError, json.JSONDecodeError, RegistryShadowValidationError, KeyError, TypeError, AttributeError) as error:
        return unavailable_report(str(registry_path), f"registry_invalid:{error}")
