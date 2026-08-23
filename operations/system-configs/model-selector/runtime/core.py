#!/usr/bin/env python3
"""
AI Model Selector — core selection algorithm.
Importable directly by VO worker or called via HTTP service.
"""
from __future__ import annotations

import json
import logging
import os
import random
import re
import shutil
import subprocess
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from registry_shadow import load_and_compare, registry_model_lifecycle, registry_model_selectable

log = logging.getLogger(__name__)

CONFIG_DIR = Path.home() / ".config/video-orchestrator"
STATE_DIR = Path.home() / ".local/video-orchestrator/state"
LOG_DIR = Path.home() / ".local/video-orchestrator/logs"

PROVIDERS_PATH = CONFIG_DIR / "ai-providers.json"
TASK_TYPES_PATH = CONFIG_DIR / "ai-task-types.json"
SELECTOR_CONFIG_PATH = CONFIG_DIR / "ai-selector-config.json"
BEDROCK_MODELS_PATH = CONFIG_DIR / "ai-bedrock-models.json"
REGISTRY_PATH = CONFIG_DIR / "ai-model-registry.json"
RATE_LIMITS_PATH = STATE_DIR / "rate-limits.json"
CB_STATE_PATH = STATE_DIR / "circuit-breakers.json"
BEDROCK_ACCESS_PATH = STATE_DIR / "bedrock-model-access.json"
BEDROCK_OUTCOMES_PATH = STATE_DIR / "bedrock-model-outcomes.json"
AUDIT_LOG_PATH = LOG_DIR / "ai-selections.jsonl"

ALLOWED_PROVIDER_TYPES = {
    "bedrock",
    "cli",
    "openai-compatible",
    "whisper",
    "whisper-remote",
}

ALLOWED_FALLBACK_POLICIES = {
    "selector_default",
    "ordered",
    "ordered_then_selector_default",
    "ordered_strict",
    "none",
}


@dataclass
class TaskMetadata:
    """Privacy and operational flags for task execution.

    Generic preference/fallback fields support ordered model preferences,
    provider allow/disallow lists, and fallback policies. All default to
    empty/None so existing callers are unaffected.
    """
    sensitive: bool = False
    private: bool = False
    offline: bool = False
    external_provider_disallowed: bool = False
    quality_tier: str | None = None
    preferred_models: list[str] = field(default_factory=list)
    preferred_providers: list[str] = field(default_factory=list)
    allowed_models: list[str] = field(default_factory=list)
    disallowed_models: list[str] = field(default_factory=list)
    allowed_providers: list[str] = field(default_factory=list)
    disallowed_providers: list[str] = field(default_factory=list)
    fallback_policy: str | None = None
    selection_policy: str | None = None


@dataclass
class SelectionResult:
    provider_id: str
    model: str
    base_url: str
    api_key: str | None
    reason: str
    cost_estimate: float
    task_type: str = ""
    input_tokens: int = 0
    timeout_inference_sec: int = 30
    task_metadata: TaskMetadata | None = None
    outcome: str = "selected"


@dataclass
class DeferredSelection:
    """A policy-level deferral that must not be treated as a provider choice."""

    scheduled_after: str
    reason: str = "selector_policy_deferred"
    outcome: str = "deferred"
    deferred: bool = True


@dataclass
class CircuitBreakerState:
    status: str = "closed"
    failures: list[float] = field(default_factory=list)
    open_until: float = 0.0
    open_duration_sec: int = 600
    half_open_probe_used: bool = False


class CircuitBreaker:
    def __init__(self, state_path: Path = CB_STATE_PATH, config: dict | None = None) -> None:
        self.state_path = state_path
        self.config = config or {}
        self.states: dict[str, CircuitBreakerState] = {}
        self.load()

    def _cfg(self, key: str, default: int) -> int:
        return int(self.config.get("circuit_breaker", {}).get(key, default))

    def _get(self, provider_id: str) -> CircuitBreakerState:
        state = self.states.get(provider_id)
        if state is None:
            state = CircuitBreakerState()
            self.states[provider_id] = state
        return state

    def _prune(self, state: CircuitBreakerState, now: float) -> None:
        window = self._cfg("failure_window_sec", 300)
        state.failures = [ts for ts in state.failures if now - ts <= window]

    def is_open(self, provider_id: str) -> bool:
        state = self._get(provider_id)
        now = time.time()
        if state.status == "open":
            if now >= state.open_until:
                state.status = "half_open"
                state.half_open_probe_used = False
                self.save()
                return False
            return True
        if state.status == "half_open":
            if state.half_open_probe_used:
                return True
            return False
        return False

    def register_failure(self, provider_id: str, ts: float | None = None) -> None:
        now = ts or time.time()
        state = self._get(provider_id)
        self._prune(state, now)
        state.failures.append(now)
        threshold = self._cfg("failure_threshold", 3)
        if state.status == "half_open":
            state.status = "open"
            state.half_open_probe_used = False
            state.open_duration_sec = min(
                self._cfg("max_open_duration_sec", 7200),
                max(self._cfg("open_duration_sec", 600), state.open_duration_sec * 2),
            )
            state.open_until = now + state.open_duration_sec
        elif len(state.failures) >= threshold:
            state.status = "open"
            state.half_open_probe_used = False
            state.open_duration_sec = min(
                self._cfg("max_open_duration_sec", 7200),
                state.open_duration_sec,
            )
            state.open_until = now + state.open_duration_sec
        self.save()

    def register_success(self, provider_id: str) -> None:
        state = self._get(provider_id)
        state.status = "closed"
        state.failures = []
        state.open_until = 0.0
        state.open_duration_sec = 600
        state.half_open_probe_used = False
        self.save()

    def get_state(self, provider_id: str) -> dict:
        state = self._get(provider_id)
        return {
            "status": state.status,
            "failures": len(state.failures),
            "open_until": state.open_until,
            "open_duration_sec": state.open_duration_sec,
            "half_open_probe_used": state.half_open_probe_used,
            "open": self.is_open(provider_id),
        }

    def save(self) -> None:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        payload = {
            provider_id: {
                "status": state.status,
                "failures": state.failures,
                "open_until": state.open_until,
                "open_duration_sec": state.open_duration_sec,
                "half_open_probe_used": state.half_open_probe_used,
            }
            for provider_id, state in self.states.items()
        }
        with open(self.state_path, "w") as f:
            json.dump(payload, f, indent=2)

    def load(self) -> None:
        if not self.state_path.exists():
            self.states = {}
            return
        try:
            with open(self.state_path) as f:
                data = json.load(f)
        except Exception:
            self.states = {}
            return
        self.states = {
            provider_id: CircuitBreakerState(
                status=state.get("status", "closed"),
                failures=list(state.get("failures", [])),
                open_until=float(state.get("open_until", 0.0)),
                open_duration_sec=int(state.get("open_duration_sec", 600)),
                half_open_probe_used=bool(state.get("half_open_probe_used", False)),
            )
            for provider_id, state in data.items()
        }


