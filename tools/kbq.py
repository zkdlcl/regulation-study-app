"""기출 근거 DB 질의 도구: 큰 파일을 통째로 읽지 않고 필요한 조각만 꺼낸다 (출력 상한 약 5000자).
  python -X utf8 tools/kbq.py digest [규정]        기출기준.md 의 그 규정 절 (규정 생략 시 목록)
  python -X utf8 tools/kbq.py item <id...>         문항 본문·정답·근거 기록 (예: past-09-5)
  python -X utf8 tools/kbq.py art <규정:조문...>    조문 원문 + 그 조문의 기출 id·함정
  python -X utf8 tools/kbq.py find <규정> <낱말>    낱말이 든 조문
  python -X utf8 tools/kbq.py err                  가채점 오류 교훈
  python -X utf8 tools/kbq.py ans <id...>          스터디 답지 기록
  python -X utf8 tools/kbq.py checkpoint --줄 <줄> "<한 줄>"  kb/진행/메모.log 에 덧붙임 (병렬 세션 안전)
  python -X utf8 tools/kbq.py wrong due|add|hit|list  오답 큐(간격 반복·확신도) — 설명은 wrong 함수 docstring
  --offset N 을 붙이면 N번째 글자부터 이어서 보여 준다.
"""
import json
import re
import sys
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'kb'))

LIMIT = 5000


def emit(text, offset=0):
    chunk = text[offset:offset + LIMIT]
    print(chunk)
    rest = len(text) - offset - len(chunk)
    if rest > 0:
        print(f'\n… {rest}자 더 있음: 같은 명령에 --offset {offset + len(chunk)}')


def sections(path):
    """'## ' 제목 → 본문 (파일 앞머리는 '' 키)"""
    out, cur, buf = {}, '', []
    for line in path.read_text(encoding='utf8').splitlines():
        if line.startswith('## '):
            out[cur] = '\n'.join(buf)
            cur, buf = line[3:].strip(), [line]
        else:
            buf.append(line)
    out[cur] = '\n'.join(buf)
    return out


def digest(args):
    sec = sections(ROOT / 'kb' / '기출기준.md')
    names = [k for k in sec if k]
    if not args:
        return '규정 절: ' + ' / '.join(names)
    hit = [k for k in names if k.startswith(args[0])]
    return sec[hit[0]] if hit else f'없음: {args[0]} (절: {", ".join(names)})'


def exam_kb():
    return json.loads((ROOT / 'kb' / 'exam_kb.json').read_text(encoding='utf8'))


def item(args):
    from kb_lib import exam_items
    kb = exam_kb()['items']
    q = {x['id']: x for x in exam_items()}
    out = []
    for i in args:
        x = q.get(i)
        if x:
            out.append(f"[{i}] {x['src']} · {x['kind']} · 영역 {x['area']} · 정답 {x['a']}\n{x['q']}")
        else:
            out.append(f'[{i}] 기출 본문 없음')
        out.append('— 근거 기록: ' + (json.dumps(kb[i], ensure_ascii=False) if i in kb else '아직 없음'))
    return '\n\n'.join(out)


def art(args):
    from kb_lib import articles
    A, arts = articles(), exam_kb()['arts']
    out = []
    for k in args:
        a = A.get(k)
        out.append(f"[{k}] {a['title']}\n{a['text']}" if a else f'[{k}] 원문 없음')
        if k in arts:
            r = arts[k]
            traps = ' · '.join(f"{t['orig'] or '(끼워 넣음)'} → {t['alt'] or '(빠뜨림)'}" for t in r['traps'])
            out.append(f"— 기출 {r['n']}회 ids: {', '.join(r['ids'])}\n— 함정: {traps or '없음'}")
    return '\n\n'.join(out)


def find(args):
    from kb_lib import articles
    law, word = args[0], args[1]
    hits = [f"{k} {a['title']}" for k, a in articles().items() if a['law'] == law and (word in a['text'] or word in a['title'])]
    return '\n'.join(hits) or '없음'


def err(_):
    sec = sections(ROOT / 'kb' / 'study' / '가채점오류.md')
    return sec.get('교훈 (먼저 읽기)', '교훈 절 없음')


def ans(args):
    d = json.loads((ROOT / 'kb' / 'study' / '답지.json').read_text(encoding='utf8'))
    rows = {x['id']: x for x in d['items'] + d['add']}
    return '\n\n'.join(json.dumps(rows.get(i, '없음'), ensure_ascii=False, indent=1) for i in args)


