"""선배 앱 규정 데이터(regs.json) -> 아티팩트용 규정 JSON (조문별 HTML + 빈칸 자동 표시)
실행: python -X utf8 convert_regs.py
"""
import json, re, os, html as H
from blankfix import fix_blanks, glued_left

SP = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(SP, 'regs.json')
OUT = os.path.join(SP, 'site', 'data', 'laws')
os.makedirs(OUT, exist_ok=True)

# (원본 이름, 아티팩트에서 쓸 이름(공백 없음), 파일 id)
LAWS = [
    ('인사관리 시행규칙', '인사관리시행규칙', 'personnel'),
    ('보수운영규정', '보수운영규정', 'compensation'),
    ('재무규정', '재무규정', 'finance'),
    ('여비규정', '여비규정', 'travel'),
    ('감사운영규정', '감사운영규정', 'audit'),
    ('유관법령', '유관법령', 'related'),
    ('국제인도법 질문과 답변', '국제인도법', 'ihl'),
    ('규약', '국제적십자규약', 'covenant'),
]

# ───────── 빈칸 규칙 ─────────
UNIT = r'명|인|개월|개소|개|년|월|일|주|시간|분|세|회(?!계|의록|장|원|비|기|보|사|관)|차|건|%|퍼센트|원|만원|천원|억원|배|급|호봉|종|단계|점|부|매|시|곳'
QUAL = r'(?:\s*(?:이상|이하|미만|초과|이내|이전|이후|까지|부터|마다))?'
SUBJ_BODY = r'전국대의원총회|중앙위원회|운영위원회|인사위원회|징계위원회|심의위원회|심사위원회|감사위원회|보수위원회|자문위원회|위원회'
SUBJ_PERSON = r'(?:[가-힣]{2,6}부)?장관|대통령|국무총리|국회|소속기관장|기관장|지사회장|지사부회장|부회장|사무총장|재정감독|법률고문|명예회장|회장|병원장|본부장|센터장|실장|국장|처장|팀장|위원장|원장'
VERBS = r'인가|승인|인준|의결|심의|동의|협의|통보|통지|신고|제출|결정|임명|위촉|선출|호선|해임|면직|허가|확정|보고'
RX = re.compile(
    r'(?P<prot>제\d+(?:조|항|호|장|절|목|편|문)(?:의\d+)?|별표\s*제?\d+호?(?:의\d+)?|「[^」]*」|\d{4}\.\d{1,2}\.\d{1,2}\.?)'
    r'|(?P<b1>\d+분의\s*\d+' + QUAL + r'|\d+(?:,\d{3})*(?:\.\d+)?\s*(?:' + UNIT + r')' + QUAL + r'|과반수|전원|(?:한|두|세|네)\s*차례'
    r'|(?<![가-힣])(?:' + SUBJ_BODY + r'|' + SUBJ_PERSON + r'))'
    r'|(?P<b2>(?<![가-힣])(?:' + VERBS + r')(?!서|자|권|기))'
)
LEAD = re.compile(r'^(?:[①-⑳]|\d+(?:의\d+)?\.(?=\s|[가-힣<「])|[가-힣]\.(?=\s)|\d+\)(?=\s)|\(\d+\)|[가-힣]\)(?=\s)|[-·ㆍ○●▶◦])\s*')
AMEND = re.compile(r'^<((?:개정|신설|삭제|전문개정|본조신설|폐지|종전|이동)[^<>]*|\d{4}\.[^<>]*)>$')


def esc(s):
    return H.escape(s, quote=False)


# 선배 앱 원본은 괄호 ( ) 대신 ~ ~ 로 적어 두었다 (예: "입후보 등록 ~예비후보자 등록 포함~ 을").
# 범위 표시(1~3)는 원본에 없음을 확인했으므로, 한 줄 안의 ~짝~ 은 모두 괄호로 되돌린다.
# 괄호 뒤가 조사·어미면 띄어쓰기를 붙인다: "등록 ~…~ 을 할" → "등록(…)을 할"
TILDE = re.compile(r'\s*~([^~\n]+?)~(\s*)')
JOSA = re.compile(r'[을를이가은는의에와과로으도만하되,.]')   # 괄호 바로 뒤에 붙는 조사·어미·문장부호


RANGE = re.compile(r'(?<=[\d급년호월일세상만])~(?=\s*\d)')   # 범위(3~4급, 1급~4급, 5년이상~10년미만)는 그대로 둔다
KEEP = ''


def paren(s):
    s = RANGE.sub(KEEP, s)
    def one(m):
        tail = '' if JOSA.match(s, m.end()) else m.group(2)
        return f'({m.group(1).strip()})' + tail
    return TILDE.sub(one, s).replace(KEEP, '~')


TBL_B1 = re.compile(r'(?<![가-힣])(?:파면|해임|강등|정직|감봉|견책|불문)(?![가-힣])')   # 별표 표 칸의 징계 종류 (본문 카드에는 쓰지 않음)


