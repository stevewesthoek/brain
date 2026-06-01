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

log = logging.getLogger(__name__)

CONFIG_DIR = Path.home() / ".config/video-orchestrator"
STATE_DIR = Path.home() / ".local/video-orchestrator/state"
LOG_DIR = Path.home() / ".local/video-orchestrator/logs"

PROVIDERS_PATH = CONFIG_DIR / "ai-providers.json"
TASK_TYPES_PATH = CONFIG_DIR / "ai-task-types.json"
SELECTOR_CONFIG_PATH = CONFIG_DIR / "ai-selector-config.json"
BEDROCK_MODELS_PATH = CONFIG_DIR / "ai-bedrock-models.json"
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


@dataclass
class TaskMetadata:
    """Privacy and operational flags for task execution."""
    sensitive: bool = False
    private: bool = False
    offline: bool = False
    external_provider_disallowed: bool = False


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
        model_lower = model_id.lower()
        for size in ["70", "34", "32", "14", "13", "8", "7", "3", "1"]:
            if f"{size}b" in model_lower:
                return float(size) >= min_b
        return True

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

    def _bedrock_model_selectable(self, model: dict, access: dict) -> bool:
        if model.get("enabled", True):
            return True
        return bool(model.get("upgrade_candidate") and access.get("available"))

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

    def _pick_bedrock_model(self, task_type: str, task_spec: dict, input_tokens: int, urgent: bool = False) -> dict | None:
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
                    "selector  skip bedrock_model_disabled  model=%s  upgrade_candidate=%s  access=%s",
                    model.get("model_id"),
                    bool(model.get("upgrade_candidate")),
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

        if not candidates:
            return None

        scored = sorted(
            candidates,
            key=lambda m: self._bedrock_model_score(m, task_type, task_spec, input_tokens),
            reverse=True,
        )

        # Controlled exploration lets the selector learn without letting cost drift.
        exploration_rate = float(self._bedrock_config.get("exploration_rate", 0.0))
        if not urgent and len(scored) > 1 and random.random() < exploration_rate:
            return random.choice(scored[: min(3, len(scored))])
        return scored[0]

    def _pick_model(self, provider: dict, task_spec: dict) -> str:
        models = provider.get("models", [])
        ptype = provider.get("type", "")
        if ptype == "openai-compatible":
            loaded_models = self._provider_models.get(provider["id"], [])
            preferred_models = provider.get("preferred_models", [])
            if loaded_models and preferred_models:
                preferred_loaded = [m for m in preferred_models if m in loaded_models]
                other_loaded = [m for m in loaded_models if m not in preferred_loaded]
                models = preferred_loaded + other_loaded
            else:
                models = loaded_models or preferred_models
        if not models:
            return ""
        viable = [m for m in models if self._model_meets_min_params(m, task_spec)]
        return viable[0] if viable else models[0]

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
        if not task_metadata.external_provider_disallowed and not task_metadata.offline:
            return True

        provider_type = provider.get("type", "")
        if provider_type != "openai-compatible":
            return False

        hostname = urllib.parse.urlparse(str(provider.get("base_url", ""))).hostname or ""
        if hostname in {"localhost", "127.0.0.1", "::1"}:
            return True
        if hostname.startswith("10.") or hostname.startswith("192.168."):
            return True
        if hostname.startswith("172."):
            parts = hostname.split(".")
            if len(parts) >= 2 and parts[1].isdigit():
                return 16 <= int(parts[1]) <= 31
        return False

    def select_provider(
        self,
        task_type: str,
        input_token_count: int = 0,
        urgent: bool = False,
        previous_failures: list[str] | None = None,
        task_metadata: TaskMetadata | None = None,
    ) -> SelectionResult:
        if previous_failures is None:
            previous_failures = []
        if task_metadata is None:
            task_metadata = TaskMetadata()

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
                bedrock_model = self._pick_bedrock_model(task_type, task_spec, input_token_count, urgent)
                if bedrock_model is None:
                    log.debug("selector  skip no_viable_bedrock_model  provider=%s", provider["id"])
                    continue
                model = str(bedrock_model.get("model_id", ""))
            else:
                model = self._pick_model(provider, task_spec)
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
            return {"deferred": True, "scheduled_after": target}  # type: ignore[return-value]
        raise NoProviderAvailable(task_type, previous_failures)

    def select(
        self,
        task_type: str,
        input_token_count: int = 0,
        urgent: bool = False,
        previous_failures: list[str] | None = None,
        task_metadata: TaskMetadata | None = None,
    ) -> SelectionResult:
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
                        "roles": model.get("roles", []),
                        "price_input_per_1m": model.get("price_input_per_1m"),
                        "price_output_per_1m": model.get("price_output_per_1m"),
                        "access": access,
                        "outcome": self._bedrock_outcomes.get(str(model.get("model_id", "")), {}),
                    })
                entry["healthy"] = any(
                    m.get("enabled") and m.get("access", {}).get("available")
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
