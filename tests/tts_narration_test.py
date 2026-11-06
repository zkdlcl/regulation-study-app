import asyncio
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import tts_narration as narration


class NarrationTest(unittest.TestCase):
    def test_paragraphs_and_mark_order(self):
        title, sections = narration.paragraphs('# 책\n\n## 첫 절\n첫 줄\n다음 줄\n\n둘째 문단\n\n## 다음 절\n본문')
        self.assertEqual(sections[0]['paragraphs'], ['첫 줄 다음 줄', '둘째 문단'])
        self.assertEqual([label for _, _, label in narration.segments(title, sections) if label], ['첫 절', '다음 절'])

    def test_notes_and_empty_sections_rejected(self):
        for text in ['# 책\n## 절\n> 근거 메모', '# 책\n## 절\n근거: 비낭독', '# 책\n## 절', '# 책\n본문', '# 책\n## 절\n<!-- 주석 -->']:
            with self.subTest(text=text), self.assertRaises(ValueError):
                narration.paragraphs(text)

    def test_dry_run_does_not_request_audio_or_publish(self):
        with tempfile.TemporaryDirectory() as tmp:
            output = Path(tmp)
            with patch.object(narration.tts, 'fetch', side_effect=AssertionError('네트워크 호출')):
                asyncio.run(narration.build(narration.DEFAULT_SCRIPT, output, dry=True))
            self.assertEqual([p.name for p in output.iterdir()], ['녹음용.txt'])
            spoken = (output / '녹음용.txt').read_text(encoding='utf8')
            self.assertNotIn('https://', spoken)
            self.assertNotIn('past-06-23', spoken)
            self.assertIn('군사적 필요', spoken)

    def test_pilot_sources_cover_all_headings_and_exist_in_kb(self):
        _, sections = narration.paragraphs(narration.DEFAULT_SCRIPT.read_text(encoding='utf8'))
        mapping = narration.validate_map(narration.DEFAULT_SCRIPT, sections)
        sys.path.insert(0, str(ROOT / 'kb'))
        from kb_lib import articles
        data = articles()
        for s in mapping['sections']:
            self.assertIn(s['article'], data)
        inventory = json.loads((narration.DEFAULT_SCRIPT.parent / '진도.json').read_text(encoding='utf8'))
        self.assertEqual({s['article'] for s in inventory['sections']}, {k for k, a in data.items() if a['law'] == '국제인도법'})
        drafted = set()
        for path in narration.DEFAULT_SCRIPT.parent.glob('[0-9][0-9]_대응표.json'):
            m = json.loads(path.read_text(encoding='utf8'))
            script = path.parent / m['script']
            _, parts = narration.paragraphs(script.read_text(encoding='utf8'))
            narration.validate_map(script, parts)
            for section in m['sections']:
                self.assertIn(section['article'], data)
                self.assertNotIn(section['article'], drafted)
                drafted.add(section['article'])
        self.assertEqual({s['article'] for s in inventory['sections'] if s['status'] == 'draft'}, drafted)

    def test_stale_source_map_rejected(self):
        with self.assertRaisesRegex(ValueError, '순서·제목'):
            narration.validate_map(narration.DEFAULT_SCRIPT, [{'title': '바뀐 제목'}])


if __name__ == '__main__':
    unittest.main()
