import re, sys, json, os

SP = os.path.dirname(os.path.abspath(__file__))
F = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'base', 'orgmaster.base.html')
P = lambda name: os.path.join(SP, name)
rd = lambda name: open(P(name), encoding='utf8').read()

s = open(F, encoding='utf8').read()

# 1) 게시 시 자동으로 붙는 외곽 틀(doctype/html/head/body)을 걷어내고 본문만 사용
i = s.index('<body>') + len('<body>')
j = s.rindex('</body>')
body = s[i:j].lstrip('\n')
assert body.startswith('<title>'), body[:60]


def rep(old, new, count=1):
    global body
    assert body.count(old) >= 1, old
    body = body.replace(old, new, count)


# 2) 데이터에 규정 목차(lawIndex)를 넣는다 (규정 본문은 별도 파일에서 필요할 때 불러온다)
m = re.search(r'(<script id="data" type="application/json">)(.*?)(</script>)', body, re.S)
D = json.loads(m.group(2))
import study_tables
study_tables.enrich(D)
# 대조·숫자 탭: 규정별 주체 표(원문 대조)·암기 그림·규정별 칩 (study_subject.py)
sys.path.insert(0, P('kb'))
import kb_lib, study_subject
D['tableHtml'] = study_subject.extend(D['tableHtml'], kb_lib.articles(), SP)
D['lawIndex'] = json.load(open(P(os.path.join('site', 'lawindex.json')), encoding='utf8'))
D['quizIndex'] = json.load(open(P(os.path.join('site', 'quizindex.json')), encoding='utf8'))
# 원문 복원본 2024·2025 기출은 선배 앱 기출(past-07·past-08)과 같은 시험이라 빼고, 기록은 번호 대응표로 옮긴다
D['exam'] = [e for e in D['exam'] if e['grp'] not in ('2024', '2025')]
# 스터디 문제: 공식 답지 기준 정답·해설로 덮어쓰고, 답지로 새로 넣은 문항 추가 (kb/study/답지.json)
sys.path.insert(0, P(os.path.join('kb', 'study')))
import check_study
_serr = check_study.check()
if _serr:
    print('\n'.join('✗ ' + x for x in _serr)); sys.exit(f'빌드 멈춤: 스터디 답지 DB 오류 {len(_serr)}건 (kb/study/check_study.py)')
D['stFix'] = check_study.apply(D['exam'])
D['exMap'] = json.load(open(P(os.path.join('site', 'exmap.json')), encoding='utf8'))
# 새 규정 복습 카드 (스터디 1회독 차수 단위)
cn = json.load(open(P(os.path.join('site', 'cards_new.json')), encoding='utf8'))
D['cards'] = D['cards'] + cn['cards']
D['topics'].update(cn['topics'])
D['cardUnits'] = cn['units']
# 기출 근거 DB: 검사를 통과해야 빌드한다. 앱에는 필요한 부분만 줄여 넣는다
sys.path.insert(0, P('kb'))
import check_kb
_A, _E = check_kb.articles(), {x['id']: x for x in check_kb.exam_items()}
_recs = check_kb.load()
_errs = check_kb.check(_recs, _A, _E)
if _errs:
    print('\n'.join('✗ ' + x for x in _errs)); sys.exit(f'빌드 멈춤: 기출 근거 DB 오류 {len(_errs)}건 (kb/check_kb.py)')
_kb = check_kb.build(_recs, _A, _E)
D['kb'] = {
    'items': {i: {'f': r['form'], 'lv': r['level'], 'c': bool(r.get('case')), 'st': r['status'], 'a': r.get('arts', []),
                  't': [[p['trap']['orig'], p['trap']['alt'], p.get('why', '')] for p in r.get('points', []) if p.get('trap')],
                  'n': r.get('note', '')} for i, r in _kb['items'].items()},
    'arts': {k: {'n': v['n'], 'y': v['years']} for k, v in _kb['arts'].items()},
}
print('기출 근거 DB:', len(_kb['items']), '문항,', len(_kb['arts']), '조문')
# 빈칸 경계: 조직법·정관·운영규정(선배 앱 데이터)의 낱말 중간 빈칸 징계[의결] → [징계의결] (blankfix.py)
from blankfix import fix_blanks, glued_left
_flog = []
for a in D['articles']:
    if a['type'] == 'a':
        a['html'] = fix_blanks(a['html'], _flog)
        if glued_left(a['html']): sys.exit(f"빌드 멈춤: 낱말 중간 빈칸 {a['law']} {a['no']} {glued_left(a['html'])}")
