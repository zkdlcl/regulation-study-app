"""국제인도법 해설 음원을 앱 목차(site/data/tts/ihl.json)에 연결한다.

audio/.cache/ihl-preview/<번호>/01.mp3·manifest.json 을 site/data/tts/ihl/<번호>.mp3 로 복사하고
ORDER(교재 순서) 대로 트랙을 만든다. 01편은 기존 게시 파일을 보존한다(캐시가 없음).
복사 전 manifest 대본 해시 = 현재 원고 해시 = 무료TTS검증.json 해시, 음원 해시 = 검증 기록을 확인한다.
  python -X utf8 tools/tts_ihl_link.py          # 확인만
  python -X utf8 tools/tts_ihl_link.py --write  # 복사·ihl.json 갱신
"""
import hashlib, json, pathlib, shutil, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'audio' / '국제인도법'
CACHE = ROOT / 'audio' / '.cache' / 'ihl-preview'
OUT = ROOT / 'site' / 'data' / 'tts'
# 04 는 인계 문서라 음원이 아니다. 05 머릿글이 교재 맨 앞.
ORDER = ['05', '01', '02', '03', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41']

sha = lambda p: hashlib.sha256(pathlib.Path(p).read_bytes()).hexdigest()


def main(write):
    old = json.loads((OUT / 'ihl.json').read_text(encoding='utf8'))
    by_file = {t['file']: t for t in old['tracks']}
    ver = {t['episode']: t for t in json.loads((SRC / '무료TTS검증.json').read_text(encoding='utf8'))['tracks']}
    tracks, scripts, bad, copies = [], dict(old.get('scripts_sha256', {})), [], []
    for n in ORDER:
        dst = f'data/tts/ihl/{n}.mp3'
        mf = CACHE / n / 'manifest.json'
        if n in ('01', '02', '03') and dst in by_file:   # 이미 게시된 편은 그대로 둔다
            tracks.append(by_file[dst]); continue
        if not mf.exists():
            bad.append(f'{n}: 캐시 없음 → 대응표 script 로 tools/tts_narration.py 재생성'); continue
        m = json.loads(mf.read_text(encoding='utf8'))
        t = m['tracks'][0]; mp3 = CACHE / n / t['file']
        s = sha(SRC / m['script']); a = sha(mp3); v = ver.get(n, {})
        if not (s == m['script_sha256'] == v.get('script_sha256')): bad.append(f'{n}: 대본 해시 불일치(원고 수정 시 재합성·재검증)')
        if a != v.get('audio_sha256'): bad.append(f'{n}: 음원 해시가 검증 기록과 다름')
        if mp3.stat().st_size != t['bytes'] or m.get('voice') != 'ko-KR-SunHiNeural': bad.append(f'{n}: 크기·음성 불일치')
        tracks.append({'kind': 'narration', 'title': t['title'], 'file': dst, 'sec': t['sec'], 'bytes': t['bytes'], 'marks': t['marks']})
        scripts[n] = s; copies.append((mp3, OUT / 'ihl' / f'{n}.mp3'))
    for line in bad: print('문제:', line)
    total = sum(t['sec'] for t in tracks)
    print(f'트랙 {len(tracks)}개, 절 {sum(len(t["marks"]) for t in tracks)}개, 합계 {total // 60}분 {total % 60}초')
    if bad: sys.exit(1)
    if not write: return
    for a, b in copies: shutil.copyfile(a, b)
    old['tracks'] = tracks
    old['scripts_sha256'] = {k: scripts[k] for k in sorted(scripts)}
    old['order'] = ORDER
    old['human_listening'] = '미실시(사용자 실사용 청취 피드백 대기)'
    (OUT / 'ihl.json').write_text(json.dumps(old, ensure_ascii=False, separators=(',', ':')), encoding='utf8')
    print('복사·ihl.json 갱신 완료')


if __name__ == '__main__':
    main('--write' in sys.argv)
