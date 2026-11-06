"""CLOVA Voice용 SOURCE 패키지. 기본은 로컬 준비, --synthesize만 API 호출.

python -X utf8 tools/tts_clova.py --script audio/국제인도법/02_전투가_멈춘_뒤에도_지켜야_할_규칙.md
"""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import urllib.error
import urllib.parse
import urllib.request
import wave

import tts_narration as narration

ENDPOINT = 'https://naveropenapi.apigw.ntruss.com/tts-premium/v1/tts'
DOCS = 'https://api.ncloud-docs.com/docs/ai-naver-clovavoice-ttspremium'


def prepare(script, output, speaker='nara', speed=0, sample=False):
    title, sections = narration.paragraphs(script.read_text(encoding='utf-8-sig'))
    mapping = narration.validate_map(script, sections)
    segs = narration.segments(title, sections)
    if sample:
        # 제목·첫 절 제목·첫 두 문단으로 동일 원고 A/B 청취.
        segs = segs[:4]
    chunks = []
    for text, gap, label in segs:
        if len(text) > 2000:
            raise ValueError('CLOVA의 한국어 2000자 제한: 문단을 나누세요')
        chunks.append({'text': text, 'gap_sec': gap, 'label': label})
    plan = {
        'provider': 'clova-voice-premium', 'documentation': DOCS,
        'script': script.name, 'script_sha256': hashlib.sha256(script.read_bytes()).hexdigest(),
        'source_status': mapping['status'], 'title': title, 'sample': sample,
        'settings': {'speaker': speaker, 'speed': speed, 'pitch': 0, 'volume': 0,
                     'format': 'wav', 'sampling-rate': 24000},
        'characters': sum(len(c['text']) for c in chunks), 'chunks': chunks,
    }
    output.mkdir(parents=True, exist_ok=True)
    (output / 'plan.json').write_text(json.dumps(plan, ensure_ascii=False, indent=2) + '\n', encoding='utf8')
    (output / '녹음용.txt').write_text('\n\n'.join(c['text'] for c in chunks) + '\n', encoding='utf8')
    return plan


def pcm(data):
    with wave.open(io.BytesIO(data), 'rb') as src:
        if (src.getnchannels(), src.getsampwidth(), src.getframerate(), src.getcomptype()) != (1, 2, 24000, 'NONE'):
            raise ValueError('예상과 다른 WAV 형식: 모노 16bit 24kHz PCM 필요')
        frames = src.readframes(src.getnframes())
        if not frames or len(frames) != src.getnframes() * 2:
            raise ValueError('불완전한 WAV')
        return frames


def synthesize(plan, output):
    client_id = os.environ.get('NCP_CLOVA_API_KEY_ID')
    client_secret = os.environ.get('NCP_CLOVA_API_KEY')
    if not client_id or not client_secret:
        raise ValueError('환경변수 NCP_CLOVA_API_KEY_ID, NCP_CLOVA_API_KEY가 필요합니다')
    cache = output / 'chunks'
    cache.mkdir(exist_ok=True)
    audio, marks = bytearray(), []
    for chunk in plan['chunks']:
        payload = dict(plan['settings'], text=chunk['text'])
        key = hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()
        path = cache / (key + '.wav')
        if path.exists():
            frames = pcm(path.read_bytes())
        else:
            request = urllib.request.Request(ENDPOINT, data=urllib.parse.urlencode(payload).encode(), headers={
                'X-NCP-APIGW-API-KEY-ID': client_id,
                'X-NCP-APIGW-API-KEY': client_secret,
                'Content-Type': 'application/x-www-form-urlencoded',
            })
            try:
                with urllib.request.urlopen(request, timeout=90) as response:
                    data = response.read()
            except urllib.error.HTTPError as error:
                # 인증정보와 요청 본문을 오류 로그에 출력하지 않는다.
                raise ValueError(f'CLOVA API HTTP {error.code}; 인증·한도·요청 설정을 확인하세요') from None
            frames = pcm(data)
            temporary = path.with_suffix('.part')
            temporary.write_bytes(data)
            temporary.replace(path)
        if chunk['label']:
            marks.append({'t': round(len(audio) / 48000, 2), 'no': str(len(marks) + 1), 'label': chunk['label']})
        audio.extend(frames)
        audio.extend(b'\0\0' * round(chunk['gap_sec'] * 24000))
        if len(audio) / 48000 > 900:
            raise ValueError('15분 초과. 절 경계에서 대본을 나누세요. 조각 캐시는 보존됩니다')
    # Edge 전용 MP3 프레임 조합기를 사용하지 않고 PCM 쉼을 넣는다.
    temporary = output / 'preview.part'
    with wave.open(str(temporary), 'wb') as dest:
        dest.setnchannels(1)
        dest.setsampwidth(2)
        dest.setframerate(24000)
        dest.writeframes(audio)
    temporary.replace(output / 'preview.wav')
    manifest = {'law': '국제인도법', 'status': plan['source_status'],
                'provider': plan['provider'], 'voice': plan['settings']['speaker'],
                'settings': plan['settings'], 'script_sha256': plan['script_sha256'],
                'sample': plan['sample'], 'tracks': [{'kind': 'narration', 'title': plan['title'],
                'file': 'preview.wav', 'sec': round(len(audio) / 48000, 2),
                'bytes': (output / 'preview.wav').stat().st_size, 'marks': marks}]}
    (output / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf8')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--script', type=Path, required=True)
    parser.add_argument('--out', type=Path)
    parser.add_argument('--speaker', default='nara')
    parser.add_argument('--speed', type=int, choices=range(-5, 11), default=0)
    parser.add_argument('--sample', action='store_true')
    parser.add_argument('--synthesize', action='store_true', help='유료 API 요청 실행')
    args = parser.parse_args()
    if args.synthesize:
        parser.error('사용자 방침: 무료 TTS만 사용합니다. 유료 CLOVA 합성은 중단했습니다. tools/tts_narration.py를 사용하세요.')
    output = args.out or (Path(narration.ROOT) / 'audio/.cache/clova' / args.script.stem /
                          f'{args.speaker}-{args.speed}' / ('sample' if args.sample else 'full'))
    plan = prepare(args.script, output, args.speaker, args.speed, args.sample)
    print(f"{plan['characters']}자 / {len(plan['chunks'])}조각 / {output}")
    if args.synthesize:
        synthesize(plan, output)


if __name__ == '__main__':
    main()