print('빈칸 경계 바로잡음', len(_flog), '곳:', ', '.join(sorted(set(_flog))))
# 별표 표 칸에도 숫자·주체·징계 종류 빈칸 (convert_regs 의 표 규칙과 같음) — 이미 빈칸이 있는 칸은 그대로
import html as _H
from convert_regs import blanks as _blanks
def _cell_blanks(m):
    if 'class="b ' in m.group(2): return m.group(0)
    seg = re.split(r'(<[^<>]+>)', m.group(2))
    return m.group(1) + ''.join(x if x.startswith('<') else _blanks(_H.unescape(x), True) for x in seg) + '</td>'
for _k, _v in D['extra'].items():
    D['extra'][_k] = re.sub(r'(<td[^>]*>)(.*?)</td>', _cell_blanks, _v, flags=re.S)
# 게시 도구가 HTML 한 파일만 받으므로, 게시된 data/laws 파일을 바꿀 수 없다. 별표가 바뀐 규정은 페이지에 넣어 파일 내용보다 우선한다
EXTRA_INLINE = ['보수운영규정']
D['extraFix'] = {x['law']: json.load(open(P(os.path.join('site', x['file'])), encoding='utf8'))['extra'] for x in D['lawIndex'] if x['law'] in EXTRA_INLINE}
assert set(D['extraFix']) == set(EXTRA_INLINE), EXTRA_INLINE
# 규정 듣기: tools/tts_build.py 가 만든 음원 목차 (MP3 는 data/tts/ 로 게시)
import glob as _glob
D['tts'] = {}
for _f in sorted(_glob.glob(P(os.path.join('site', 'data', 'tts', '*.json')))):
    _m = json.load(open(_f, encoding='utf8'))
    assert all(os.path.getsize(P(os.path.join('site', _t['file']))) == _t['bytes'] for _t in _m['tracks']), _f
    D['tts'][_m['law']] = _m
# 국제인도법 이해 층(해석·원어·팁·비교·연표): 키가 실제 조문·비교쌍인지 검사
D['ihlStudy'] = json.load(open(P(os.path.join('kb', 'ihl_study.json')), encoding='utf8'))
D['ihlStudy'].pop('_설명', None)
_ihl_nos = {a['no'] for a in json.load(open(P(os.path.join('site', 'data', 'laws', 'ihl.json')), encoding='utf8'))['articles'] if a['type'] == 'a'}
_ihl_bad = [k for k in D['ihlStudy']['arts'] if k not in _ihl_nos] + [p for a in D['ihlStudy']['arts'].values() for p in a.get('pairs', []) if p not in D['ihlStudy']['pairs']] + [s for p in D['ihlStudy']['pairs'].values() for s in p['src'] if s not in _ihl_nos]
if _ihl_bad: sys.exit(f'빌드 멈춤: kb/ihl_study.json 키 오류 {_ihl_bad}')
print('국제인도법 이해 층:', len(D['ihlStudy']['arts']), '절,', len(D['ihlStudy']['pairs']), '비교쌍')
# 국제인도법 원문 그림·박스 연결(kb/ihl_figs.json): 그림 파일은 페이지에 넣고, 절 번호·기준 글자·파일을 검사
import base64 as _b64, re as _re
_figs = json.load(open(P(os.path.join('kb', 'ihl_figs.json')), encoding='utf8'))
_ihl_txt = {a['no']: _re.sub(r'<[^>]+>', '', a['html']) for a in json.load(open(P(os.path.join('site', 'data', 'laws', 'ihl.json')), encoding='utf8'))['articles'] if a['type'] == 'a'}
_fig_bad, _fig_img = [], {}
for _no, _items in _figs['arts'].items():
    if _no not in _ihl_txt: _fig_bad.append(_no); continue
    for _it in _items:
        if _it.get('after') and _it['after'] not in _ihl_txt[_no]: _fig_bad.append(f"{_no}: '{_it['after']}' 없음")
        for _b in _it.get('box', []):
            if _b['no'] not in _ihl_txt or (_b.get('from') and _b['from'] not in _ihl_txt[_b['no']]): _fig_bad.append(f"{_no} → {_b}")
        for _f in _it.get('imgs', []):
            _p = P(os.path.join('kb', 'ihl_figs', _f))
            if not os.path.exists(_p): _fig_bad.append(f'{_no}: {_f} 없음'); continue
            _fig_img[_f] = 'data:image/png;base64,' + _b64.b64encode(open(_p, 'rb').read()).decode()
if _fig_bad: sys.exit(f'빌드 멈춤: kb/ihl_figs.json 오류 {_fig_bad}')
D['ihlFigs'] = {'img': _fig_img, 'arts': _figs['arts']}
print('국제인도법 원문 그림:', len(_fig_img), '개,', len(_figs['arts']), '절')
newdata = json.dumps(D, ensure_ascii=False, separators=(',', ':')).replace('</', '<\\/')
body = body[:m.start(2)] + newdata + body[m.end(2):]