def checkpoint(args):
    """병렬 세션 안전: kb/진행/메모.log 에 한 줄 덧붙이기만 한다(읽고-고치고-쓰기 없음 → 다른 세션 기록을 지우지 않음).
    --줄 <이름> 으로 작업 줄을 붙인다(생략 시 '기타')."""
    stream = '기타'
    if '--줄' in args:
        k = args.index('--줄')
        stream = args[k + 1] if k + 1 < len(args) else stream
        args = args[:k] + args[k + 2:]
    text = ' '.join(args).strip().replace('\n', ' ')
    if not text:
        return '메모가 비었다: checkpoint --줄 <이름> "<한 일·다음 한 줄>"'
    line = f"{datetime.now().strftime('%m-%d %H:%M')} [{stream}] {text}"
    log = ROOT / 'kb' / '진행' / '메모.log'
    log.parent.mkdir(exist_ok=True)
    with open(log, 'a', encoding='utf8', newline='\n') as f:     # O_APPEND: 동시 실행돼도 줄 단위로 안전
        f.write(line + '\n')
    hint = '' if (log.parent / f'{stream}.md').exists() or stream == '기타' else f' (kb/진행/{stream}.md 가 없다: 새 줄이면 만들 것)'
    return '메모 저장: ' + line + hint


# ── 오답 큐: 간격 반복(라이트너 상자) + 확신도 ─────────────────────────────
# 근거: 인출 연습·간격 반복(Dunlosky 2013 '높은 효과'), 확신 오답 우선(hypercorrection effect)
WRONG = ROOT / 'kb' / 'study' / '오답.jsonl'
GAPS = [1, 3, 7, 14, 30]          # 상자 0~4 의 다음 출제 간격(일). 상자 5 = 졸업


def _wq():
    if not WRONG.exists():
        return []
    return [json.loads(x) for x in WRONG.read_text(encoding='utf8').splitlines() if x.strip()]


def _wsave(rows):
    tmp = WRONG.with_suffix('.tmp')
    tmp.write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in rows), encoding='utf8')
    tmp.replace(WRONG)


def wrong(args):
    """wrong due [n]                       오늘 낼 오답(확신 오답 → 오래된 순)
       wrong add <규정:조문> <정답 O|X> <확신 확실|애매|찍음> "<원문 기준 문장>" ["<함정 낱말>"]
       wrong hit <id> <맞음|틀림> [확신]       결과 기록: 맞으면 상자+1, 틀리면 상자 0
       wrong list                           전체 요약"""
    from datetime import date, timedelta
    today = date.today()
    rows = _wq()
    cmd = args[0] if args else 'due'
    if cmd == 'add':
        art_, ans_, conf, stmt = args[1], args[2], args[3], args[4]
        rid = f"w{len(rows) + 1:03d}"
        rows.append({'id': rid, 'art': art_, 'stmt': stmt, 'ans': ans_, 'trap': args[5] if len(args) > 5 else '',
                     'conf': conf, 'box': 0, 'due': (today + timedelta(days=GAPS[0])).isoformat(),
                     'hist': [[today.isoformat(), '틀림', conf]]})
        _wsave(rows)
        return f'오답 추가 {rid}: {art_} ({conf}) 다음 {rows[-1]["due"]}'
    if cmd == 'hit':
        r = next(x for x in rows if x['id'] == args[1])
        ok = args[2] == '맞음'
        conf = args[3] if len(args) > 3 else ''
        r['box'] = min(len(GAPS), r['box'] + 1) if ok else 0
        r['conf'] = conf or r['conf']
        r['hist'].append([today.isoformat(), args[2], conf])
        r['due'] = '졸업' if r['box'] >= len(GAPS) else (today + timedelta(days=GAPS[r['box']])).isoformat()
        _wsave(rows)
        return f"{r['id']} {args[2]} → 상자 {r['box']}, 다음 {r['due']}"
    if cmd == 'list':
        return '\n'.join(f"{r['id']} 상자{r['box']} {r['due']} {r['art']} [{r['conf']}] {r['stmt'][:60]}" for r in rows) or '오답 없음'
    n = int(args[1]) if len(args) > 1 else 10
    due = [r for r in rows if r['due'] != '졸업' and r['due'] <= today.isoformat()]
    due.sort(key=lambda r: (r['conf'] != '확실', r['due']))
    if not due:
        later = sorted(r['due'] for r in rows if r['due'] != '졸업')
        return '오늘 낼 오답 없음' + (f' (다음 {later[0]})' if later else '')
    return f'오늘 오답 {len(due)}개 중 {min(n, len(due))}개 (확신 오답 먼저)\n' + '\n'.join(
        json.dumps({k: r[k] for k in ('id', 'art', 'stmt', 'ans', 'trap', 'conf', 'box')}, ensure_ascii=False) for r in due[:n])


CMDS = {'digest': digest, 'item': item, 'art': art, 'find': find, 'err': err, 'ans': ans, 'checkpoint': checkpoint, 'wrong': wrong}


def main(argv):
    offset = 0
    if '--offset' in argv:
        i = argv.index('--offset')
        offset = int(argv[i + 1])
        argv = argv[:i] + argv[i + 2:]
    if not argv or argv[0] not in CMDS:
        print(__doc__)
        return 2
    if argv[0] in ('item', 'art', 'ans', 'find') and len(argv) < (3 if argv[0] == 'find' else 2):
        print(__doc__)
        return 2
    emit(CMDS[argv[0]](argv[1:]), offset)
    return 0


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf8')
    sys.exit(main(sys.argv[1:]))
