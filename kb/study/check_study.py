"""스터디 답지 DB 검사 + 가채점 오류 사전 생성.
  python -X utf8 kb/study/check_study.py   → 검사 통과 시 kb/study/가채점오류.md 생성
검사: 문항 id, 가채점(prev)이 앱에 들어 있던 답과 같은지, 판정(일치/가채점오류)이 답과 맞는지,
      인용이 원문에 글자 그대로 있는지, 함정 낱말 위치.
빌드(build_artifact.py)는 apply() 로 앱 문제(D.exam)에 공식 답·해설을 덮어쓴다.
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))
from kb_lib import articles, norm, _base_data

F = os.path.join(HERE, '답지.json')
WARN = re.compile(r'^⚠[^<]*<br>')


def load():
    return json.load(open(F, encoding='utf8'))


def _quote_errs(tag, art, quote, trap, qtext, A):
    errs = []
    if art and art not in A: return [f'{tag}: 조문 키 없음 {art}']
    if quote:
        if not art: return [f'{tag}: 인용에 조문이 없음']
        body = norm(A[art]['text'] + A[art]['title'])
        for frag in re.split(r'…|\.\.\.', quote):
            if len(norm(frag)) >= 2 and norm(frag) not in body:
                errs.append(f'{tag}: 원문에 없는 인용 「{frag.strip()[:40]}」 ({art})')
    if trap:
        o, al = trap.get('orig', ''), trap.get('alt', '')
        if not o and not al: errs.append(f'{tag}: 함정이 비어 있음')
        if o and (not quote or norm(o) not in norm(quote)): errs.append(f'{tag}: 함정 원문 낱말이 인용에 없음 {o}')
        if al and norm(al) not in norm(qtext): errs.append(f'{tag}: 함정 바뀐 낱말이 문제에 없음 {al}')
    return errs


def check(db=None, A=None, exam=None):
    db = db or load(); A = A or articles(); exam = exam or _base_data()['exam']
    E = {e['id']: e for e in exam}
    errs, seen = [], set()
    for r in db['items']:
        i = r['id']; tag = i
        if i not in E: errs.append(f'{tag}: 앱에 없는 문항'); continue
        if i in seen: errs.append(f'{tag}: 중복')
        seen.add(i); e = E[i]
        if r.get('prev') != e['a']: errs.append(f"{tag}: prev {r.get('prev')} ≠ 앱의 가채점 답 {e['a']}")
        want = '일치' if r['a'] == r.get('prev') else '가채점오류'
        if r.get('verdict') != want: errs.append(f"{tag}: verdict 는 {want} 이어야 함")
        if e['kind'] == 'ox' and r['a'] not in ('O', 'X'): errs.append(f'{tag}: OX 답 {r["a"]}')
        if want == '가채점오류' and not (r.get('lesson') and r.get('why') and r.get('ex')): errs.append(f'{tag}: 가채점오류는 why·lesson·ex 필수')
        errs += _quote_errs(tag, r.get('art'), r.get('quote'), r.get('trap'), e['q'], A)
        for p in r.get('also', []):
            errs += _quote_errs(f"{tag} {p.get('k', '')}".strip(), p.get('art'), p.get('quote'), p.get('trap'), e['q'], A)
    for x in db.get('add', []):
        tag = x['id']
        if x['id'] in E or x['id'] in seen: errs.append(f'{tag}: 이미 있는 id'); continue
        seen.add(x['id'])
        for k in ('grp', 'no', 'kind', 'area', 'q', 'a', 'ex'):
            if not x.get(k): errs.append(f'{tag}: {k} 없음')
        if x.get('kind') == 'ox' and x.get('a') not in ('O', 'X'): errs.append(f'{tag}: OX 답 {x.get("a")}')
        errs += _quote_errs(tag, x.get('art'), x.get('quote'), x.get('trap'), x.get('q', ''), A)
    import cases   # 사례형·원문 빈칸 (kb/study/cases.py)
    errs += cases.check(A)
    miss = [e['id'] for e in exam if e['grp'] == 'st2' and e['id'] not in seen]
    if miss: errs.append(f'답지 기록 없는 스터디 문항: {miss}')
    return errs


def _ok(e, a):
    if e['kind'] == 'ox': return e['my'] == a
    m, s = re.findall('[①②③④⑤]', e['my']), re.findall('[①②③④⑤]', a)
    return len(m) == len(s) and all(c in s for c in m)


def apply(exam, db=None):
    """D.exam 에 공식 답·해설을 반영. 돌려주는 fix = {id: [가채점 때 맞음?, 지금 맞음?]} (내 답 seed 를 바로잡을 문항)"""
    db = db or load()
    E = {e['id']: e for e in exam}
    fix = {}
    for r in db['items']:
        e = E[r['id']]
        ex = r.get('ex') or WARN.sub('', e.get('ex', ''))
        if r['verdict'] == '가채점오류':
            ex += f"<br><b>가채점 정정</b>: 처음엔 {r['prev']}(으)로 채점했으나 답지는 {r['a']}."
        if e.get('my') and _ok(e, r['prev']) != _ok(e, r['a']):
            fix[r['id']] = [_ok(e, r['prev']), _ok(e, r['a'])]
        e['a'], e['ex'] = r['a'], ex
        if r.get('q'): e['q'] = r['q']   # 문제 글에 답이 드러난 경우만 교체
    for x in db.get('add', []):   # 같은 묶음의 맨 뒤에 넣는다
        idx = [n for n, e in enumerate(exam) if e['grp'] == x['grp']]
        k = max(idx) + 1 if idx else len(exam)   # 새 묶음(st3 …)은 맨 뒤에서 시작
        fields = ('id', 'grp', 'no', 'kind', 'area', 'q', 'a', 'ex', 'my', 'image', 'imageAlt')
        exam.insert(k, {f: x[f] for f in fields if f in x})
    import cases
    exam.extend(cases.build()[0])   # 사례형 묶음은 맨 뒤에 붙인다
    return fix


def md(db):
    out = ['# 가채점 오류 사전 (Claude 판정 실수)', '',
           '스터디 문제를 공식 답지가 나오기 전에 Claude 가 원문으로 가채점했다가 **틀린 것**. 문제를 내거나 채점할 때 같은 실수를 하지 않도록 먼저 읽는다.',
           '`kb/study/답지.json` 에서 생성 — 직접 고치지 말 것.', '']
    bad = [r for r in db['items'] if r['verdict'] == '가채점오류']
    n = len(db['items'])
    out += [f'- 대조 {n}문항 · 일치 {n - len(bad)} · **가채점 오류 {len(bad)}** · 답지로 새로 넣은 문항 {len(db.get("add", []))}', '']
    out += ['## 교훈 (먼저 읽기)', '']
    out += [f"{k}. {r['lesson']} — `{r['id']}`" for k, r in enumerate(bad, 1)]
    out += ['', '## 문항별', '']
    for r in bad:
        t = r.get('trap') or next((p['trap'] for p in r.get('also', []) if p.get('trap')), None)
        out += [f"### {r['id']} — 가채점 {r['prev']} → 답지 {r['a']}",
                f"- 근거: {r['art']} 「{r['quote']}」"]
        if t: out.append(f"- 함정: {t.get('orig') or '(끼워 넣음)'} → {t.get('alt') or '(빠뜨림)'}")
        out += [f"- 왜: {r['why']}", f"- 교훈: {r['lesson']}", '']
    return '\n'.join(out)


if __name__ == '__main__':
    db = load(); errs = check(db)
    if errs:
        print('\n'.join('✗ ' + x for x in errs)); sys.exit(f'검사 실패 {len(errs)}건')
    open(os.path.join(HERE, '가채점오류.md'), 'w', encoding='utf8').write(md(db) + '\n')
    bad = sum(r['verdict'] == '가채점오류' for r in db['items'])
    print(f"✓ 답지 {len(db['items'])}문항 (가채점 오류 {bad}) + 추가 {len(db.get('add', []))}문항 → kb/study/가채점오류.md")
