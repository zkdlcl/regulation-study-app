"""해설 Markdown → 녹음용 텍스트·미리듣기 MP3. 앱 목차는 변경하지 않는다.

python -X utf8 tools/tts_narration.py --dry
python -X utf8 tools/tts_narration.py
"""
import argparse
import asyncio
import hashlib
import json
from pathlib import Path

import tts_build as tts

ROOT = Path(tts.ROOT)
DEFAULT_SCRIPT = ROOT / 'audio/국제인도법/01_국제인도법의_첫걸음.md'
DEFAULT_OUT = ROOT / 'audio/.cache/ihl-preview'


def paragraphs(text):
    """본문 전용 형식: 제목과 문단만 허용해 메모가 음성에 섞이지 않게 한다."""
    title, sections, pending = None, [], []

    def flush():
        if pending:
            if not sections:
                raise ValueError('본문 앞에 ## 절 제목이 필요합니다')
            sections[-1]['paragraphs'].append(' '.join(pending))
            pending.clear()

    for raw in text.splitlines() + ['']:
        line = raw.strip()
        if not line:
            flush()
        elif line.startswith('# '):
            flush()
            if title is not None or sections:
                raise ValueError('# 제목은 맨 앞에 한 번만 사용합니다')
            title = line[2:]
        elif line.startswith('## '):
            flush()
            if title is None:
                raise ValueError('# 대본 제목이 필요합니다')
            sections.append({'title': line[3:], 'paragraphs': []})
        elif line.startswith(('#', '>', '-', '*', '근거:', '출처:', '```', '<!--')):
            raise ValueError('근거·목록·주석은 대응표에 기록하세요: ' + line[:40])
        else:
            pending.append(line)
    if not title or not sections or any(not s['paragraphs'] for s in sections):
        raise ValueError('제목·절·본문이 모두 필요합니다')
    return title, sections


def segments(title, sections):
    out = [(tts.spoken(title) + '.', 1.2, None)]
    for s in sections:
        out.append((tts.spoken(s['title']) + '.', 0.8, s['title']))
        out.extend((tts.spoken(p), 1.2, None) for p in s['paragraphs'])
    return out


def validate_map(script, sections):
    path = script.with_name(script.name.split('_', 1)[0] + '_대응표.json')
    mapping = json.loads(path.read_text(encoding='utf-8-sig'))
    if mapping['script'] != script.name:
        raise ValueError('대응표의 대본 파일명이 다릅니다')
    if [s['heading'] for s in mapping['sections']] != [s['title'] for s in sections]:
        raise ValueError('대응표의 절 순서·제목이 대본과 다릅니다')
    if any(not s.get('article') or not s.get('pdf_page') for s in mapping['sections']):
        raise ValueError('대응표의 원문 키·PDF 페이지가 필요합니다')
    return mapping


async def build(script, output, dry=False):
    title, sections = paragraphs(script.read_text(encoding='utf-8-sig'))
    mapping = validate_map(script, sections)
    segs = segments(title, sections)
    output.mkdir(parents=True, exist_ok=True)
    spoken = '\n\n'.join(text for text, _, _ in segs) + '\n'
    (output / '녹음용.txt').write_text(spoken, encoding='utf8')
    print(f'{len(sections)}절 / {len(segs)}조각 / {len(spoken)}자')
    if dry:
        return

    cache = Path(tts.CACHE)
    cache.mkdir(parents=True, exist_ok=True)
    semaphore = asyncio.Semaphore(4)

    def cached(text):
        return cache / (hashlib.sha1(f'{tts.V_A}|{text}'.encode()).hexdigest()[:16] + '.mp3')

    async def fetch(text):
        path = cached(text)
        if not path.exists():
            async with semaphore:
                # 실패 중 남은 파일을 다음 실행에서 완성된 캐시로 쓰지 않는다.
                temporary = path.with_suffix('.part')
                await tts.fetch(tts.V_A, text, str(temporary))
                tts.frames(temporary.read_bytes())
                temporary.replace(path)

    await asyncio.gather(*(fetch(text) for text in dict.fromkeys(t for t, _, _ in segs)))
    data, marks = bytearray(), []
    for text, gap, label in segs:
        fr = tts.frames(cached(text).read_bytes())
        if label:
            marks.append({'t': round(len(data) / tts.FRAME * tts.SEC, 2),
                          'no': str(len(marks) + 1), 'label': label})
        data += fr + tts.silence(fr[:4], gap)
    seconds = round(len(data) / tts.FRAME * tts.SEC)
    if seconds > 900:
        raise ValueError('15분을 초과했습니다. 절 경계에서 대본을 나눠주세요.')
    (output / '01.mp3').write_bytes(data)
    manifest = {'law': '국제인도법', 'status': mapping['status'], 'voice': tts.V_A,
                'script': script.name,
                'script_sha256': hashlib.sha256(script.read_bytes()).hexdigest(),
                'tracks': [{'kind': 'narration', 'title': title, 'file': '01.mp3',
                            'sec': seconds, 'bytes': len(data), 'marks': marks}]}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    print(f'미리듣기: {output / "01.mp3"} ({seconds // 60}:{seconds % 60:02})')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--script', type=Path, default=DEFAULT_SCRIPT)
    parser.add_argument('--out', type=Path, default=DEFAULT_OUT)
    parser.add_argument('--dry', action='store_true')
    args = parser.parse_args()
    asyncio.run(build(args.script, args.out, args.dry))
