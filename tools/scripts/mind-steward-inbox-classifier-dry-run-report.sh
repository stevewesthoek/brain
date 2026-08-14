#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BRAIN_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIND_ROOT="${MIND_STEWARD_MIND_ROOT:-$HOME/Repos/stevewesthoek/mind}"
RUNTIME_DIR="$BRAIN_ROOT/runtime/local/mind-steward"
JSON_OUT="$RUNTIME_DIR/inbox-classifier-latest.json"
MD_OUT="$RUNTIME_DIR/inbox-classifier-latest.md"

mkdir -p "$RUNTIME_DIR"

python3 - "$BRAIN_ROOT" "$MIND_ROOT" "$JSON_OUT" "$MD_OUT" <<'PY'
from __future__ import annotations

import importlib.util
import json
import os
import sys
from datetime import datetime
from pathlib import Path

brain_root = Path(sys.argv[1]).resolve()
mind_root = Path(sys.argv[2]).expanduser().resolve()
json_out = Path(sys.argv[3]).resolve()
md_out = Path(sys.argv[4]).resolve()
selector_runtime_override = os.environ.get('BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_RUNTIME', '').strip()
selector_config_dir_override = os.environ.get('BRAIN_CORE_MIND_STEWARD_INBOX_CLASSIFIER_SELECTOR_CONFIG_DIR', '').strip()
inbox_dir = mind_root / 'capture' / 'inbox'
large_threshold_bytes = 2 * 1024 * 1024
sample_limit = 3
generated_at = datetime.now().astimezone().isoformat()
selector_task_type = 'mind_capture_classification'
selector_runtime_path = Path(selector_runtime_override).expanduser().resolve() if selector_runtime_override else (
    brain_root / 'operations/system-configs/model-selector/runtime/core.py'
).resolve()
selector_config_dir = (
    Path(selector_config_dir_override).expanduser().resolve()
    if selector_config_dir_override
    else Path.home() / '.config/video-orchestrator'
)

for proxy_key in ('HTTP_PROXY', 'HTTPS_PROXY', 'ALL_PROXY', 'http_proxy', 'https_proxy', 'all_proxy'):
    os.environ.pop(proxy_key, None)
os.environ.setdefault('NO_PROXY', '127.0.0.1,localhost,::1')
os.environ.setdefault('no_proxy', '127.0.0.1,localhost,::1')


def make_blocked(
    message: str,
    errors: list[str],
    inbox_total: int,
    sampled: list[dict],
    skipped: list[dict],
    selector_context: dict | None = None,
) -> dict:
    return {
        'job': 'mind-steward-inbox-classifier-dry-run',
        'mode': 'classifier-dry-run-report-only',
        'status': 'blocked',
        'message': message,
        'generatedAt': generated_at,
        'endedAtLisbon': datetime.now().astimezone().isoformat(),
        'durationSeconds': 0,
        'selectorTaskType': selector_task_type,
        'selectorRuntimePath': str(selector_runtime_path),
        'selectorConfigDir': str(selector_config_dir),
        'writesToMind': False,
        'externalSideEffects': False,
        'executableActions': False,
        'selector': {
            'status': 'blocked',
            **(selector_context or {}),
        },
        'inbox': {
            'path': str(inbox_dir),
            'totalFileCount': inbox_total,
            'sampleLimit': sample_limit,
            'sampledCount': len(sampled),
            'skippedCount': len(skipped),
            'sampledFiles': sampled,
            'skippedFiles': skipped,
        },
        'errors': errors,
    }


def make_ok(message: str, selector: dict, inbox_total: int, sampled: list[dict], skipped: list[dict], input_tokens: int) -> dict:
    return {
        'job': 'mind-steward-inbox-classifier-dry-run',
        'mode': 'classifier-dry-run-report-only',
        'status': 'ok',
        'message': message,
        'generatedAt': generated_at,
        'endedAtLisbon': datetime.now().astimezone().isoformat(),
        'durationSeconds': 0,
        'selectorTaskType': selector_task_type,
        'inputTokenCount': input_tokens,
        'selectorRuntimePath': str(selector_runtime_path),
        'selectorConfigDir': str(selector_config_dir),
        'writesToMind': False,
        'externalSideEffects': False,
        'executableActions': False,
        'selector': selector,
        'inbox': {
            'path': str(inbox_dir),
            'totalFileCount': inbox_total,
            'sampleLimit': sample_limit,
            'sampledCount': len(sampled),
            'skippedCount': len(skipped),
            'sampledFiles': sampled,
            'skippedFiles': skipped,
        },
        'errors': [],
    }


sampled_files: list[dict] = []
skipped_files: list[dict] = []
errors: list[str] = []
inbox_total = 0

