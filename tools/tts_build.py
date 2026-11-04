"""규정 듣기 음원 생성: 원문(장 단위)·Q&A(대본 단위) MP3 와 목차를 만든다.

  python -X utf8 tools/tts_build.py            # 생성 (조각은 캐시, 글이 바뀐 조각만 새로 받음)
  python -X utf8 tools/tts_build.py --dry      # 읽을 글만 audio/.cache/대본.txt 로 뽑고 끝

출력: site/data/tts/<id>/NN.mp3, site/data/tts/<id>.json → 앱에는 build_artifact.py 가 D.tts 로 넣는다.
조각을 MP3 프레임 그대로 이어 붙인다(재인코딩 없음). 24kHz 48kbps 모노, 프레임 144바이트 = 24ms.
규정 원문은 site/data/laws/, Q&A 는 audio/<규정>/NN_*.md 가 기준이다. 별표(표)는 읽지 않는다.
"""
import asyncio, hashlib, html, json, os, re, sys

import edge_tts

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
P = lambda *a: os.path.join(ROOT, *a)
LAWS = [{'law': '보수운영규정', 'id': 'compensation', 'dir': '보수운영규정'}]
V_A, V_Q = 'ko-KR-SunHiNeural', 'ko-KR-InJoonNeural'
FRAME, SEC = 144, 0.024
CACHE = P('audio', '.cache')
CIRC = '①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳'


SINO = '영일이삼사오육칠팔구'


def sino(n):
    """정수 → 한자어 수 글자. TTS 가 '제5호'를 '제어호'로 읽어서(사용자 지적) 서수 숫자는 글자로 준다."""
    n, out = int(n), ''
    for v, u in ((1000, '천'), (100, '백'), (10, '십')):
        q, n = divmod(n, v)
        if q: out += ('' if q == 1 else SINO[q]) + u
    return (out + (SINO[n] if n else '')) or '영'


def ordinals(s):
    """제N조·항·호·장·절·관·목(+의N), 별표 제N호의N 의 숫자를 한글로."""
    def f(m):
        return '제' + sino(m[1]) + m[2] + ('의' + sino(m[3]) if m[3] else '')
    s = re.sub(r'제\s*(\d+)\s*(조|항|호|장|절|관|목|차)(?:의\s*(\d+))?', f, s)
    # '별표 제1호의2, 3' 처럼 이어지는 번호
    return re.sub(r'(제[가-힣]+(?:조|항|호)(?:의[가-힣]+)?), (\d+)(?=[와과 ])', lambda m: m[1] + ', ' + sino(m[2]), s)


def spoken(s):
    """눈으로 읽는 표기를 귀로 듣는 표기로. 내용 낱말은 바꾸지 않는다."""
    s = re.sub(r'[<＜〈]\s*(개정|신설|삭제|전문개정|본조신설)[^>＞〉]*[>＞〉]', '', s)
    s = re.sub(r'\[\s*(개정|신설|전문개정|본조신설)[^\]]*\]', '', s)
    s = re.sub(r'(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?', r'\1년 \2월 \3일', s)
    s = re.sub(r'(\d+)\s*/\s*(\d+)', lambda m: f'{m[2]}분의 {m[1]}', s)
    s = s.replace('%', '퍼센트').replace('~', ' 부터 ').replace('∼', ' 부터 ').replace('･', ', ').replace('·', ', ').replace('‧', ', ')
    s = re.sub(r'[「」『』“”"‘’\'*]', '', s)
    s = ordinals(s)
    return re.sub(r'[ \t]+', ' ', s).strip()


def line(s):
    """조문 한 줄: 머리 표지를 말로 바꾼다."""
    s = s.strip()
    if not s: return ''
    if s[0] in CIRC: s = f'제{CIRC.index(s[0]) + 1}항. ' + s[1:]
    else:
        s = re.sub(r'^(\d+)\.\s*', r'제\1호. ', s)
        s = re.sub(r'^([가나다라마바사아자차카타파하])\.\s*', r'\1목. ', s)
    s = spoken(s)
    return s if s[-1:] in '.:?!' else s + '.'


def art_lines(a):
    h = re.sub(r'<span class="amend">.*?</span>', '', a['html'], flags=re.S)
    h = re.sub(r'</div>|<br\s*/?>', '\n', h)
    t = html.unescape(re.sub(r'<[^>]+>', '', h))
    # 삭제된 항·호·목은 읽지 않는다 (사용자 지시)
    gone = lambda x: re.fullmatch(r'(제[가-힣]+(항|호)\. |[가-힣]목\. )?삭제\.?', x)
    return [x for x in (line(l) for l in re.split(r'[\r\n]+', t)) if x and not gone(x)]


def art_no(no):
    m = re.fullmatch(r'(\d+)(?:의(\d+))?', str(no))
    return f'제{m[1]}조의 {m[2]}' if m and m[2] else f'제{no}조'


