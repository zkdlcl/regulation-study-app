"""폐기된 유료 명령과 직접 호출의 차단을 검증한다."""
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import tts_clova as clova


class ClovaTest(unittest.TestCase):
    def test_legacy_commands_rejected_before_network_or_file_access(self):
        for args in ([], ['--help'], ['--script', '없는원고.md'],
                     ['--script', '없는원고.md', '--synthesize']):
            with self.subTest(args=args):
                result = subprocess.run([sys.executable, '-X', 'utf8', str(ROOT / 'tools/tts_clova.py'), *args],
                                        capture_output=True, text=True, encoding='utf-8', cwd=ROOT)
                self.assertEqual(result.returncode, 2)
                self.assertIn('tools/tts_narration.py', result.stderr)

    def test_direct_call_rejected_even_with_credentials(self):
        with patch.dict('os.environ', {'NCP_CLOVA_API_KEY_ID': 'test', 'NCP_CLOVA_API_KEY': 'test'}), \
             patch('urllib.request.urlopen', side_effect=AssertionError('유료 네트워크 호출')):
            with self.assertRaisesRegex(RuntimeError, '프로젝트에서 제외'):
                clova.synthesize({}, Path('.'))


if __name__ == '__main__':
    unittest.main()