def blanks(text, table=False):
    out, pos = [], 0
    for m in (_tbl_iter(text) if table else RX.finditer(text)):
        out.append(esc(text[pos:m.start()]))
        t = m.group(0)
        if m.lastgroup == 'prot':
            out.append(esc(t))
        elif m.lastgroup == 'b1':
            out.append(f'<span class="b b1">{esc(t)}</span>')
        else:
            out.append(f'<span class="b b2">{esc(t)}</span>')
        pos = m.end()
    out.append(esc(text[pos:]))
    return ''.join(out)


def _tbl_iter(text):
    ms = list(RX.finditer(text))
    for m in TBL_B1.finditer(text):
        ms = [x for x in ms if not (x.lastgroup == 'b2' and x.start() < m.end() and m.start() < x.end())]   # 해임 은 동사가 아니라 징계 종류
        if not any(x.start() < m.end() and m.start() < x.end() for x in ms):
            ms.append(type('M', (), {'start': lambda self, g=m: g.start(), 'end': lambda self, g=m: g.end(),
                                     'group': lambda self, i=0, g=m: g.group(0), 'lastgroup': 'b1'})())
    return sorted(ms, key=lambda x: x.start())


def inline(line):
    lm = LEAD.match(line)
    lead, rest = (lm.group(0), line[lm.end():]) if lm else ('', line)
    parts = re.split(r'(</?strong>|<[^<>]{1,120}>)', rest)
    out = [esc(lead)]
    for p in parts:
        if not p:
            continue
        if p == '<strong>':
            out.append('<b>')
        elif p == '</strong>':
            out.append('</b>')
        elif AMEND.match(p):
            out.append(f'<span class="amend">&lt;{esc(AMEND.match(p).group(1))}&gt;</span>')
        elif p.startswith('<') and p.endswith('>') and len(p) <= 122 and re.match(r'^<[^<>]+>$', p):
            out.append(esc(p))
        else:
            out.append(blanks(p))
    return ''.join(out)


def classify(line):
    if re.match(r'^[①-⑳]', line):
        return 'ln'
    if re.match(r'^\d+(?:의\d+)?\.(?=\s|[가-힣<「])', line):
        return 'ln it'
    if re.match(r'^[가-힣]\.(?=\s)', line):
        return 'ln it2'
    if re.match(r'^\(\d+\)|^\d+\)(?=\s)|^[가-힣]\)(?=\s)', line):
        return 'ln it3'
    if re.match(r'^[-·ㆍ○●▶◦]', line):
        return 'ln it2'
    return 'ln'


def text_html(text):
    rows = []
    for raw in re.split(r'\r?\n|\n\r?', text):
        line = paren(raw.strip())
        if not line:
            continue
        rows.append(f'<div class="{classify(line)}">{inline(line)}</div>')
    return ''.join(rows)


def parse_table(t):
    for _ in range(3):
        if isinstance(t, str):
            try:
                t = json.loads(t.strip())
            except Exception:
                return None
        else:
            break
    return t if isinstance(t, dict) and (t.get('rows') or t.get('headers')) else None


def split_row(r):
    """칸마다 같은 수의 줄이 든 행(대상 8줄 ↔ 금액 8줄)을 줄마다 한 행으로 나눈다.
    칸 하나에 몰아 두면 긴 줄이 접힐 때 대상과 금액이 어긋나 보인다. 줄 수가 다른 칸이 있으면 대응이 불확실하므로 그대로 둔다."""
    cells = ['' if c is None else str(c) for c in r]
    lines = [c.split('\n') if c.strip() else [] for c in cells]
    filled = {len(x) for x in lines if x}
    if sum(1 for x in lines if x) < 2 or len(filled) != 1 or min(filled) < 2:
        return [r]
    return [[x[i] if x else '' for x in lines] for i in range(min(filled))]


def table_html(t):
    t = parse_table(t)
    if not t:
        return ''
    bold = lambda s, f: ''.join({'<strong>': '<b>', '</strong>': '</b>'}.get(p) or f(p) for p in re.split(r'(</?strong>)', s) if p)   # 표 칸의 개정 강조도 본문(inline)처럼 <b>
    cell = lambda c: bold(paren(str(c if c is not None else '')), esc).replace('\n', '<br>')
    bcell = lambda c: bold(paren(str(c if c is not None else '')), lambda p: blanks(p, True)).replace(chr(10), '<br>')   # 본문 칸은 숫자·주체·동사 빈칸도 만든다
    h = ''
    if t.get('headers'):
        h += '<tr>' + ''.join(f'<th>{cell(c)}</th>' for c in t['headers']) + '</tr>'
    for r in t.get('rows') or []:
        for row in split_row(r):
            h += '<tr>' + ''.join(f'<td>{bcell(c)}</td>' for c in row) + '</tr>'
    return f'<div class="tw"><table>{h}</table></div>'