class NoProviderAvailable(Exception):
    def __init__(self, task_type: str, previous_failures: list[str]):
        self.task_type = task_type
        self.previous_failures = previous_failures
        self.outcome = "unavailable"
        super().__init__(f"No provider available for task={task_type!r} after failures={previous_failures}")


class ModelSelector:
    def __init__(self) -> None:
        self._providers: list[dict] = []
        self._task_types: dict[str, dict] = {}
        self._config: dict = {}
        self._bedrock_config: dict = {}
        self._bedrock_models: list[dict] = []
        self._bedrock_access: dict[str, dict] = {}
        self._bedrock_outcomes: dict[str, dict] = {}
        self._registry_shadow_report: dict[str, Any] = {
            "mode": "shadow",
            "status": "unavailable",
            "selection_authority": "legacy",
            "selection_affected": False,
            "reason": "not_loaded",
        }
        self._rate_limits: dict[str, dict] = {}
        self._provider_models: dict[str, list[str]] = {}
        self._provider_last_check: dict[str, float] = {}
        self._rate_limits_dirty = False
        self._last_persist = time.monotonic()
        self._load_config()
        self._circuit_breaker = CircuitBreaker(state_path=CB_STATE_PATH, config=self._config)
        self._load_rate_limits()
        self._load_bedrock_access()
        self._load_bedrock_outcomes()

    def _load_config(self) -> None:
        with open(PROVIDERS_PATH) as f:
            data = json.load(f)
        self._providers = data["providers"] if isinstance(data, dict) else data
        self._validate_providers()

        with open(TASK_TYPES_PATH) as f:
            self._task_types = json.load(f)["task_types"]

        with open(SELECTOR_CONFIG_PATH) as f:
            self._config = json.load(f)

        if BEDROCK_MODELS_PATH.exists():
            with open(BEDROCK_MODELS_PATH) as f:
                self._bedrock_config = json.load(f)
            self._bedrock_models = list(self._bedrock_config.get("models", []))
        else:
            self._bedrock_config = {}
            self._bedrock_models = []

        # Shadow-only comparison. Legacy sources above remain the sole
        # selection authority until a later MRU0 packet explicitly changes it.
        self._registry_shadow_report = load_and_compare(
            REGISTRY_PATH,
            self._providers,
            self._bedrock_config,
        )
        if self._registry_shadow_report.get("status") == "mismatch":
            log.warning("selector registry shadow status=%s reason=%s", self._registry_shadow_report.get("status"), self._registry_shadow_report.get("reason", "parity_mismatch"))

    def registry_shadow_report(self) -> dict[str, Any]:
        """Return the non-authoritative registry comparison report."""
        return dict(self._registry_shadow_report)

    def _validate_providers(self) -> None:
        for provider in self._providers:
            provider_id = provider.get("id", "<missing>")
            provider_type = provider.get("type", "")
            if provider_type not in ALLOWED_PROVIDER_TYPES:
                allowed = ", ".join(sorted(ALLOWED_PROVIDER_TYPES))
                raise ValueError(
                    f"Unsupported provider type for {provider_id!r}: {provider_type!r}. "
                    f"Allowed provider types: {allowed}"
                )

    def _load_rate_limits(self) -> None:
        if RATE_LIMITS_PATH.exists():
            try:
                with open(RATE_LIMITS_PATH) as f:
                    self._rate_limits = json.load(f)
            except Exception:
                self._rate_limits = {}
        else:
            self._rate_limits = {}

    def _load_bedrock_access(self) -> None:
        if not BEDROCK_ACCESS_PATH.exists():
            self._bedrock_access = {}
            return
        try:
            with open(BEDROCK_ACCESS_PATH) as f:
                self._bedrock_access = json.load(f)
        except Exception:
            self._bedrock_access = {}

    def _save_bedrock_access(self) -> None:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with open(BEDROCK_ACCESS_PATH, "w") as f:
            json.dump(self._bedrock_access, f, indent=2)

    def _load_bedrock_outcomes(self) -> None:
        if not BEDROCK_OUTCOMES_PATH.exists():
            self._bedrock_outcomes = {}
            return
        try:
            with open(BEDROCK_OUTCOMES_PATH) as f:
                self._bedrock_outcomes = json.load(f)
        except Exception:
            self._bedrock_outcomes = {}

    def _save_bedrock_outcomes(self) -> None:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with open(BEDROCK_OUTCOMES_PATH, "w") as f:
            json.dump(self._bedrock_outcomes, f, indent=2)

    def persist_rate_limits(self) -> None:
        if not self._rate_limits_dirty:
            return
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with open(RATE_LIMITS_PATH, "w") as f:
            json.dump(self._rate_limits, f, indent=2)
        self._rate_limits_dirty = False
        self._last_persist = time.monotonic()

    def maybe_persist(self) -> None:
        interval = self._config.get("rate_limit_state_persist_interval_sec", 60)
        if time.monotonic() - self._last_persist > interval:
            self.persist_rate_limits()

    def _is_rate_limited(self, provider_id: str) -> bool:
        state = self._rate_limits.get(provider_id, {})
        blocked_until = state.get("blocked_until")
        if blocked_until and time.time() < blocked_until:
            return True
        return False

    def _check_openai_compatible_health(self, provider: dict) -> bool:
        interval = self._config.get("lmstudio_health_check_interval_sec", 30)
        now = time.monotonic()
        provider_id = provider["id"]
        if now - self._provider_last_check.get(provider_id, 0.0) < interval:
            return bool(self._provider_models.get(provider_id))
        self._provider_last_check[provider_id] = now
        try:
            health_check = provider.get("health_check", {})
            endpoint = health_check.get("endpoint", "/models")
            if endpoint.startswith("http"):
                url = endpoint
            else:
                url = f"{provider['base_url'].rstrip('/')}{endpoint}"
            req = urllib.request.Request(url, headers={"Accept": "application/json"})
            timeout = provider.get("timeout_connect_sec", 3)
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status != 200:
                    self._provider_models[provider_id] = []
                    return False
                data = json.loads(resp.read())
                if "/api/tags" in endpoint:
                    models = data.get("models", [])
                    self._provider_models[provider_id] = [
                        m["name"] for m in models if isinstance(m, dict) and m.get("name")
                    ]
                else:
                    models = data.get("data", [])
                    self._provider_models[provider_id] = [m["id"] for m in models if isinstance(m, dict) and m.get("id")]
                return bool(self._provider_models[provider_id])
        except Exception:
            self._provider_models[provider_id] = []
            return False

    def _probe_openai_compatible_model(self, provider: dict, model_id: str) -> dict:
        now = time.time()
        if not model_id:
            return {"status": "unavailable", "checked_at": now, "error": "missing model_id"}
        base_url = str(provider.get("base_url", "")).rstrip("/")
        timeout = min(int(provider.get("timeout_inference_sec", 30)), 10)
        host = urllib.parse.urlparse(base_url).hostname or ""
        is_ollama = provider.get("health_check", {}).get("endpoint", "").endswith("/api/tags") or ":11434" in base_url
        try:
            if is_ollama:
                scheme = urllib.parse.urlparse(base_url).scheme or "http"
                netloc = urllib.parse.urlparse(base_url).netloc
                root = f"{scheme}://{netloc}"
                url = f"{root}/api/generate"
                payload = {
                    "model": model_id,
                    "prompt": "Reply OK only.",
                    "stream": False,
                    "options": {"temperature": 0, "num_predict": 4},
                }
            else:
                url = f"{base_url}/chat/completions"
                payload = {
                    "model": model_id,
                    "messages": [{"role": "user", "content": "Reply OK only."}],
                    "temperature": 0,
                    "max_tokens": 4,
                }
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Accept": "application/json", "Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
                if resp.status < 200 or resp.status >= 300:
                    return {"status": "failed", "checked_at": now, "error": f"http {resp.status}"}
                data = json.loads(raw) if raw else {}
                text = ""
                if is_ollama:
                    text = str(data.get("response", ""))
                else:
                    choices = data.get("choices", [])
                    if choices and isinstance(choices[0], dict):
                        text = str(choices[0].get("message", {}).get("content", ""))
                return {
                    "status": "ok" if text.strip() else "failed",
                    "checked_at": now,
                    "host": host,
                    "response_preview": text.strip()[:24],
                }
        except Exception as err:
            return {"status": "failed", "checked_at": now, "host": host, "error": str(err)[:240]}

    def _check_whisper_health(self, provider: dict) -> bool:
        binary = provider.get("binary", "faster-whisper")
        return shutil.which(binary) is not None

    def _check_whisper_remote_health(self, provider: dict) -> bool:
        health_url = provider.get("health_check", {}).get("endpoint", "")
        if not health_url:
            base = provider.get("base_url", "").rstrip("/")
            health_url = f"{base}/health"
        timeout = provider.get("timeout_connect_sec", 5)
        try:
            req = urllib.request.Request(health_url, headers={"Accept": "application/json"})
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status != 200:
                    return False
                data = json.loads(resp.read())
                return data.get("status") == "ok"
        except Exception:
            return False

    def _check_cli_health(self, provider: dict) -> bool:
        health_check = provider.get("health_check", {})
        binary = health_check.get("binary_exists") or provider.get("binary")
        if not binary:
            models = provider.get("models", [])
            return bool(models)
        return shutil.which(str(binary)) is not None

    def _get_local_gpu_load(self) -> float:
        """Estimate local GPU/CPU load from active Ollama inference.
        Returns a value 0.0-1.0 where 1.0 means fully loaded."""
        try:
            req = urllib.request.Request(
                "http://localhost:11434/api/ps",
                headers={"Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=2) as resp:
                data = json.loads(resp.read())
                models = data.get("models", [])
                if not models:
                    return 0.0
                # Each actively loaded model with recent activity = load
                active = sum(1 for m in models if m.get("size", 0) > 0)
                return min(1.0, active * 0.5)
        except Exception:
            return 0.0

    def _local_resource_status(self) -> dict:
        """Return conservative local resource headroom for local LLM selection.

        macOS unified memory is shared by CPU and GPU. The selector treats low
        available memory, high load, or already-loaded Ollama models as reasons
        to avoid large local models. This is intentionally conservative because
        callers can always retry later.
        """
        status: dict[str, Any] = {
            "host": "localhost",
            "available_memory_gb": None,
            "total_memory_gb": None,
            "memory_pressure_free_percent": None,
            "load_1m": None,
            "cpu_count": os.cpu_count() or 1,
            "load_per_cpu": None,
            "ollama_loaded_models": [],
        }

        try:
            total_raw = subprocess.check_output(["sysctl", "-n", "hw.memsize"], text=True, timeout=2).strip()
            total_bytes = int(total_raw)
            status["total_memory_gb"] = round(total_bytes / (1024 ** 3), 2)
        except Exception:
            pass

        try:
            pressure = subprocess.check_output(["memory_pressure"], text=True, timeout=5, stderr=subprocess.DEVNULL)
            free_match = re.search(r"System-wide memory free percentage:\s*(\d+)%", pressure)
            if free_match:
                status["memory_pressure_free_percent"] = int(free_match.group(1))
        except Exception:
            pass

        try:
            vm_stat = subprocess.check_output(["vm_stat"], text=True, timeout=2)
            page_size_match = re.search(r"page size of (\d+) bytes", vm_stat)
            page_size = int(page_size_match.group(1)) if page_size_match else 4096
            pages: dict[str, int] = {}
            for line in vm_stat.splitlines():
                if ":" not in line:
                    continue
                key, value = line.split(":", 1)
                number = re.sub(r"[^0-9]", "", value)
                if number:
                    pages[key.strip()] = int(number)
            available_pages = (
                pages.get("Pages free", 0)
                + pages.get("Pages inactive", 0)
                + pages.get("Pages speculative", 0)
            )
            status["available_memory_gb"] = round((available_pages * page_size) / (1024 ** 3), 2)
        except Exception:
            pass

        try:
            load_1m = os.getloadavg()[0]
            cpu_count = int(status["cpu_count"] or 1)
            status["load_1m"] = round(load_1m, 2)
            status["load_per_cpu"] = round(load_1m / max(cpu_count, 1), 3)
        except Exception:
            pass

        try:
            req = urllib.request.Request(
                "http://localhost:11434/api/ps",
                headers={"Accept": "application/json"},
            )
            with urllib.request.urlopen(req, timeout=2) as resp:
                data = json.loads(resp.read())
                status["ollama_loaded_models"] = [
                    m.get("name") or m.get("model")
                    for m in data.get("models", [])
                    if isinstance(m, dict) and (m.get("name") or m.get("model"))
                ]
        except Exception:
            status["ollama_loaded_models"] = []

        return status

    def _check_health(self, provider: dict) -> bool:
        ptype = provider.get("type", "")
        if ptype == "openai-compatible":
            return self._check_openai_compatible_health(provider)
        if ptype == "whisper":
            return self._check_whisper_health(provider)
        if ptype == "whisper-remote":
            return self._check_whisper_remote_health(provider)
        if ptype == "cli":
            return self._check_cli_health(provider)
        return True

    def _model_meets_min_params(self, model_id: str, task_spec: dict) -> bool:
        min_params_str = task_spec.get("min_local_model_params")
        if not min_params_str:
            return True
        try:
            min_b = float(min_params_str.rstrip("B"))
        except ValueError:
            return True
        size_b = self._model_size_b(model_id)
        if size_b is not None:
            return size_b >= min_b
        return True

    def _model_size_b(self, model_id: str) -> float | None:
        model_lower = model_id.lower()
        match = re.search(r"(?<!\d)e?(\d+(?:\.\d+)?)b(?![a-z])", model_lower)
        if not match:
            return None
        try:
            return float(match.group(1))
        except ValueError:
            return None

    def _local_model_resource_ok(self, provider: dict, model_id: str, task_spec: dict) -> tuple[bool, str]:
        if provider.get("type") != "openai-compatible":
            return True, "not-local-openai-compatible"

        hostname = urllib.parse.urlparse(str(provider.get("base_url", ""))).hostname or ""
        if hostname not in {"localhost", "127.0.0.1", "::1"}:
            return True, "remote-local-network-provider"

        policy = task_spec.get("local_resource_policy") or {}
        if not policy:
            return True, "no-resource-policy"

        resources = self._local_resource_status()
        size_b = self._model_size_b(model_id)
        load_per_cpu = resources.get("load_per_cpu")
        available_memory_gb = resources.get("available_memory_gb")
        memory_pressure_free_percent = resources.get("memory_pressure_free_percent")
        loaded_models = [str(m) for m in resources.get("ollama_loaded_models", [])]

        max_load_per_cpu = policy.get("max_load_per_cpu")
        if max_load_per_cpu is not None and load_per_cpu is not None and float(load_per_cpu) > float(max_load_per_cpu):
            return False, f"resource_guard: load_per_cpu={load_per_cpu} > {max_load_per_cpu}"

        memory_by_size = policy.get("min_available_memory_gb_by_model_size", {})
        if size_b is not None and memory_by_size:
            threshold = None
            for key, value in sorted(memory_by_size.items(), key=lambda item: float(item[0]), reverse=True):
                if size_b >= float(key):
                    threshold = float(value)
                    break
            if threshold is not None and available_memory_gb is not None and float(available_memory_gb) < threshold:
                return False, f"resource_guard: available_memory_gb={available_memory_gb} < {threshold}"

        pressure_by_size = policy.get("min_memory_pressure_free_percent_by_model_size", {})
        if size_b is not None and pressure_by_size:
            threshold = None
            for key, value in sorted(pressure_by_size.items(), key=lambda item: float(item[0]), reverse=True):
                if size_b >= float(key):
                    threshold = float(value)
                    break
            if (
                threshold is not None
                and memory_pressure_free_percent is not None
                and float(memory_pressure_free_percent) < threshold
            ):
                return False, f"resource_guard: memory_pressure_free_percent={memory_pressure_free_percent} < {threshold}"

        large_model_threshold = float(policy.get("large_model_threshold_b", 32))
        if (
            size_b is not None
            and size_b >= large_model_threshold
            and policy.get("disallow_large_model_when_other_ollama_model_loaded", True)
            and any(loaded != model_id for loaded in loaded_models)
        ):
            return False, f"resource_guard: ollama_loaded_models={','.join(loaded_models[:3])}"

        return True, "resource_guard: ok"

    def _bedrock_cache_key(self, model: dict) -> str:
        return f"{model.get('region', self._bedrock_config.get('default_region', 'us-east-1'))}:{model.get('model_id', '')}"

    def _bedrock_access_status(self, model: dict) -> dict:
        key = self._bedrock_cache_key(model)
        cached = self._bedrock_access.get(key)
        ttl_sec = int(model.get("access_probe_ttl_hours", self._bedrock_config.get("access_probe_ttl_hours", 24))) * 3600
        now = time.time()
        if cached and now - float(cached.get("checked_at", 0)) < ttl_sec:
            return cached

        region = model.get("region") or self._bedrock_config.get("default_region") or os.environ.get("AWS_REGION", "us-east-1")
        model_id = model.get("model_id")
        if not model_id:
            return {"available": False, "error": "missing model_id", "checked_at": now}

        prompt = self._bedrock_config.get("access_probe_prompt", "Reply OK only.")
        max_tokens = int(self._bedrock_config.get("access_probe_max_output_tokens", 4))
        cmd = [
            "aws", "bedrock-runtime", "converse",
            "--region", str(region),
            "--model-id", str(model_id),
            "--messages", json.dumps([{"role": "user", "content": [{"text": prompt}]}]),
            "--inference-config", json.dumps({"maxTokens": max_tokens, "temperature": 0}),
            "--output", "json",
        ]
        status = {"available": False, "checked_at": now, "region": region, "model_id": model_id}
        try:
            subprocess.run(cmd, check=True, capture_output=True, text=True, timeout=20)
            status["available"] = True
        except subprocess.CalledProcessError as err:
            status["error"] = (err.stderr or err.stdout or str(err)).strip().splitlines()[0:3]
        except Exception as err:
            status["error"] = str(err)
        self._bedrock_access[key] = status
        self._save_bedrock_access()
        return status

    def _bedrock_matrix_status(self, model: dict, run_probe: bool) -> dict:
        access = self._bedrock_access_status(model) if run_probe else self._bedrock_access.get(self._bedrock_cache_key(model), {})
        available = bool(access.get("available"))
        enabled = bool(model.get("enabled", True))
        selectable = self._bedrock_model_selectable(model, access) and available
        lifecycle_state = registry_model_lifecycle(self._registry_shadow_report, "claude-bedrock", str(model.get("id", "")))
        return {
            "provider_id": "claude-bedrock",
            "provider_type": "bedrock",
            "model_id": model.get("model_id", ""),
            "model_key": model.get("id", ""),
            "label": model.get("label") or model.get("model_id", ""),
            "enabled": enabled,
            "selectable": selectable,
            "status": "ok" if selectable else ("disabled" if not enabled else "unavailable"),
            "lifecycle_state": lifecycle_state,
            "capabilities": model.get("capabilities", []),
            "roles": model.get("roles", []),
            "region": model.get("region") or self._bedrock_config.get("default_region"),
            "last_checked_at": access.get("checked_at"),
            "probe": {
                "status": "ok" if available else ("not_run" if not access else "failed"),
                "checked_at": access.get("checked_at"),
                "error": access.get("error"),
            },
            "outcome": self._bedrock_outcomes.get(str(model.get("model_id", "")), {}),
            "cost": {
                "input_per_1m": model.get("price_input_per_1m"),
                "output_per_1m": model.get("price_output_per_1m"),
            },
        }

    def _bedrock_model_selectable(self, model: dict, access: dict) -> bool:
        # Legacy enabled state remains a prerequisite. Discovery/access and
        # upgrade_candidate metadata never grant selection authority.
        if not model.get("enabled", True):
            return False
        model_id = str(model.get("id", ""))
        if not registry_model_selectable(self._registry_shadow_report, "claude-bedrock", model_id):
            log.debug(
                "selector  skip bedrock_model_lifecycle  model=%s  lifecycle=%s",
                model.get("model_id"),
                registry_model_lifecycle(self._registry_shadow_report, "claude-bedrock", model_id) or "unknown",
            )
            return False
        return True

    def _bedrock_outcome_score(self, model: dict) -> float:
        model_id = model.get("model_id", "")
        outcome = self._bedrock_outcomes.get(model_id, {})
        successes = int(outcome.get("successes", 0))
        failures = int(outcome.get("failures", 0))
        if successes == 0 and failures == 0:
            return 0.0
        total = successes + failures
        return max(-0.25, min(0.2, ((successes - failures * 1.5) / total) * 0.1))

    def _estimate_bedrock_model_cost(self, model: dict, task_spec: dict, input_tokens: int) -> float:
        output_tokens = int(task_spec.get("typical_output_tokens", 0))
        input_cost = (input_tokens / 1_000_000) * float(model.get("price_input_per_1m", 0.0))
        output_cost = (output_tokens / 1_000_000) * float(model.get("price_output_per_1m", 0.0))
        return round(input_cost + output_cost, 6)

    def _bedrock_model_score(self, model: dict, task_type: str, task_spec: dict, input_tokens: int) -> float:
        quality = float(model.get("quality_score", 0.5))
        affinity = float(model.get("task_affinity", {}).get(task_type, 1.0))
        cost = self._estimate_bedrock_model_cost(model, task_spec, input_tokens)
        priority_penalty = float(model.get("priority", 100)) / 1000.0
        cost_penalty = min(0.6, cost * 10)
        return (quality * affinity) + self._bedrock_outcome_score(model) - cost_penalty - priority_penalty

    def _pick_bedrock_model(self, task_type: str, task_spec: dict, input_tokens: int, urgent: bool = False, task_metadata: TaskMetadata | None = None) -> dict | None:
        if task_metadata is None:
            task_metadata = TaskMetadata()

        required_capability = task_spec["capability"]
        candidates = []
        for model in self._bedrock_models:
            if required_capability not in model.get("capabilities", []):
                continue
            max_ctx = model.get("max_context_tokens")
            if max_ctx and input_tokens > int(max_ctx):
                continue
            access = self._bedrock_access_status(model)
            if not self._bedrock_model_selectable(model, access):
                log.debug(
                    "selector  skip bedrock_model_not_selectable  model=%s  lifecycle=%s  enabled=%s  access=%s",
                    model.get("model_id"),
                    registry_model_lifecycle(self._registry_shadow_report, "claude-bedrock", str(model.get("id", ""))) or "unknown",
                    bool(model.get("enabled", True)),
                    bool(access.get("available")),
                )
                continue
            if not access.get("available"):
                log.info(
                    "selector  skip bedrock_model_unavailable  model=%s  region=%s",
                    model.get("model_id"),
                    model.get("region"),
                )
                continue
            candidates.append(model)

        # Apply model-level allow/disallow filters
        if task_metadata.disallowed_models:
            dis = set(task_metadata.disallowed_models)
            candidates = [m for m in candidates
                          if m.get("model_id") not in dis and m.get("id") not in dis]
        if task_metadata.allowed_models:
            al = set(task_metadata.allowed_models)
            candidates = [m for m in candidates
                          if m.get("model_id") in al or m.get("id") in al]

        if not candidates:
            return None

        scored = sorted(
            candidates,
            key=lambda m: self._bedrock_model_score(m, task_type, task_spec, input_tokens),
            reverse=True,
        )

        # Apply preference ordering to scored models
        if task_metadata.preferred_models:
            pref_order = {m: i for i, m in enumerate(task_metadata.preferred_models)}
            def bedrock_pref_key(m):
                return pref_order.get(m.get("model_id", ""), pref_order.get(m.get("id", ""), len(task_metadata.preferred_models)))
            scored.sort(key=bedrock_pref_key)

        # Controlled exploration lets the selector learn without letting cost drift.
        exploration_rate = float(self._bedrock_config.get("exploration_rate", 0.0))
        if not urgent and len(scored) > 1 and random.random() < exploration_rate:
            return random.choice(scored[: min(3, len(scored))])
        return scored[0]

    def _pick_model(self, provider: dict, task_spec: dict, task_metadata: TaskMetadata | None = None) -> str:
        if task_metadata is None:
            task_metadata = TaskMetadata()

        models = provider.get("models", [])
        ptype = provider.get("type", "")
        if ptype == "openai-compatible":
            loaded_models = self._provider_models.get(provider["id"], [])
            task_preferred_models = task_spec.get("preferred_local_models")
            preferred_models = task_preferred_models or provider.get("preferred_models", [])
            if loaded_models and preferred_models:
                preferred_loaded = [m for m in preferred_models if m in loaded_models]
                if task_preferred_models:
                    models = preferred_loaded
                else:
                    other_loaded = [m for m in loaded_models if m not in preferred_loaded]
                    models = preferred_loaded + other_loaded
            else:
                models = loaded_models or preferred_models
        if not models:
            return ""
        viable = []
        for model in models:
            # Check model-level allow/disallow filters
            if task_metadata.allowed_models and str(model) not in task_metadata.allowed_models:
                continue
            if str(model) in task_metadata.disallowed_models:
                continue

            if not self._model_meets_min_params(model, task_spec):
                continue
            resource_ok, reason = self._local_model_resource_ok(provider, str(model), task_spec)
            if not resource_ok:
                log.info("selector  skip local_model_resource_guard  provider=%s  model=%s  reason=%s", provider.get("id"), model, reason)
                continue
            if not registry_model_selectable(self._registry_shadow_report, str(provider.get("id", "")), str(model)):
                log.debug(
                    "selector  skip model_lifecycle  provider=%s  model=%s  lifecycle=%s",
                    provider.get("id"),
                    model,
                    registry_model_lifecycle(self._registry_shadow_report, str(provider.get("id", "")), str(model)) or "unknown",
                )
                continue
            viable.append(model)

        # Apply preference ordering to viable models
        if task_metadata.preferred_models and viable:
            pref_order = {m: i for i, m in enumerate(task_metadata.preferred_models)}
            viable.sort(key=lambda m: pref_order.get(str(m), len(task_metadata.preferred_models)))

        return viable[0] if viable else ""

    def _resolve_key(self, provider: dict) -> str | None:
        if provider.get("expose_api_key") is False:
            return None
        key_env = provider.get("api_key_env")
        if key_env:
            return os.environ.get(key_env)
        return provider.get("api_key")

    def _estimate_cost(self, provider: dict, task_spec: dict, input_tokens: int, bedrock_model: dict | None = None) -> float:
        if bedrock_model is not None:
            return self._estimate_bedrock_model_cost(bedrock_model, task_spec, input_tokens)
        cost_per_1k = provider.get("cost_per_1k_tokens", 0.0)
        total_tokens = input_tokens + task_spec.get("typical_output_tokens", 0)
        return round((total_tokens / 1000) * cost_per_1k, 6)

    def _build_reason(self, provider: dict, in_batch: bool, urgent: bool, bedrock_model: dict | None = None) -> str:
        parts = []
        if provider["cost_per_1k_tokens"] == 0.0 and bedrock_model is None:
            parts.append("free")
        if bedrock_model is not None:
            parts.append("paid bedrock")
            parts.append(f"bedrock-model={bedrock_model.get('id')}")
            parts.append(f"region={bedrock_model.get('region')}")
        if in_batch:
            parts.append("batch window")
        if urgent:
            parts.append("urgent")
        parts.append(f"priority={provider['priority']}")
        return "; ".join(parts)

    def _provider_allowed_for_metadata(self, provider: dict, task_metadata: TaskMetadata) -> bool:
        provider_id = provider.get("id", "")

        if task_metadata.external_provider_disallowed or task_metadata.offline:
            # Hard constraint: external provider disallowed / offline mode.
            # Only allow local providers for offline/private tasks.
            provider_type = provider.get("type", "")
            if provider_type != "openai-compatible":
                return False

            hostname = urllib.parse.urlparse(str(provider.get("base_url", ""))).hostname or ""
            if hostname in {"localhost", "127.0.0.1", "::1"}:
                pass  # Allow; fall through to generic filters
            elif hostname.startswith("10.") or hostname.startswith("192.168."):
                pass  # Allow; fall through to generic filters
            elif hostname.startswith("172."):
                parts = hostname.split(".")
                if len(parts) >= 2 and parts[1].isdigit():
                    if 16 <= int(parts[1]) <= 31:
                        pass  # Allow; fall through to generic filters
                    else:
                        return False
                else:
                    return False
            else:
                return False

        # Generic preference filters (apply after hard constraints)
        if provider_id in task_metadata.disallowed_providers:
            return False

        if task_metadata.allowed_providers and provider_id not in task_metadata.allowed_providers:
            return False

        return True

    def select_provider(
        self,
        task_type: str,
        input_token_count: int = 0,
        urgent: bool = False,
        previous_failures: list[str] | None = None,
        task_metadata: TaskMetadata | None = None,
    ) -> SelectionResult | DeferredSelection:
        if previous_failures is None:
            previous_failures = []
        if task_metadata is None:
            task_metadata = TaskMetadata()

        fallback_policy = task_metadata.fallback_policy or "selector_default"
        if fallback_policy not in ALLOWED_FALLBACK_POLICIES:
            raise ValueError(f"Unknown fallback_policy={fallback_policy!r}")
        if fallback_policy == "none" and not task_metadata.preferred_providers:
            raise ValueError("fallback_policy='none' requires an explicit preferred provider")

        if task_type not in self._task_types:
            raise ValueError(f"Unknown task_type={task_type!r}. Known: {list(self._task_types)}")

        task_spec = self._task_types[task_type]
        required_capability = task_spec["capability"]
        now = datetime.now()
        batch_start = self._config.get("batch_window", {}).get("start_hour", 1)
        batch_end = self._config.get("batch_window", {}).get("end_hour", 7)
        in_batch_window = batch_start <= now.hour < batch_end

        eligible = [
            p for p in self._providers
            if required_capability in p.get("capabilities", [])
            and p["id"] not in previous_failures
            and self._provider_allowed_for_metadata(p, task_metadata)
        ]

        # Load-aware sorting: when local GPU is busy, prefer remote workers
        # to distribute work across machines
        local_load = 0.0
        if required_capability == "audio/transcribe":
            local_load = self._get_local_gpu_load()

        if in_batch_window:
            eligible.sort(key=lambda p: (p["cost_per_1k_tokens"] > 0, p["priority"]))
        elif local_load > 0.3 and required_capability == "audio/transcribe":
            # M4 Pro is busy with inference — prefer remote whisper workers
            eligible.sort(key=lambda p: (
                p.get("type") == "whisper",  # local whisper last when GPU busy
                p.get("schedule_preference") == "batch_window" and not urgent,
                p["priority"],
            ))
            log.info("selector  load_aware  local_gpu_load=%.2f  preferring remote whisper", local_load)
        else:
            eligible.sort(key=lambda p: (
                p.get("schedule_preference") == "batch_window" and not urgent,
                p["priority"],
            ))

        # Apply preferred provider ordering: honor the caller-supplied list order.
        # Use the index position within preferred_providers so that, e.g.,
        # ["claude-bedrock", "ollama-m4pro"] always puts claude-bedrock first,
        # regardless of global priority numbers. Non-preferred providers rank after
        # all preferred ones. Prior sorts (priority, batch window) are used as a
        # tiebreaker within the non-preferred tail via Python's stable sort guarantee.
        if task_metadata.preferred_providers:
            pref_order = {pid: i for i, pid in enumerate(task_metadata.preferred_providers)}
            eligible.sort(key=lambda p: pref_order.get(p["id"], len(task_metadata.preferred_providers)))

        # Strict modes never widen beyond the caller's declared provider route.
        if fallback_policy == "none":
            eligible = [p for p in eligible if p["id"] == task_metadata.preferred_providers[0]]
        elif fallback_policy == "ordered_strict" and task_metadata.preferred_providers:
            pref_set = set(task_metadata.preferred_providers)
            eligible = [p for p in eligible if p["id"] in pref_set]

        for provider in eligible:
            if self._circuit_breaker.is_open(provider["id"]):
                log.debug("selector  skip circuit_open  provider=%s", provider["id"])
                continue
            if self._is_rate_limited(provider["id"]):
                log.debug("selector  skip rate_limited  provider=%s", provider["id"])
                continue

            ptype = provider.get("type", "")
            if ptype in ("openai-compatible", "whisper", "whisper-remote", "cli"):
                if not self._check_health(provider):
                    self._circuit_breaker.register_failure(provider["id"])
                    log.debug("selector  skip unhealthy  provider=%s", provider["id"])
                    continue

            max_ctx = provider.get("max_context_tokens")
            if max_ctx and input_token_count > max_ctx:
                log.debug("selector  skip context_exceeded  provider=%s  tokens=%d  max=%d",
                          provider["id"], input_token_count, max_ctx)
                continue

            if ptype == "openai-compatible":
                provider_models = self._provider_models.get(provider["id"], [])
                if not any(self._model_meets_min_params(m, task_spec) for m in provider_models):
                    log.debug("selector  skip no_viable_local_model  provider=%s", provider["id"])
                    continue

            bedrock_model = None
            if ptype == "bedrock":
                bedrock_model = self._pick_bedrock_model(task_type, task_spec, input_token_count, urgent, task_metadata)
                if bedrock_model is None:
                    log.debug("selector  skip no_viable_bedrock_model  provider=%s", provider["id"])
                    continue
                model = str(bedrock_model.get("model_id", ""))
            else:
                model = self._pick_model(provider, task_spec, task_metadata)
                # For vision tasks, prefer qwen2.5vl:7b regardless of default preferred_models
                if required_capability == "image/analyze":
                    task_preferred = task_spec.get("preferred_local_model")
                    if task_preferred:
                        model = task_preferred
            if not model and ptype in ("openai-compatible",):
                continue
            result = SelectionResult(
                provider_id=provider["id"],
                model=model,
                base_url=provider.get("base_url", ""),
                api_key=self._resolve_key(provider),
                reason=self._build_reason(provider, in_batch_window, urgent, bedrock_model),
                cost_estimate=self._estimate_cost(provider, task_spec, input_token_count, bedrock_model),
                task_type=task_type,
                input_tokens=input_token_count,
                timeout_inference_sec=int(provider.get("timeout_inference_sec", 30)),
                task_metadata=task_metadata,
            )
            self._audit_log(result, "selected")
            return result

        if not urgent and self._config.get("prefer_defer_over_paid", True):
            target = self._next_batch_window_iso()
            return DeferredSelection(scheduled_after=target)
        raise NoProviderAvailable(task_type, previous_failures)

    def select(
        self,
        task_type: str,
        input_token_count: int = 0,
        urgent: bool = False,
        previous_failures: list[str] | None = None,
        task_metadata: TaskMetadata | None = None,
    ) -> SelectionResult | DeferredSelection:
        return self.select_provider(task_type, input_token_count, urgent, previous_failures, task_metadata)

    def _next_batch_window_iso(self) -> str:
        now = datetime.now()
        target = now.replace(hour=1, minute=0, second=0, microsecond=0)
        if target <= now:
            target += timedelta(days=1)
        return target.isoformat()

    def _record_bedrock_outcome(self, model_id: str, outcome: str) -> None:
        if not model_id:
            return
        entry = self._bedrock_outcomes.setdefault(model_id, {})
        key = "successes" if outcome == "success" else "failures"
        entry[key] = int(entry.get(key, 0)) + 1
        entry["last_outcome"] = outcome
        entry["last_updated"] = time.time()
        self._save_bedrock_outcomes()

    def report_failure(self, provider_id: str, error_type: str, error_message: str = "", model_id: str = "") -> None:
        state = self._rate_limits.setdefault(provider_id, {})
        if error_type == "rate_limit":
            state["blocked_until"] = time.time() + 60
        elif error_type == "timeout":
            state["blocked_until"] = time.time() + 30
        else:
            state["consecutive_errors"] = state.get("consecutive_errors", 0) + 1
            backoff = min(300, 10 * (2 ** state["consecutive_errors"]))
            state["blocked_until"] = time.time() + backoff
        state["last_error"] = error_type
        state["last_error_message"] = error_message
        state["last_error_time"] = time.time()
        self._rate_limits_dirty = True
        self._circuit_breaker.register_failure(provider_id)
        self._record_bedrock_outcome(model_id, "failure")
        log.warning("selector  failure reported  provider=%s  type=%s", provider_id, error_type)

    def report_success(self, provider_id: str, model_id: str = "") -> None:
        self._circuit_breaker.register_success(provider_id)
        self._record_bedrock_outcome(model_id, "success")

    def providers_with_health(self) -> list[dict]:
        out = []
        for p in self._providers:
            entry = dict(p)
            ptype = p.get("type", "")
            if ptype in ("openai-compatible", "whisper", "whisper-remote", "cli"):
                entry["healthy"] = self._check_health(p)
                if ptype == "openai-compatible":
                    entry["loaded_models"] = list(self._provider_models.get(p["id"], []))
                entry["circuit_state"] = self._circuit_breaker.get_state(p["id"])
            elif ptype == "bedrock":
                model_entries = []
                for model in self._bedrock_models:
                    access = self._bedrock_access.get(self._bedrock_cache_key(model), {})
                    model_entries.append({
                        "id": model.get("id"),
                        "label": model.get("label"),
                        "model_id": model.get("model_id"),
                        "region": model.get("region"),
                        "enabled": bool(model.get("enabled", True)),
                        "lifecycle_state": registry_model_lifecycle(self._registry_shadow_report, "claude-bedrock", str(model.get("id", ""))),
                        "selectable": self._bedrock_model_selectable(model, access) and bool(access.get("available")),
                        "roles": model.get("roles", []),
                        "price_input_per_1m": model.get("price_input_per_1m"),
                        "price_output_per_1m": model.get("price_output_per_1m"),
                        "access": access,
                        "outcome": self._bedrock_outcomes.get(str(model.get("model_id", "")), {}),
                    })
                entry["healthy"] = any(
                    m.get("selectable")
                    for m in model_entries
                ) if model_entries else True
                entry["circuit_state"] = self._circuit_breaker.get_state(p["id"])
                entry["bedrock_models"] = model_entries
            else:
                entry["healthy"] = True
                entry["circuit_state"] = self._circuit_breaker.get_state(p["id"])
            entry["rate_limited"] = self._is_rate_limited(p["id"])
            out.append(entry)
        # Include current local GPU load for observability
        local_load = self._get_local_gpu_load()
        if local_load > 0:
            for e in out:
                if e["id"] == "ollama-m4pro":
                    e["gpu_load"] = local_load
        return out

    def health_matrix(self, run_probe: bool = False) -> dict:
        generated_at = datetime.now(UTC).isoformat().replace("+00:00", "Z")
        providers = self.providers_with_health()
        models = []
        for provider in providers:
            provider_id = provider.get("id", "")
            provider_type = provider.get("type", "")
            circuit_state = provider.get("circuit_state", {})
            rate_limited = bool(provider.get("rate_limited"))
            provider_healthy = bool(provider.get("healthy"))
            if provider_type == "bedrock":
                for model in self._bedrock_models:
                    entry = self._bedrock_matrix_status(model, run_probe)
                    entry["provider_healthy"] = provider_healthy
                    entry["circuit_state"] = circuit_state
                    entry["rate_limited"] = rate_limited
                    models.append(entry)
                continue

            configured_models = provider.get("models") or provider.get("preferred_models") or []
            loaded_models = provider.get("loaded_models") or []
            model_ids = list(dict.fromkeys(list(configured_models) + list(loaded_models)))
            if not model_ids:
                model_ids = [""]
            for model_id in model_ids:
                loaded = not loaded_models or model_id in loaded_models
                selectable = (
                    provider_healthy
                    and loaded
                    and not rate_limited
                    and not circuit_state.get("open")
                    and registry_model_selectable(self._registry_shadow_report, provider_id, str(model_id))
                )
                probe = {"status": "not_run", "checked_at": None}
                if run_probe and provider_type == "openai-compatible" and loaded and model_id:
                    probe = self._probe_openai_compatible_model(provider, str(model_id))
                    selectable = selectable and probe.get("status") == "ok"
                models.append({
                    "provider_id": provider_id,
                    "provider_type": provider_type,
                    "model_id": model_id,
                    "model_key": model_id,
                    "label": model_id or provider.get("label") or provider_id,
                    "enabled": True,
                    "selectable": bool(selectable),
                    "status": "ok" if selectable else ("unavailable" if not provider_healthy else "not_loaded"),
                    "capabilities": provider.get("capabilities", []),
                    "roles": provider.get("roles", []),
                    "region": None,
                    "last_checked_at": None,
                    "probe": probe,
                    "outcome": {},
                    "cost": {"input_per_1m": None, "output_per_1m": None},
                    "provider_healthy": provider_healthy,
                    "circuit_state": circuit_state,
                    "rate_limited": rate_limited,
                    "loaded": loaded,
                })

        selectable_count = sum(1 for model in models if model.get("selectable"))
        status = "ok" if selectable_count else "unavailable"
        return {
            "id": "ai-model-selector-health-matrix",
            "generated_at": generated_at,
            "status": status,
            "probe_mode": "live" if run_probe else "cached",
            "selector": {
                "service": "ai-model-selector",
                "port": int(os.environ.get("AI_SELECTOR_PORT", "4890")),
                "provider_count": len(providers),
                "model_count": len(models),
                "selectable_model_count": selectable_count,
            },
            "policy": {
                "selection_endpoint": "POST /select",
                "health_matrix_endpoint": "GET /health/matrix",
                "consumers_use_selector": True,
                "consumer_provider_probes_allowed": False,
            },
            "providers": providers,
            "models": models,
        }

    def _audit_log(self, result: SelectionResult, event: str, **extra: Any) -> None:
        LOG_DIR.mkdir(parents=True, exist_ok=True)
        record = {
            "ts": datetime.now(UTC).isoformat().replace("+00:00", "Z"),
            "event": event,
            "task": result.task_type,
            "provider": result.provider_id,
            "model": result.model,
            "reason": result.reason,
            "cost": result.cost_estimate,
            "tokens_in": result.input_tokens,
        }
        record.update(extra)
        with open(AUDIT_LOG_PATH, "a") as f:
            f.write(json.dumps(record) + "\n")

    def audit_recent(self, limit: int = 20, task_type: str | None = None) -> list[dict]:
        if not AUDIT_LOG_PATH.exists():
            return []
        lines = AUDIT_LOG_PATH.read_text().splitlines()
        records = []
        for line in reversed(lines):
            try:
                r = json.loads(line)
                if task_type and r.get("task") != task_type:
                    continue
                records.append(r)
                if len(records) >= limit:
                    break
            except Exception:
                continue
        return records