# 3) 기존 선언 중 덮어써야 하는 것만 고친다
rep("const nl = n => '제' + (String(n).includes('의') ? String(n).replace('의','조의') : n + '조');",
    "const nl = n => { const s = String(n); return /^\\d+(의\\d+)?$/.test(s) ? '제' + (s.includes('의') ? s.replace('의','조의') : s + '조') : s; };")
rep("const inTopic = (a, t) =>", "let inTopic = (a, t) =>")
rep("const FS = [", "let FS = [")
rep("const tl = t =>", "let tl = t =>")
rep("if (c._arts) return c._arts;", "if (c._arts) return c._arts; if (c.art) return (c._arts = [c.art]);")
rep("const m = seg.match(/^(조직법|정관|운영규정)/);", "const m = seg.match(new RegExp('^(' + LAW_LIST.join('|') + ')'));")
rep("""`<span class="badge" title="${esc(D.topics[t])}">${tl(t)}</span>`""", """`<span class="badge" title="${esc(tl(t) + ' · ' + D.topics[t])}">${esc(topicShort(t))}</span>`""")
rep(",['2025','2025 기출 (5/23)'],['2024','2024 기출 (5/24)']", "")
rep("const exLabel = e =>", "let exLabel = e =>")
rep('${GROUPS.map(g => `<option value=', '${cardGroups().map(g => `<option value=')
rep("const exAnswers = e => (e.a.match(/[①②③④⑤]/g) || []);", "const exAnswers = e => (e.a.match(/[①②③④⑤⑥]/g) || []);")
rep("bad = X.res.filter(r => !r.ok).map(r => D.exam.find(e => e.id === r.id));", "bad = X.res.filter(r => !r.ok).map(r => exById(r.id));")
rep("X.queue = X.res.filter(r => !r.ok).map(r => D.exam.find(q => q.id === r.id));", "X.queue = X.res.filter(r => !r.ok).map(r => exById(r.id));")

# 동기화 보호: 서버 기록을 받기 전에 시작 코드(기록 이관 등)가 save() 를 부르면 upd 가 서버보다 새것이 되어
# 기록 없는 브라우저의 빈 기록이 서버를 덮었다(2026-10-17 사고). 첫 동기화 전에는 기기에만 저장하고 upd 는 그대로 둔다.
rep("let DBR = null, syncTimer = null, pushing = false, dirty = false;",
    "let DBR = null, syncTimer = null, pushing = false, dirty = false, SYNC_WAIT = !!(window.claude && window.claude.use);")
rep("function save(){\n  S.upd = Date.now();",
    "function save(){\n  if (SYNC_WAIT){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} return; }\n  S.upd = Date.now();")
rep("const db = await window.claude.use('db'); if (!db) return;", "const db = await window.claude.use('db'); if (!db){ SYNC_WAIT = false; return; }")
rep("setSync('☁ 동기화됨'); applySeeds();", "SYNC_WAIT = false; setSync('☁ 동기화됨'); applySeeds();")
# 서버를 못 읽었으면 이번에는 기기에만 저장한다(upd 를 올리면 다음에 이 기기의 기록이 서버를 덮을 수 있다)
rep("} catch(e){ setSync(''); applySeeds(); }", "} catch(e){ DBR = null; setSync('☁ 서버 연결 안 됨 · 기기에만 저장'); applySeeds(); }")

# ux8: 진행 중인 뻥뚫·기출 화면도 다른 기기 기록이 들어올 때 다시 그리지 않는다 (입력이 날아가지 않게)
rep("if (!(cur === 'quiz' && Q.sess)) { if (renderers[cur]) renderers[cur](); }",
    "if (!((cur === 'quiz' && Q.sess) || (cur === 'bt' && BT.sess) || (cur === 'exam' && X.sess))) { if (renderers[cur]) renderers[cur](); }")
# ux4: ✕ 로 회독에서 뺀 조문(S.rskip)은 이어 읽기·진도 분모에서 제외한다
rep("function candArts(){ const l = lawArts(); return l.filter(a => inTopic(a, R.topic)); }",
    "function rdSkip(k){ return !!(S.rskip && S.rskip[k]); }\nfunction candArts(){ const l = lawArts(); return l.filter(a => inTopic(a, R.topic) && !rdSkip(artId(a))); }")
