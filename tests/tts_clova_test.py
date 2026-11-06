import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch
import wave

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tools'))
import tts_clova as clova


def wav():
    buf = io.BytesIO()
    with wave.open(buf, 'wb') as out:
        out.setnchannels(1)
        out.setsampwidth(2)
        out.setframerate(24000)
        out.writeframes(b'\x01\x00' * 2400)
    return buf.getvalue()


class ClovaTest(unittest.TestCase):
    def test_prepare_all_sources_without_network(self):
        with tempfile.TemporaryDirectory() as tmp, patch.object(clova.urllib.request, 'urlopen', side_effect=AssertionError('network')):
            for source_map in sorted((ROOT / 'audio/국제인도법').glob('[0-9][0-9]_대응표.json')):
                script = source_map.parent / json.loads(source_map.read_text(encoding='utf8'))['script']
                plan = clova.prepare(script, Path(tmp) / script.stem)
                self.assertTrue(all(0 < len(c['text']) <= 2000 for c in plan['chunks']))
                self.assertNotIn('https://', '\n'.join(c['text'] for c in plan['chunks']))
                self.assertEqual(plan['characters'], sum(len(c['text']) for c in plan['chunks']))

    def test_synthesis_cache_and_chapter_times(self):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp)
            plan = clova.prepare(clova.narration.DEFAULT_SCRIPT, out, sample=True)
            with patch.dict(clova.os.environ, {'NCP_CLOVA_API_KEY_ID': 'test', 'NCP_CLOVA_API_KEY': 'test'}):
                with patch.object(clova.urllib.request, 'urlopen', side_effect=lambda *a, **k: io.BytesIO(wav())) as fetch:
                    clova.synthesize(plan, out)
                    self.assertEqual(fetch.call_count, len(plan['chunks']))
                with patch.object(clova.urllib.request, 'urlopen', side_effect=AssertionError('cache miss')):
                    clova.synthesize(plan, out)
            m = json.loads((out / 'manifest.json').read_text(encoding='utf8'))
            expected = sum(0.1 + c['gap_sec'] for c in plan['chunks'])
            self.assertAlmostEqual(m['tracks'][0]['sec'], expected, places=2)
            self.assertEqual(m['tracks'][0]['marks'][0]['t'], 1.3)
            self.assertEqual(len(clova.pcm((out / 'preview.wav').read_bytes())) / 48000, expected)

    def test_missing_credentials_and_invalid_audio_rejected(self):
        with patch.dict(clova.os.environ, {}, clear=True):
            with self.assertRaisesRegex(ValueError, '환경변수'):
                clova.synthesize({}, Path('.'))
        with self.assertRaises((wave.Error, EOFError)):
            clova.pcm(b'not wav')


if __name__ == '__main__':
    unittest.main()
