import importlib.util
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

TOOLS = Path(__file__).resolve().parents[1] / 'tools'


def load(name):
    spec = importlib.util.spec_from_file_location(name, TOOLS / f'{name}.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


guard, kbq = load('ctx_guard'), load('kbq')
R = guard.ROOT


def read(path, **kw):
    return guard.pretool({'tool_name': 'Read', 'tool_input': {'file_path': str(R / path), **kw}})


def bash(cmd):
    return guard.pretool({'tool_name': 'Bash', 'tool_input': {'command': cmd}})


def denied(result):
    return result.get('hookSpecificOutput', {}).get('permissionDecision') == 'deny'


class PreToolTest(unittest.TestCase):
    def setUp(self):
        os.environ.pop('CTX_GUARD', None)

    def test_read_whole_big_file_denied(self):
        self.assertTrue(denied(read('kb/exam_kb.json')))
        self.assertTrue(denied(read('kb/annot/운영규정.json')))
        self.assertTrue(denied(read('kb/exam_kb.json', limit=5000)))

    def test_read_with_limit_allowed(self):
        self.assertFalse(denied(read('kb/annot/운영규정.json', offset=10, limit=120)))

    def test_minified_never_readable(self):
        self.assertTrue(denied(read('regs.json', limit=50)))

    def test_small_or_unlisted_allowed(self):
        self.assertFalse(denied(read('CLAUDE.md')))
        self.assertFalse(denied(read('kb/study/가채점오류.md')))

    def test_bash_cat_denied_head_allowed(self):
        self.assertTrue(denied(bash('cat kb/exam_kb.json')))
        self.assertTrue(denied(bash(r'Get-Content .\dist\orgmaster.html')))
        self.assertFalse(denied(bash('head -50 kb/exam_kb.json')))
        self.assertFalse(denied(bash('python -X utf8 tools/kbq.py art 운영규정:53')))
        self.assertFalse(denied(bash('grep -n 직권면직 kb/annot/운영규정.json')))

    def test_env_switch_off(self):
        os.environ['CTX_GUARD'] = 'off'
        self.assertFalse(denied(read('kb/exam_kb.json')))

    def test_codex_shell_and_patch_shapes(self):
        self.assertTrue(denied(guard.pretool({'tool_name': 'functions.exec_command',
                                            'tool_input': {'cmd': 'Get-Content kb/exam_kb.json'}})))
        for action in ('Delete', 'Add'):
            patch = f'*** Begin Patch\n*** {action} File: kb/진행상황.md\n*** End Patch'
            self.assertTrue(denied(guard.pretool({'tool_name': 'apply_patch', 'tool_input': {'command': patch}})))
        patch = '*** Begin Patch\n*** Update File: kb/진행상황.md\n@@\n-가\n+나\n*** End Patch'
        self.assertFalse(denied(guard.pretool({'tool_name': 'apply_patch', 'tool_input': {'command': patch}})))


def usage_line(tokens):
    return json.dumps({'type': 'assistant', 'message': {'usage': {'input_tokens': 2, 'cache_read_input_tokens': tokens - 2}}})


class PromptTest(unittest.TestCase):
    def setUp(self):
        os.environ.pop('CTX_WINDOW_TOKENS', None)

    def test_stage_warns_once_by_real_usage(self):
        with tempfile.TemporaryDirectory() as d:
            t = Path(d) / 't.jsonl'
            guard.state_dir = lambda: Path(d)
            data = {'transcript_path': str(t), 'session_id': 's1'}
            t.write_text('x' * 3_000_000 + '\n' + usage_line(500_000) + '\n', encoding='utf8')   # 기록이 커도 실측 50% → 조용
            self.assertEqual(guard.prompt(data), {})
            t.write_text(usage_line(720_000) + '\n', encoding='utf8')                            # 72% → 한 번 알림
            self.assertIn('컨텍스트 약 72%', json.dumps(guard.prompt(data), ensure_ascii=False))
            self.assertEqual(guard.prompt(data), {})
            t.write_text(usage_line(860_000) + '\n', encoding='utf8')                            # 85% 단계 → 다시 알림
            self.assertIn('86%', json.dumps(guard.prompt(data), ensure_ascii=False))

    def test_no_usage_silent(self):
        with tempfile.TemporaryDirectory() as d:
            t = Path(d) / 't.jsonl'
            t.write_bytes(b'x' * 1000)
            guard.state_dir = lambda: Path(d)
            self.assertEqual(guard.prompt({'transcript_path': str(t)}), {})


class WriteGuardTest(unittest.TestCase):
    def test_progress_files_block_write(self):
        r = guard.pretool({'tool_name': 'Write', 'tool_input': {'file_path': str(R / 'kb' / '진행상황.md')}})
        self.assertTrue(denied(r))

    def test_other_write_allowed(self):
        self.assertFalse(denied(guard.pretool({'tool_name': 'Write', 'tool_input': {'file_path': str(R / 'tmp_new.txt')}})))


class ResumeAndCheckpointTest(unittest.TestCase):
    def test_resume_lists_streams_and_latest_memo(self):
        with tempfile.TemporaryDirectory() as d:
            g = Path(d) / 'kb' / '진행'
            g.mkdir(parents=True)
            (g / '가줄.md').write_text('# 가줄\n상태: 진행 중\n다음: 가 다음\n', encoding='utf8')
            (g / '끝줄.md').write_text('# 끝줄\n상태: 완료\n다음: -\n', encoding='utf8')
            (g / '메모.log').write_text(''.join(f'11-07 00:{i:02d} [가줄] 메모{i}\n' for i in range(40)), encoding='utf8')
            old = guard.ROOT
            guard.ROOT = Path(d)
            try:
                ctx = guard.resume({})['hookSpecificOutput']['additionalContext']
            finally:
                guard.ROOT = old
            self.assertIn('[가줄] 진행 중 — 다음: 가 다음', ctx)
            self.assertNotIn('끝줄', ctx)
            self.assertIn('메모39', ctx)                  # 최신 메모는 반드시 들어감
            self.assertNotIn('메모29', ctx)
            self.assertLessEqual(len(ctx), guard.RESUME_MAX)

    def test_checkpoint_appends_only(self):
        with tempfile.TemporaryDirectory() as d:
            (Path(d) / 'kb' / '진행').mkdir(parents=True)
            kbq.ROOT = Path(d)
            log = Path(d) / 'kb' / '진행' / '메모.log'
            log.write_text('이전 세션 줄\n', encoding='utf8')
            original = log.read_bytes()
            for i in range(35):
                kbq.checkpoint(['--줄', '가줄', f'메모{i}'])
            lines = log.read_text(encoding='utf8').splitlines()
            self.assertEqual(lines[0], '이전 세션 줄')     # 다른 세션 기록을 지우지 않음
            self.assertEqual(len(lines), 36)
            self.assertTrue(lines[-1].endswith('[가줄] 메모34'))
            self.assertTrue(log.read_bytes().startswith(original))
            self.assertNotIn(b'\r', log.read_bytes()[len(original):])


class WrongQueueTest(unittest.TestCase):
    def test_add_due_hit(self):
        with tempfile.TemporaryDirectory() as d:
            kbq.WRONG = Path(d) / '오답.jsonl'
            kbq.wrong(['add', '보수운영규정:35', 'X', '확실', '문장', '낱말'])
            kbq.wrong(['add', '보수운영규정:15', 'O', '찍음', '문장2'])
            rows = kbq._wq()
            for r in rows:
                r['due'] = '2000-01-01'
            kbq._wsave(rows)
            due = kbq.wrong(['due'])
            self.assertLess(due.index('w001'), due.index('w002'))       # 확신 오답 먼저
            self.assertIn('상자 1', kbq.wrong(['hit', 'w001', '맞음']))
            self.assertIn('상자 0', kbq.wrong(['hit', 'w002', '틀림', '애매']))


if __name__ == '__main__':
    unittest.main()