try:
    if inbox_dir.exists():
        files = sorted((p for p in inbox_dir.iterdir() if p.is_file()), key=lambda p: p.name.lower())
        inbox_total = len(files)
        for file_path in files[:sample_limit]:
            try:
                stat_result = file_path.stat()
                modified_at = datetime.fromtimestamp(stat_result.st_mtime).astimezone().isoformat()
                if stat_result.st_size > large_threshold_bytes:
                    skipped_files.append({
                        'name': file_path.name,
                        'sizeBytes': stat_result.st_size,
                        'modifiedAt': modified_at,
                        'reason': 'larger-than-2mb',
                    })
                    continue

                preview_bytes = file_path.read_bytes()[:4096]
                preview_text = preview_bytes.decode('utf-8', errors='replace').replace('\x00', ' ').strip()
                sampled_files.append({
                    'name': file_path.name,
                    'sizeBytes': stat_result.st_size,
                    'modifiedAt': modified_at,
                    'preview': preview_text[:2000],
                })
            except Exception as err:  # pragma: no cover - defensive runtime guard
                skipped_files.append({
                    'name': file_path.name,
                    'reason': 'read-error',
                    'error': str(err)[:240],
                })
    else:
        report = make_blocked(
            'Mind Steward inbox path is missing. The classifier preflight only inspects read-only inbox files.',
            errors,
            inbox_total,
            sampled_files,
            skipped_files,
        )
        json_out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
        md_out.write_text(
            '# Mind Steward Inbox Classifier Dry-Run\n\n'
            '- Status: blocked\n'
            '- Reason: Mind Steward inbox path is missing.\n'
            f'- Inbox path: {inbox_dir}\n'
            '- Writes to Mind: false\n'
            '- External side effects: false\n'
            '- Executable actions: false\n',
            encoding='utf-8',
        )
        raise SystemExit(0)

    selector_report: dict | None = None

    if not selector_runtime_path.exists():
        report = make_blocked(
            f'Selector runtime is missing: {selector_runtime_path}',
            errors + ['missing-selector-runtime'],
            inbox_total,
            sampled_files,
            skipped_files,
        )
    else:
        spec = importlib.util.spec_from_file_location('mind_steward_selector_core', selector_runtime_path)
        if spec is None or spec.loader is None:
            report = make_blocked(
                f'Selector runtime could not be loaded from {selector_runtime_path}',
                errors + ['selector-runtime-unloadable'],
                inbox_total,
                sampled_files,
                skipped_files,
            )
        else:
            try:
                selector_module = importlib.util.module_from_spec(spec)
                sys.modules['mind_steward_selector_core'] = selector_module
                spec.loader.exec_module(selector_module)
            except Exception as err:
                report = make_blocked(
                    f'Selector runtime import failed: {err}',
                    errors + [str(err)[:240]],
                    inbox_total,
                    sampled_files,
                    skipped_files,
                )
            else:
                try:
                    if selector_config_dir_override:
                        selector_config_dir = Path(selector_config_dir_override).expanduser().resolve()
                    else:
                        selector_config_dir = selector_module.CONFIG_DIR

                    if selector_config_dir_override and not selector_config_dir.exists():
                        raise FileNotFoundError(f'Selector config dir does not exist: {selector_config_dir}')

                    providers = json.loads((selector_config_dir / 'ai-providers.json').read_text(encoding='utf-8')).get('providers', [])
                    tasks = json.loads((selector_config_dir / 'ai-task-types.json').read_text(encoding='utf-8')).get('task_types', {})
                    bedrock_models = json.loads((selector_config_dir / 'ai-bedrock-models.json').read_text(encoding='utf-8')).get('models', [])
                    task = tasks.get(selector_task_type) or {}
                    provider = next((item for item in providers if item.get('id') == 'claude-bedrock'), None)
                    model = next((item for item in bedrock_models if item.get('model_id') == 'us.anthropic.claude-sonnet-4-6'), None)

                    policy_errors = []
                    if provider is None or provider.get('type') != 'bedrock':
                        policy_errors.append('claude-bedrock provider is missing or not Bedrock')
                    if model is None or not model.get('enabled', True):
                        policy_errors.append('approved Claude Sonnet 4.6 Bedrock model is missing or disabled')
                    if task.get('privacy_policy') != 'private-bedrock-only':
                        policy_errors.append('task privacy_policy is not private-bedrock-only')
                    if task.get('required_provider') != 'claude-bedrock':
                        policy_errors.append('task required_provider is not claude-bedrock')
                    if task.get('preferred_model') != 'us.anthropic.claude-sonnet-4-6':
                        policy_errors.append('task preferred_model is not Claude Sonnet 4.6')

                    input_tokens = sum(len(item.get('preview', '')) for item in sampled_files)
                    input_tokens = max(1, input_tokens // 4) if sampled_files else 0
                    selector_report = {
                        'status': 'policy-validated',
                        'providerId': 'claude-bedrock',
                        'model': 'us.anthropic.claude-sonnet-4-6',
                        'baseUrl': '',
                        'reason': 'exact private Bedrock-only route validated without provider probing or inference',
                        'taskType': selector_task_type,
                        'inputTokens': input_tokens,
                        'providerCount': len(providers),
                        'taskTypeCount': len(tasks),
                        'healthMode': 'not-probed-report-only',
                        'health': [],
                        'taskMetadata': {
                            'private': True,
                            'sensitive': True,
                            'allowedProviders': ['claude-bedrock'],
                            'allowedModels': ['us.anthropic.claude-sonnet-4-6'],
                            'preferredProviders': ['claude-bedrock'],
                            'preferredModels': ['us.anthropic.claude-sonnet-4-6'],
                            'fallbackPolicy': 'none',
                        },
                    }
                    if policy_errors:
                        report = make_blocked(
                            'Mind Steward private Bedrock policy validation failed.',
                            errors + policy_errors,
                            inbox_total,
                            sampled_files,
                            skipped_files,
                            selector_report,
                        )
                    else:
                        report = make_ok(
                            'Mind Steward private Bedrock policy validated in report-only mode; no model was contacted.',
                            selector_report,
                            inbox_total,
                            sampled_files,
                            skipped_files,
                            input_tokens,
                        )
                except Exception as err:
                    report = make_blocked(
                        f'Selector setup failed: {err}',
                        errors + [str(err)[:240]],
                        inbox_total,
                        sampled_files,
                        skipped_files,
                    )

    if 'report' not in locals():
        report = make_blocked(
            'Selector report could not be produced.',
            errors + ['missing-report'],
            inbox_total,
            sampled_files,
            skipped_files,
        )

    json_out.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8')
    md_lines = [
        '# Mind Steward Inbox Classifier Dry-Run',
        '',
        f"- Status: {report['status']}",
        f"- Mode: {report['mode']}",
        f"- Task type: {selector_task_type}",
        f"- Writes to Mind: {str(report['writesToMind']).lower()}",
        f"- External side effects: {str(report['externalSideEffects']).lower()}",
        f"- Executable actions: {str(report['executableActions']).lower()}",
        f"- Inbox path: {inbox_dir}",
        f"- Total inbox files: {inbox_total}",
        f"- Sampled files: {len(sampled_files)}",
        f"- Skipped files: {len(skipped_files)}",
    ]
    if report['status'] == 'ok' and isinstance(report.get('selector'), dict):
        selector_data = report['selector']
        md_lines.extend([
            '',
            '## Selector',
            f"- Provider: {selector_data.get('providerId', 'unknown')}",
            f"- Model: {selector_data.get('model', 'unknown')}",
            f"- Base URL: {selector_data.get('baseUrl', 'unknown')}",
            f"- Reason: {selector_data.get('reason', 'unknown')}",
        ])
    elif report['status'] == 'blocked':
        md_lines.extend([
            '',
            '## Blocked',
            f"- Reason: {report.get('message', 'blocked')}",
        ])
    if sampled_files:
        md_lines.extend(['', '## Sampled Files'])
        for item in sampled_files:
            md_lines.append(f"- {item['name']} ({item['sizeBytes']} bytes)")
    if skipped_files:
        md_lines.extend(['', '## Skipped Files'])
        for item in skipped_files:
            reason = item.get('reason', 'unknown')
            md_lines.append(f"- {item.get('name', 'unknown')} ({reason})")
    md_out.write_text('\n'.join(md_lines) + '\n', encoding='utf-8')

except SystemExit:
    raise
except Exception as err:  # pragma: no cover - infrastructure failure guard
    fallback = {
        'job': 'mind-steward-inbox-classifier-dry-run',
        'mode': 'classifier-dry-run-report-only',
        'status': 'blocked',
        'message': f'Infrastructure failure while generating report: {err}',
        'generatedAt': generated_at,
        'endedAtLisbon': datetime.now().astimezone().isoformat(),
        'durationSeconds': 0,
        'selectorTaskType': selector_task_type,
        'selectorRuntimePath': str(selector_runtime_path),
        'selectorConfigDir': str(selector_config_dir),
        'writesToMind': False,
        'externalSideEffects': False,
        'executableActions': False,
        'selector': {'status': 'blocked'},
        'inbox': {
            'path': str(inbox_dir),
            'totalFileCount': inbox_total if 'inbox_total' in locals() else 0,
            'sampleLimit': sample_limit,
            'sampledCount': len(sampled_files) if 'sampled_files' in locals() else 0,
            'skippedCount': len(skipped_files) if 'skipped_files' in locals() else 0,
            'sampledFiles': sampled_files if 'sampled_files' in locals() else [],
            'skippedFiles': skipped_files if 'skipped_files' in locals() else [],
        },
        'errors': [str(err)],
    }
    json_out.write_text(json.dumps(fallback, indent=2) + '\n', encoding='utf-8')
    md_out.write_text(
        '# Mind Steward Inbox Classifier Dry-Run\n\n'
        '- Status: blocked\n'
        f"- Reason: Infrastructure failure while generating report: {err}\n"
        '- Writes to Mind: false\n'
        '- External side effects: false\n'
        '- Executable actions: false\n',
        encoding='utf-8',
    )
    raise SystemExit(1)
PY