rep("const arts = list.filter(a => a.type === 'a');", "const arts = list.filter(a => a.type === 'a' && !rdSkip(artId(a)));")
# ux8: 회독 진도는 '지금 회독'(범위 최소 회독 + 1) 기준 — 1회독 뒤에도 2·3회독으로 이어진다 (readRound 는 ux8.js)
rep("if (as.length) hInfo[i] = {as, read: as.filter(a => S.reads[artId(a)] > 0).length};",
    "if (as.length){ const on = as.filter(a => !rdSkip(artId(a))), rn = readRound(on); hInfo[i] = {as, on, rn, read: on.filter(a => (S.reads[artId(a)] || 0) >= rn).length}; }")
rep("${f.as.length}개 조 · 1회독 ${f.read}/${f.as.length}`", "${f.on.length}개 조 · ${f.rn}회독 ${f.read}/${f.on.length}`")
rep("pct(f.read, f.as.length)", "pct(f.read, f.on.length)")
rep("$('#r-prog').textContent = `1회독 이상 ${read}/${arts.length}조 (${pct(read, arts.length)}%) · ",
    "const ca = candArts(), rr = readRound(ca), rd2 = ca.filter(a => (S.reads[artId(a)] || 0) >= rr).length;\n  $('#r-prog').textContent = `${rr}회독 진행 ${rd2}/${ca.length}조 (${pct(rd2, ca.length)}%) · 1회독 이상 ${read}/${arts.length}조 · ")
rep("lbl = rt ? `▶ 이어 읽기 · ${nl(rt.no)}` : '✅ 1회독 완료';", "lbl = rt ? `▶ ${rr}회독 · ${nl(rt.no)}` : '▶ 이어 읽기';")
rep("$('#fab-resume').textContent = rt ? `▶ ${nl(rt.no)}` : '✅ 완료';", "$('#fab-resume').textContent = rt ? `▶ ${rr}회독 · ${nl(rt.no)}` : '▶';")

# 4) 새 탭 영역, 탭 목록, CSS, JS 를 덧붙인다 (기존 코드는 가급적 수정하지 않음)
rep('<section class="pane" id="p-exam"></section>', '<section class="pane" id="p-exam"></section>\n<section class="pane" id="p-rev"></section>')
rep("['exam','🗂 기출·오답'],", "['exam','🗂 기출·오답'],['rev','🆕 개정'],")
rep('<section class="pane" id="p-read"></section>', '<section class="pane" id="p-read"></section>\n<section class="pane" id="p-bt"></section>')
rep("['read','📖 회독'],", "['read','📖 회독'],['bt','🕳 뻥뚫'],")
rep("['cho','🔤 자음퀴즈'],", "")

css = ''.join(rd(n) for n in ['rev-tab.css', 'ux-polish.css', 'ux2.css', 'ux4.css', 'ui7.css', 'ux8.css', 'op-study.css', 'card-review.css', 'case-bl.css', 'tts.css', 'wage.css', 'ihl-study.css'])
k = body.index('</style>')
body = body[:k] + css + '\n' + body[k:]
js = ''.join(rd(n) for n in ['lawdata.js', 'rev-tab.js', 'ux-polish.js', 'ux2.js', 'ux3.js', 'plan-gen.js', 'ux4.js', 'ux5.js', 'ux6.js', 'ui7.js', 'kb-ui.js', 'ux8.js', 'op-study.js', 'card-review.js', 'case-bl.js', 'tts.js', 'table-cat.js', 'resume.js', 'ihl-study.js'])
rep('/* 시작 */', js + '\n/* 시작 */')
# ui7 디자인 층: 첫 화면을 그린 뒤 시작 (아이콘·칩·테마 전환)
rep("|| 'today');\n</script>", "|| 'today');\nUI7.start();\n</script>")
# 글꼴: Pretendard 가 있으면 그것, 없으면 같은 계열의 Noto Sans KR. 숫자는 JetBrains Mono
rep('<title>승진고시 마스터</title>', '<title>승진고시 마스터</title>\n<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
    '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;700&family=Noto+Sans+KR:wght@400..800&display=swap">')

open(P('orgmaster.html'), 'w', encoding='utf8', newline='\n').write(body)
print('body chars', len(body), 'bytes', len(body.encode('utf8')))

# 테스트용: 게시 때 자동으로 붙는 외곽 틀(viewport meta 포함)을 붙인 복사본
wrapped = s[:i] + body + '\n</body></html>'
open(P('orgmaster.wrapped.html'), 'w', encoding='utf8', newline='\n').write(wrapped)
# 규정 파일과 같은 폴더 구조로 둔 테스트 사이트 (로컬 서버로 띄워 fetch 까지 점검)
os.makedirs(P('site'), exist_ok=True)
open(P(os.path.join('site', 'index.html')), 'w', encoding='utf8', newline='\n').write(wrapped)
