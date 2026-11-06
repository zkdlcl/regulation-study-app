import copy
import json
from pathlib import Path
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / 'kb'))
import kb_lib
import study_subject as s
import study_tables as t

source = (ROOT / 'base/orgmaster.base.html').read_text(encoding='utf8')
BASE = json.loads(re.search(r'<script id="data" type="application/json">(.*?)</script>', source, re.S)[1])
ARTS = kb_lib.articles()


class SubjectTableTests(unittest.TestCase):
    def setUp(self):
        data = copy.deepcopy(BASE)
        t.enrich(data)
        self.html = s.extend(data['tableHtml'], ARTS, str(ROOT))

    def test_sections_and_chips(self):
        ids = [int(x) for x in re.findall(r'id="table-(\d+)"', self.html)]
        self.assertEqual(sorted(ids), list(range(1, 19)))
        self.assertEqual(ids[-1], 14, '백지 복원은 맨 끝')
        self.assertEqual(self.html.count('<section class="tsec"'), 18)
        for k, _ in s.CHIPS:
            self.assertIn(f'data-tcat="{k}"', self.html)
        self.assertEqual(len(re.findall(r'data-cat="[^"]*subj', self.html)), 5)

    def test_subjects_blanked_from_source(self):
        self.assertIn('“[[회장]]은 특히 필요한 경우 직원에게 특별위로금을 지급할 수 있다”', self.html)
        self.assertIn('[[기관장]]은 기관의 재정상태에 따라 지급일의 2일 이내', self.html)
        self.assertIn('[[각 기관장 및 소속기관장]]은 예산이 정한 각 목', self.html)
        self.assertIn('[[감사반장]]은 감사실시 당일 감사대상기관의 장에게', self.html)
        self.assertIn('data:image/webp;base64,', self.html)

    def test_changed_source_fails(self):
        arts = copy.deepcopy(ARTS)
        arts['보수운영규정:35']['text'] = arts['보수운영규정:35']['text'].replace('회장은', '기관장은')
        data = copy.deepcopy(BASE)
        t.enrich(data)
        with self.assertRaises(ValueError):
            s.extend(data['tableHtml'], arts, str(ROOT))


if __name__ == '__main__':
    unittest.main()
