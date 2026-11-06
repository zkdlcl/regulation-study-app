import importlib.util
import os
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('agents_link', Path(__file__).resolve().parents[1] / 'tools/agents_link.py')
links = importlib.util.module_from_spec(spec)
spec.loader.exec_module(links)


class LinkTest(unittest.TestCase):
    def test_check_does_not_create_and_conflict_is_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, target = root / '원본', root / '별칭'
            source.mkdir()
            with self.assertRaisesRegex(ValueError, '링크 없음'):
                links.ensure_link(target, source, check=True)
            self.assertFalse(target.exists())
            target.mkdir()
            (target / '다른세션.txt').write_text('보존', encoding='utf8')
            with self.assertRaisesRegex(ValueError, '이미 있음'):
                links.ensure_link(target, source)
            self.assertEqual((target / '다른세션.txt').read_text(encoding='utf8'), '보존')

    def test_link_reads_live_source_and_is_idempotent(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            source, target = root / '원본', root / '별칭'
            source.mkdir()
            try:
                self.assertEqual(links.ensure_link(target, source), '만듦')
                (source / 'SKILL.md').write_text('수정된 원본', encoding='utf8')
                self.assertEqual((target / 'SKILL.md').read_text(encoding='utf8'), '수정된 원본')
                self.assertEqual(links.ensure_link(target, source, check=True), '있음')
            finally:
                # 원본 내용은 삭제하지 않고 생성한 링크 자체만 해제한다.
                if os.path.lexists(target):
                    target.rmdir() if os.name == 'nt' else target.unlink()

    def test_missing_source_is_an_error(self):
        with tempfile.TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError, '원본 폴더 없음'):
                links.ensure_link(Path(tmp) / '별칭', Path(tmp) / '없음')


if __name__ == '__main__':
    unittest.main()
