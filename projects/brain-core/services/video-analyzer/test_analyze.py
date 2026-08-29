import importlib.util
import json
import subprocess
import tempfile
import unittest
from datetime import datetime as RealDateTime
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import urlparse


MODULE_PATH = Path(__file__).with_name('analyze.py')
SPEC = importlib.util.spec_from_file_location('brain_video_analyzer', MODULE_PATH)
ANALYZER = importlib.util.module_from_spec(SPEC)
assert SPEC and SPEC.loader
SPEC.loader.exec_module(ANALYZER)


class FrozenDateTime:
    @classmethod
    def now(cls):
        return RealDateTime(2026, 8, 14, 12, 34, 56, 123456)


class VideoAnalyzerSafetyTests(unittest.TestCase):
    def _result_fixture(self, *, status='succeeded', ok=True, frames_extracted=19, paid_frames=3, transcript_provider='captions'):
        return {
            'status': status,
            'ok': ok,
            'processing': {'frames_extracted': frames_extracted, 'frames_sent_to_paid_vision': paid_frames},
            'selected_frames': [{} for _ in range(paid_frames)],
            'visual_observations': [{} for _ in range(paid_frames)],
            'transcript': {'provider': transcript_provider},
        }

    def test_analysis_identity_ignores_caller_persistence_and_request_metadata(self):
        source = 'https://www.youtube.com/watch?v=example'
        base = ANALYZER.normalize_request({'source': source, 'caller': 'codex', 'focus': 'visual changes', 'frame_budget': 19, 'paid_vision_frame_budget': 3})
        for payload in (
            {'source': source, 'caller': 'save-to-mind', 'focus': 'visual changes', 'persist_to_mind': True, 'frame_budget': 19, 'paid_vision_frame_budget': 3},
            {'source': source, 'caller': 'claude-code', 'focus': 'visual changes', 'correlation_id': 'other', 'idempotency_key': 'other', 'frame_budget': 19, 'paid_vision_frame_budget': 3},
        ):
            candidate = ANALYZER.normalize_request(payload)
            self.assertEqual(ANALYZER.analysis_job_id(ANALYZER.sha256_text(source), base), ANALYZER.analysis_job_id(ANALYZER.sha256_text(source), candidate))

    def test_focus_participates_in_analysis_identity(self):
        source_hash = ANALYZER.sha256_text('https://www.youtube.com/watch?v=example')
        first = ANALYZER.normalize_request({'source': 'https://www.youtube.com/watch?v=example', 'focus': 'opening'})
        second = ANALYZER.normalize_request({'source': 'https://www.youtube.com/watch?v=example', 'focus': 'closing'})
        self.assertNotEqual(ANALYZER.analysis_job_id(source_hash, first), ANALYZER.analysis_job_id(source_hash, second))

    def test_completed_cache_requires_requested_coverage_and_ignores_partial(self):
        request = ANALYZER.normalize_request({'source': 'https://www.youtube.com/watch?v=example', 'caller': 'save-to-mind', 'focus': 'visual changes', 'frame_budget': 19, 'paid_vision_frame_budget': 3})
        self.assertTrue(ANALYZER.completed_cache_satisfies(self._result_fixture(), request))
        self.assertFalse(ANALYZER.completed_cache_satisfies(self._result_fixture(status='partial'), request))
        self.assertFalse(ANALYZER.completed_cache_satisfies(self._result_fixture(paid_frames=2), request))
        self.assertFalse(ANALYZER.completed_cache_satisfies(self._result_fixture(frames_extracted=5), request))

    def test_completed_compatible_cache_beats_partial_no_focus_entry_for_queued_request(self):
        source = 'https://www.youtube.com/watch?v=example'
        focus = 'visual changes'
        request = ANALYZER.normalize_request({'source': source, 'caller': 'save-to-mind', 'focus': focus, 'frame_budget': 19, 'paid_vision_frame_budget': 3})
        source_hash = ANALYZER.sha256_text(source)
        with tempfile.TemporaryDirectory() as temp_dir:
            original_runtime = ANALYZER.RUNTIME_ROOT
            ANALYZER.RUNTIME_ROOT = Path(temp_dir)
            try:
                partial_request = ANALYZER.normalize_request({'source': source, 'caller': 'save-to-mind'})
                partial_dir = ANALYZER.RUNTIME_ROOT / 'jobs' / ANALYZER.analysis_job_id(source_hash, partial_request)
                partial_dir.mkdir(parents=True)
                (partial_dir / 'result.json').write_text(json.dumps(self._result_fixture(status='partial', paid_frames=0, transcript_provider='captions')), encoding='utf-8')
                complete_dir = ANALYZER.RUNTIME_ROOT / 'jobs' / ANALYZER.analysis_job_id(source_hash, request)
                complete_dir.mkdir(parents=True)
                (complete_dir / 'result.json').write_text(json.dumps({**self._result_fixture(), 'job_id': ANALYZER.analysis_job_id(source_hash, request)}), encoding='utf-8')
                with patch.object(ANALYZER, 'run_watch_video', side_effect=AssertionError('compatible completed cache should be reused')):
                    result = ANALYZER.analyze(request)
                self.assertEqual(result['status'], 'succeeded')
                self.assertEqual(result['job_id'], ANALYZER.analysis_job_id(source_hash, request))
            finally:
                ANALYZER.RUNTIME_ROOT = original_runtime
    def test_mind_capture_uses_exclusive_creation_and_never_overwrites(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            original_inbox = ANALYZER.MIND_INBOX
            ANALYZER.MIND_INBOX = Path(temp_dir) / 'inbox' / 'new'
            try:
                with patch.object(ANALYZER, 'datetime', FrozenDateTime), patch.object(ANALYZER.secrets, 'token_hex', return_value='fixed123'):
                    first = Path(ANALYZER.save_transcript_to_mind('https://example.test/1', 'Title', 'first'))
                    with self.assertRaises(FileExistsError):
                        ANALYZER.save_transcript_to_mind('https://example.test/2', 'Title', 'second')
                self.assertIn('first', first.read_text(encoding='utf-8'))
                self.assertNotIn('second', first.read_text(encoding='utf-8'))
            finally:
                ANALYZER.MIND_INBOX = original_inbox

    def test_mind_capture_storage_failure_is_not_swallowed(self):
        with tempfile.TemporaryDirectory() as temp_dir:
            blocked = Path(temp_dir) / 'not-a-directory'
            blocked.write_text('existing file', encoding='utf-8')
            original_inbox = ANALYZER.MIND_INBOX
            ANALYZER.MIND_INBOX = blocked
            try:
                with self.assertRaises(FileExistsError):
                    ANALYZER.save_transcript_to_mind('https://example.test', 'Title', 'text')
            finally:
                ANALYZER.MIND_INBOX = original_inbox

    def test_structured_response_rejects_valid_json_with_wrong_shape(self):
        for value in ([], 'text', 1, None, {'title': 'only'}):
            self.assertIsNone(ANALYZER.normalize_structured_result(value))

    def test_normalize_request_accepts_video_agnostic_sources_and_bounds_budgets(self):
        youtube = ANALYZER.normalize_request({
            'source': 'https://www.youtube.com/watch?v=example',
            'caller': 'claude-code',
            'frame_budget': 500,
            'paid_vision_frame_budget': 500,
        })
        self.assertEqual(youtube['source']['kind'], 'youtube-url')
        self.assertEqual(youtube['caller'], 'claude-code')
        self.assertEqual(youtube['frame_budget'], 100)
        self.assertEqual(youtube['paid_vision_frame_budget'], 12)

        local = ANALYZER.normalize_request({
            'source': {'kind': 'local-file', 'uri': '/tmp/example.mp4', 'original_capture_reference': 'inbox/new/example.md'},
            'caller': 'save-to-mind',
            'allow_local_file': True,
        })
        self.assertEqual(local['source']['kind'], 'local-file')
        self.assertTrue(local['allow_local_file'])
        with self.assertRaisesRegex(ValueError, 'source_kind_mismatch'):
            ANALYZER.normalize_request({'source': {'kind': 'youtube-url', 'uri': '/tmp/example.mp4'}})

    def test_watch_report_parser_accepts_all_frames_heading(self):
        report = """---\nsource: /tmp/example.mp4\ntitle: Example\nduration: 00:03\n---\n\n## Transcript\n\n_No transcript available._\n\n## All frames\n\n* `/tmp/frame_0001.jpg` (t=00:00)\n* `/tmp/frame_0002.jpg` (t=00:02)\n"""
        with tempfile.TemporaryDirectory() as temp_dir:
            report_path = Path(temp_dir) / 'report.md'
            report_path.write_text(report, encoding='utf-8')
            metadata, segments, frames = ANALYZER.parse_watch_report(report_path)
        self.assertEqual(metadata['title'], 'Example')
        self.assertEqual(segments, [])
        self.assertEqual([frame['timestamp_seconds'] for frame in frames], [0.0, 2.0])

    def test_visual_frame_selection_is_bounded_and_preserves_endpoints(self):
        frames = [{'timestamp_seconds': float(index), 'path': f'/tmp/frame-{index}.jpg', 'role': 'scene'} for index in range(10)]
        selected = ANALYZER.select_visual_frames(frames, 3)
        self.assertEqual([frame['timestamp_seconds'] for frame in selected], [0.0, 4.0, 9.0])
        self.assertEqual([frame['role'] for frame in selected], ['opening', 'scene-sample', 'closing'])

    def test_selected_frame_vision_preserves_timestamps_and_cost_evidence(self):
        frames = [{'timestamp_seconds': float(index), 'path': f'/tmp/frame-{index}.jpg', 'role': 'scene'} for index in range(6)]
        seen = {}

        def fake_vision(_provider, _model, _prompt, selected, _timeout):
            seen['frame_count'] = len(selected)
            return '{"observations":[{"frame_index":0,"label":"Opening screen","observation":"A dashboard is visible","confidence":"high"},{"frame_index":2,"label":"Closing screen","observation":"The graph has changed","confidence":"medium"}]}'

        with patch.object(ANALYZER, 'select_provider', return_value={'provider_id': 'claude-bedrock', 'model': 'vision-test', 'cost_estimate': 0.004}), \
             patch.object(ANALYZER, 'execute_managed_vision_provider', side_effect=fake_vision), \
             patch.object(ANALYZER, 'report_provider_outcome'):
            observations, evidence, warnings = ANALYZER.analyze_selected_frames(frames, 'visual changes', 3)

        self.assertEqual(seen['frame_count'], 3)
        self.assertEqual([item['timestamp_seconds'] for item in observations], [0.0, 5.0])
        self.assertEqual([item['timestamp'] for item in observations], ['00:00', '00:05'])
        self.assertEqual(evidence['frames'], 3)
        self.assertEqual(evidence['provider'], 'claude-bedrock')
        self.assertEqual(evidence['cost'], 0.004)
        self.assertEqual(warnings, [])

    def test_bedrock_prompt_stays_out_of_argv_and_private_file_is_removed(self):
        captured = {}

        def fake_run(args, **kwargs):
            captured['args'] = args
            request_url = args[args.index('--cli-input-json') + 1]
            request_path = Path(urlparse(request_url).path)
            captured['request_path'] = request_path
            captured['mode'] = request_path.stat().st_mode & 0o777
            captured['request'] = json.loads(request_path.read_text(encoding='utf-8'))
            return SimpleNamespace(
                returncode=0,
                stdout=json.dumps({'output': {'message': {'content': [{'text': '{"title":"ok"}'}]}}}),
                stderr='',
            )

        private_text = 'PRIVATE-TRANSCRIPT-CONTENT'
        with patch.object(ANALYZER.subprocess, 'run', side_effect=fake_run):
            result = ANALYZER.execute_managed_provider('claude-bedrock', 'model-id', private_text, 30)

        self.assertEqual(result, '{"title":"ok"}')
        self.assertNotIn(private_text, '\n'.join(captured['args']))
        self.assertEqual(captured['mode'], 0o600)
        self.assertEqual(captured['request']['messages'][0]['content'][0]['text'], private_text)
        self.assertFalse(captured['request_path'].exists())
        self.assertFalse(captured['request_path'].parent.exists())

    def test_bedrock_private_file_is_removed_after_timeout(self):
        captured = {}

        def fake_timeout(args, **kwargs):
            request_url = args[args.index('--cli-input-json') + 1]
            captured['request_path'] = Path(urlparse(request_url).path)
            raise subprocess.TimeoutExpired(args, kwargs['timeout'])

        with patch.object(ANALYZER.subprocess, 'run', side_effect=fake_timeout):
            with self.assertRaises(subprocess.TimeoutExpired):
                ANALYZER.execute_managed_provider('claude-bedrock', 'model-id', 'private', 30)

        self.assertFalse(captured['request_path'].exists())
        self.assertFalse(captured['request_path'].parent.exists())

    def test_codex_receives_prompt_on_stdin_in_an_empty_private_directory(self):
        captured = {}

        def fake_run(args, **kwargs):
            captured['args'] = args
            captured['input'] = kwargs['input']
            captured['cwd'] = Path(kwargs['cwd'])
            output_path = Path(args[args.index('--output-last-message') + 1])
            captured['output_path'] = output_path
            output_path.write_text('{"title":"ok"}', encoding='utf-8')
            return SimpleNamespace(returncode=0, stdout='', stderr='')

        private_text = 'PRIVATE-CODEX-PROMPT'
        with patch.object(ANALYZER.subprocess, 'run', side_effect=fake_run):
            result = ANALYZER.execute_managed_provider('codex-cli', 'gpt-test', private_text, 30)

        self.assertEqual(result, '{"title":"ok"}')
        self.assertEqual(captured['input'], private_text)
        self.assertNotIn(private_text, '\n'.join(captured['args']))
        self.assertFalse(captured['cwd'].exists())
        self.assertFalse(captured['output_path'].exists())


if __name__ == '__main__':
    unittest.main()