def content_html(content):
    if isinstance(content, str):
        s = content.strip()
        if s[:1] in '{[':
            try:
                content = json.loads(s)
            except Exception:
                pass
    if isinstance(content, str):
        return text_html(content)
    if isinstance(content, list):
        out = ''
        for it in content:
            if it.get('type') == 'text' and it.get('text'):
                out += text_html(str(it['text']))
            elif it.get('type') == 'table' and it.get('table'):
                out += table_html(it['table'])
        return out
    if isinstance(content, dict):
        out = ''
        if content.get('html'):   # 인사서식처럼 hwpx 에서 뽑아 둔 HTML 은 그대로
            out += content['html']
        if content.get('table'):
            out += table_html(content['table'])
        if content.get('text'):
            out += text_html(str(content['text']))
        if not content.get('table') and (content.get('rows') or content.get('headers')):
            out += table_html(content)
        return out
    return ''


BYEOL_NO = re.compile(r'^(?:별표|(인사서식))\s*제(\d+)호(?:의(\d+))?$')
STD = re.compile(r'^제(\d+)조(?:의(\d+))?$')
FIXLOG = []


def convert(src_name, law, fid, regs):
    r = next(x for x in regs if x['name'] == src_name)
    arts, heads, extra = [], [], []
    used = set()
    chidx = 0
    byeol = []
    for c in r['chapters']:
        num = (c.get('number') or '').strip()
        title = (c.get('title') or '').strip()
        is_b = num.startswith('별표')
        if not is_b:
            chidx += 1
            htxt = (num + ' ' + title).strip() or '서문'
            arts.append({'type': 'h', 'lv': 1, 'text': htxt})
            heads.append({'i': chidx, 'title': htxt})
        prefix = ''
        mm = re.match(r'^제\d+[문장편]$', num)
        prefix = num if mm else (title or num)
        for a in c['articles']:
            n = (a.get('number') or '').strip()
            t = (a.get('title') or '').strip()
            body = content_html(a.get('content'))
            if is_b or n.startswith('별표') or n.startswith('인사서식'):
                label = n if n.startswith(('별표', '인사서식')) else '별표 ' + n
                am = f' <span class="amend">&lt;{esc(a["amend"])}&gt;</span>' if a.get('amend') else ''
                body = fix_blanks(body, FIXLOG)   # 별표 안 운[전원] → [운전원]
                assert not glued_left(body), (law, label, glued_left(body))
                extra.append(f'<div class="chap">[{esc(label)}]{am}</div>' + (f'<div class="ln"><b>{esc(t)}</b></div>' if t else '') + body)
                m = BYEOL_NO.match(label)
                if m:   # 키: 별표 제5호의2 → '5의2', 인사서식 제25호 → '서25'
                    byeol.append(('서' if m.group(1) else '') + m.group(2) + ('의' + m.group(3) if m.group(3) else ''))
                continue
            m = STD.match(n)
            if m:
                no = m.group(1) + ('의' + m.group(2) if m.group(2) else '')
            else:
                no = (prefix + ' ' + n).strip() if n else (title or '본문')
            if fid == 'related' and n:   # 유관법령은 장 하나가 법령 하나이므로 항상 법령 이름을 붙인다
                no = (title + ' ' + n).strip()
            if no in used:  # 부칙 등에서 번호가 겹치면 장 이름을 앞에 붙여 구분
                no = (title or num or '부칙') + ' ' + (('제' + no + '조') if m else n)
            k = 2
            base = no
            while no in used:
                no = f'{base} #{k}'; k += 1
            used.add(no)
            body = fix_blanks(body, FIXLOG)   # 낱말 중간 빈칸(제[2차]) → [제2차]
            assert not glued_left(body), (law, no, glued_left(body))
            arts.append({'type': 'a', 'no': no, 'title': t, 'topics': [], 'ch': chidx, 'html': body})
    data = {'law': law, 'label': src_name, 'id': fid, 'articles': arts, 'extra': ''.join(extra)}
    index = {'law': law, 'label': r['name'], 'id': fid, 'file': f'data/laws/{fid}.json',
             'count': sum(1 for a in arts if a['type'] == 'a'),
             'keys': [a['no'] for a in arts if a['type'] == 'a'], 'byeol': list(dict.fromkeys(byeol)), 'chapters': heads}
    return data, index


if __name__ == '__main__':
    regs = json.load(open(SRC, encoding='utf8'))
    idx = []
    for src_name, law, fid in LAWS:
        data, index = convert(src_name, law, fid, regs)
        p = os.path.join(OUT, fid + '.json')
        json.dump(data, open(p, 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
        idx.append(index)
        n_b1 = sum(a['html'].count('class="b b1"') for a in data['articles'] if a['type'] == 'a')
        n_b2 = sum(a['html'].count('class="b b2"') for a in data['articles'] if a['type'] == 'a')
        print(f"{law}: 조문 {index['count']}, 장 {len(index['chapters'])}, 별표 {len(index['byeol'])}(+기타), 빈칸 b1 {n_b1} / b2 {n_b2}, 파일 {os.path.getsize(p)//1024}KB")
    print('빈칸 경계 바로잡음', len(FIXLOG), '곳:', ', '.join(sorted(set(FIXLOG))))
    json.dump(idx, open(os.path.join(SP, 'site', 'lawindex.json'), 'w', encoding='utf8'), ensure_ascii=False, separators=(',', ':'))