def law_tracks(law):
    d = json.load(open(P('site', 'data', 'laws', law['id'] + '.json'), encoding='utf8'))
    tracks, cur = [], None
    for a in d['articles']:
        if a['type'] == 'h' and a.get('lv') == 1:
            cur = {'kind': 'law', 'title': a['text'], 'segs': [(V_A, spoken(a['text']) + '.', 0.8, None)]}
            tracks.append(cur)
        elif a['type'] == 'a':
            ls = art_lines(a)
            if not ls or re.fullmatch(r'(삭제\.?\s*)+', ' '.join(ls)): continue
            head = f"{spoken(art_no(a['no']))}, {spoken(a.get('title') or '')}.".replace(', .', '.')
            cur['segs'].append((V_A, head, 0.5, {'no': str(a['no']), 'label': f"{art_no(a['no']).replace('의 ', '의')} {a.get('title') or ''}".strip()}))
            cur['segs'].append((V_A, ' '.join(ls), 1.2, None))
    return tracks


def qa_tracks(law):
    tracks, base = [], P('audio', law['dir'])
    for f in sorted(os.listdir(base)):
        m = re.fullmatch(r'0*([1-9]\d*)_(.+)\.md', f)
        if not m: continue
        t = {'kind': 'qa', 'title': m[2].replace('_', ' '), 'segs': []}
        q, a, no = None, [], None

        def flush():
            nonlocal q, a
            if q is None: return
            t['segs'].append((V_Q, q, 3.0, {'no': no, 'label': f'Q{no} {q}'}))
            t['segs'].append((V_A, ' '.join(a), 1.5, None))
            q, a = None, []
        for l in open(os.path.join(base, f), encoding='utf8').read().split('\n'):
            l = l.strip()
            mq = re.match(r'Q(\d+)\.\s*(.+)', l)
            if mq: flush(); no, q = mq[1], spoken(mq[2]); continue
            if q is None or not l or l.startswith(('⏸', '#', '>', '근거', '---')): continue
            l = re.sub(r'^A\.\s*', '', l)
            l = re.sub(r'\*\*', '', l)
            x = line(l)
            if x: a.append(re.sub(r'^제[가-힣]+호\. ', '', x))
        flush()
        if not t['segs']: sys.exit(f'대본 형식 확인 필요: {f}')
        tracks.append(t)
    return tracks


async def fetch(voice, text, path):
    for i in range(4):
        try:
            buf = bytearray()
            async for c in edge_tts.Communicate(text, voice).stream():
                if c['type'] == 'audio': buf += c['data']
            if not buf: raise RuntimeError('빈 음성')
            open(path, 'wb').write(buf)
            return
        except Exception as e:
            print('재시도', i + 1, e); await asyncio.sleep(2 * (i + 1))
    sys.exit('음성 생성 실패: ' + text[:40])


def frames(b):
    """MP3 프레임만 남긴다(ID3 등 제외). 고정 비트레이트라 144바이트씩 끊긴다."""
    i = 0
    while b[i:i + 2] != b'\xff\xf3': i += 1
    b = b[i:]; n = len(b) // FRAME; b = b[:n * FRAME]
    if any(b[j:j + 2] != b'\xff\xf3' for j in range(0, len(b), FRAME)): sys.exit('MP3 프레임 경계 어긋남')
    return b


def silence(hdr, sec):
    return (hdr + bytes(FRAME - 4)) * round(sec / SEC)


async def build(dry):
    os.makedirs(CACHE, exist_ok=True)
    script = []
    for law in LAWS:
        tracks = law_tracks(law) + qa_tracks(law)
        for t in tracks: script += [f"### {t['title']}"] + [f"[{v[9:11]}] {x}" for v, x, _, _ in t['segs']]
        if dry: continue
        sem = asyncio.Semaphore(4); jobs = []
        cp = lambda v, x: os.path.join(CACHE, hashlib.sha1(f'{v}|{x}'.encode()).hexdigest()[:16] + '.mp3')

        async def one(v, x, p):
            async with sem: await fetch(v, x, p)
        for t in tracks:
            for v, x, _, _ in t['segs']:
                p = cp(v, x)
                if not os.path.exists(p): jobs.append(one(v, x, p))
        print('새로 받을 조각', len(jobs)); await asyncio.gather(*jobs)
        out = P('site', 'data', 'tts', law['id']); os.makedirs(out, exist_ok=True)
        man = {'law': law['law'], 'tracks': []}
        for n, t in enumerate(tracks, 1):
            data, marks = bytearray(), []
            for v, x, gap, mark in t['segs']:
                fr = frames(open(cp(v, x), 'rb').read())
                if mark: marks.append({'t': round(len(data) / FRAME * SEC, 2), **mark})
                data += fr + silence(fr[:4], gap)
            name = f'{n:02d}.mp3'
            open(os.path.join(out, name), 'wb').write(data)
            man['tracks'].append({'kind': t['kind'], 'title': t['title'], 'file': f"data/tts/{law['id']}/{name}",
                                  'sec': round(len(data) / FRAME * SEC), 'bytes': len(data), 'marks': marks})
            print(name, t['title'], round(len(data) / FRAME * SEC / 60, 1), '분', round(len(data) / 1e6, 1), 'MB', len(marks), '표지')
        json.dump(man, open(P('site', 'data', 'tts', law['id'] + '.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
    open(os.path.join(CACHE, '대본.txt'), 'w', encoding='utf8').write('\n'.join(script))


if __name__ == '__main__':
    asyncio.run(build('--dry' in sys.argv))
