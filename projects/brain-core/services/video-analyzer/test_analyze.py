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
