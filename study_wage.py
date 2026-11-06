"""대조·숫자 18번 표 아래: 통상임금·지급기준액·평균임금 구분 + 평균임금 계산 예제.

화면은 [개념 비교] [계산 따라가기] [가리고 풀기] 세 단계 칩(table-cat.js 가 전환).
빌드 때 확인하는 것
- 인용 조각이 kb 원문(kb_lib.articles)에 글자 그대로 있는지
- 통상임금 11개 − 지급기준액 제외 3개 = 지급기준액 8개 (제3조 2호·10호에서 직접 셈)
- 상여수당 월할금액(제3조 11호)·평균임금 단서(9호) 열거 항목이 표와 같은지
- 예제 합계(1,050 / 885만 원)와 1일 평균임금
어긋나면 ValueError 로 빌드를 멈춘다.
"""
import html
import re

LAW = '보수운영규정'
A3 = f'{LAW}:3'

# 원문 인용 (조문 키, 조각) — 화면에 “ ” 로 그대로 보여 주는 것만
Q = {
    'pay2': (A3, '봉급과 업무수당, 위험수당, 장기근속수당, 출납수당, 전산업무수당, 직급보조비, 처우개선비, 직책보조비, 의사 및 약사 등 확보조정비, 상여수당 월할금액을 포함한 금액(이하 “통상임금”이라 한다)'),
    'avg9': (A3, '“평균임금”이란 이를 산정하여야 할 사유가 발생한 날 이전 3개월간에 그 직원에게 지급된 임금총액을 그 기간의 총 일수로 나눈 금액을 말한다.'),
    'avg9d': (A3, '다만, 하계‧명절상여금, 실적평가급 및 연가보상비에 대하여는 산정일 이전 1년간 지급받은 총액을 12개월로 나누어 평균임금 산정기초에 산입한다.'),
    'base10': (A3, '상여수당의 “지급기준액”이란 통상임금 중 직책보조비, 의사 및 약사 등 확보조정비, 상여수당 월할금액을 제외한 금액을 말한다.'),
    'm11': (A3, '“상여수당 월할금액”이란 정기·하계·명절상여의 연간 지급액을 합산하여 12개월로 나눈 금액을 말한다.'),
    'wage3': (A3, '“임금”이란 근로의 대상으로 직원에게 고정적, 일률적으로 지급하는 보수 및 일체의 금품을 말한다.'),
    'reg': (f'{LAW}:11의2', '직원에게는 매월 20일(지급기준일)에 정기상여금을 지급할 수 있다.'),
    'sum': (f'{LAW}:12', '직원에게는 매년 7월 20일에 하계상여금을, 추석 이전 15일 이내와 설날 이전 15일 이내에 각각 명절상여금을 지급할 수 있다.'),
    'perf': (f'{LAW}:13', '다음 연도 5월 이전에 지급할 수 있으며'),
    'leave': (f'{LAW}:26', '매년 1월 15일에 연가보상비를 지급한다.'),
    'ret': (f'{LAW}:49', '전항의 평균임금은 보수와 상여금, 실적평가급, 연가보상비, 특별근무수당으로 한다.'),
}
BASE8 = ['봉급', '업무수당', '위험수당', '장기근속수당', '출납수당', '전산업무수당', '직급보조비', '처우개선비']
EXCL3 = ['직책보조비', '의사 및 약사 등 확보조정비', '상여수당 월할금액']

# 예제 (만 원): 항목, 최근 3개월 실제 지급액, 이전 1년 지급액(None = 확인 불필요), 원문 칩
ROWS = [
    ('봉급', 600, None, ['3', '3']),
    ('정기상여금', 150, None, ['3', '11의2']),
    ('하계상여금', 60, 60, ['3', '12']),
    ('명절상여금', 0, 120, ['3', '12']),
    ('실적평가급', 240, 240, ['3', '13']),
    ('연가보상비', 0, 120, ['3', '26']),
]
DAYS = 90
EXPECT = {'recent': 1050, 'reflect': 885, 'daily': '98,333.33'}

e = lambda s: html.escape(s, quote=False)
_norm = lambda s: re.sub(r'\s+', '', s.replace('‧', '·'))


def chip(no, label):
    return f'<button class="kbchip" data-kbart="{LAW}:{no}">{e(label)}</button>'


def quote(key, label):
    art, q = Q[key]
    q = q if q.startswith('“') else '“' + q + '”'
    return f'<blockquote class="wg-q">{e(q)}<span class="wg-src">{chip(art.split(":")[1], label)}</span></blockquote>'


def check(arts):
    for k, (art, q) in Q.items():
        a = arts.get(art)
        if not a or _norm(q) not in _norm(a['text']):
            raise ValueError(f'통상·평균임금 표 원문 불일치: {art} / {q}')
    t = arts[A3]['text']
    m = re.search(r'봉급과 (.+?)을 포함한 금액\(이하 “통상임금”', t)
    pay = ['봉급'] + [x.strip() for x in m[1].split(',')]
    if len(pay) != 11:
        raise ValueError(f'통상임금 구성 {len(pay)}개: {pay}')
    m = re.search(r'통상임금 중 (.+?)을 제외한 금액', t)
    excl = [x.strip() for x in m[1].split(',')]
    if excl != EXCL3:
        raise ValueError(f'지급기준액 제외 항목 변경: {excl}')
    if [x for x in pay if x not in excl] != BASE8:
        raise ValueError(f'지급기준액 8개 불일치: {[x for x in pay if x not in excl]}')
    m = re.search(r'“상여수당 월할금액”이란 (.+?)의 연간 지급액', t)
    if m[1] != '정기·하계·명절상여':
        raise ValueError(f'상여수당 월할금액 열거 변경: {m[1]}')
    m = re.search(r'다만, (.+?)에 대하여는 산정일 이전 1년간', t)
    if _norm(m[1]) != _norm('하계·명절상여금, 실적평가급 및 연가보상비'):
        raise ValueError(f'평균임금 단서 열거 변경: {m[1]}')
    yr = {n for n, _, y, _ in ROWS if y is not None}
    if yr != {'하계상여금', '명절상여금', '실적평가급', '연가보상비'}:
        raise ValueError(f'예제 단서 항목 불일치: {yr}')


def reflect(recent, year):
    if year is None:
        return recent
    if year * 3 % 12:
        raise ValueError(f'예제 금액이 3개월분으로 나누어떨어지지 않음: {year}')
    return year * 3 // 12


def totals():
    r = sum(x[1] for x in ROWS)
    f = sum(reflect(x[1], x[2]) for x in ROWS)
    daily = f'{f * 10000 / DAYS:,.2f}'
    got = {'recent': r, 'reflect': f, 'daily': daily}
    if got != EXPECT:
        raise ValueError(f'예제 합계 불일치: {got}')
    return r, f, daily


def flow(name, recent, year):
    if year is None:
        why = '제3조 9호 본문: 이전 3개월간 지급된 임금총액' + ('. 단서 목록에 없으므로 본문 원칙대로' if name == '정기상여금' else '')
        return f'최근 3개월 실제 지급액 {recent}만 원 → 그대로 산정기초에 반영 <small class="mute">({why})</small>'
    s = (f'이전 1년 지급액 {year}만 원 → 12개월로 펴면 월 {year / 12:g}만 원 → '
         f'3개월에 대응하는 금액은 {reflect(recent, year)}만 원 → 평균임금 산정기초에 반영')
    if recent:
        s += f'<br><small class="mute">최근 3개월에 받은 {recent}만 원은 따로 더하지 않습니다(중복 금지). 1년치에 이미 들어 있습니다.</small>'
    else:
        s += '<br><small class="mute">최근 3개월에 0원을 받았어도 1년치로 반영합니다.</small>'
    return s


def concept():
    rows1 = [
        ('통상임금', '규정상 <b>11개</b> 구성 항목. 그중 하나가 상여수당 월할금액', chip('3', '제3조 2호')),
        ('상여수당 월할금액', '<b>정기·하계·명절상여</b>의 연간 지급액 합계 ÷ 12', chip('3', '제3조 11호')),
        ('지급기준액', '통상임금에서 직책보조비·의사 및 약사 등 확보조정비·상여수당 월할금액 <b>제외</b>', chip('3', '제3조 10호')),
        ('평균임금', '원칙적으로 사유 발생일 이전 <b>3개월간</b> 지급된 임금총액 ÷ 그 기간의 총일수', chip('3', '제3조 9호')),
    ]
    t1 = ''.join(f'<tr><th scope="row">{a}</th><td>{b}</td><td>{c}</td></tr>' for a, b, c in rows1)
    rows2 = [
        ('정기상여금', '포함', '최근 3개월 실제 지급액', [chip('3', '3조 11호'), chip('11의2', '11조의2①'), chip('3', '3조 9호 본문')]),
        ('하계상여금', '포함', '이전 1년 지급액 ÷ 12 × 3', [chip('3', '3조 11호'), chip('3', '3조 9호 단서')]),
        ('명절상여금', '포함', '이전 1년 지급액 ÷ 12 × 3', [chip('3', '3조 11호'), chip('3', '3조 9호 단서')]),
        ('실적평가급', '포함하지 않음', '이전 1년 지급액 ÷ 12 × 3', [chip('3', '3조 9호 단서'), chip('13', '13조①')]),
        ('연가보상비', '포함하지 않음', '이전 1년 지급액 ÷ 12 × 3', [chip('3', '3조 9호 단서'), chip('26', '26조①')]),
    ]
    t2 = ''.join(f'<tr><th scope="row">{a}</th><td class="{"wg-no" if "않음" in b else "wg-yes"}">{b}</td><td>{c}</td><td class="wg-refs">{"".join(r)}</td></tr>' for a, b, c, r in rows2)
    myth = [
        '‘1년치 ÷ 12’는 최종 평균임금 일액이 아니라 <b>월평균 반영액</b>이다.',
        '평균임금 계산의 기준 기간은 여전히 <b>최근 3개월</b>이다.',
        '예외 항목은 최근 3개월 실제 지급액과 환산한 3개월분을 <b>중복해서 더하지 않는다</b>.',
        f'네 항목이 모두 1년에 한 번 지급되는 것은 아니다 — 명절상여금은 추석·설날 각각 지급 {chip("12", "12조①")}',
        '통상임금의 상여수당 월할금액을 평균임금에 별도 항목으로 또 더하지 않는다(평균임금은 실제 지급된 임금총액으로 센다).',
        '정확한 명칭: ‘실적평가급’, ‘상여수당 월할금액’, ‘의사 및 약사 등 확보조정비’.',
    ]
    return (
        '<p class="wg-goal">목적 — 세 금액이 <b>무엇으로</b> 이루어지는지 구분합니다.</p>'
        f'<div class="tw"><table class="wg-t"><tr><th>구분</th><th>핵심</th><th>원문</th></tr>{t1}</table></div>'
        '<details class="wg-more"><summary>지급기준액에 들어가는 8개</summary>'
        f'<p>{" · ".join(BASE8)}</p><p class="mute small">통상임금 11개 − 책·의·상 3개 = 8개. 직급보조비는 들어가고 직책보조비는 빠집니다.</p>'
        f'{quote("pay2", "제3조 2호")}{quote("base10", "제3조 10호")}</details>'
        '<h4 class="wg-h">같은 상여, 두 계산</h4>'
        f'<div class="tw"><table class="wg-t"><tr><th>항목</th><th>통상임금의 ‘상여수당 월할금액’에 포함</th><th>평균임금 반영 방식<br><small>= 평균임금 산정에 반영할 3개월분</small></th><th>원문</th></tr>{t2}</table></div>'
        '<p class="mute small">정기상여금은 단서 목록에 없을 뿐 빠지는 것이 아닙니다. 매월 지급되므로 본문 원칙(이전 3개월간 임금총액)대로 실제 지급액이 들어갑니다(해석: 제3조 9호 본문 + 제11조의2①, 퇴직금 평균임금 구성은 제49조②).</p>'
        f'<p class="wg-refs">{chip("11의2", "제11조의2①")}{chip("49", "제49조②")}</p>'
        f'{quote("avg9", "제3조 9호 본문")}{quote("avg9d", "제3조 9호 단서")}{quote("m11", "제3조 11호")}'
        '<p class="wg-calcnote"><span class="wg-tag">설명용 계산 · 원문 아님</span> 연간 지급총액 ÷ 12 × 3 = 3개월에 대응하는 반영액. 원문은 “12개월로 나누어 … 산정기초에 산입”까지이고, × 3 은 기준 기간 3개월에 맞춘 풀이입니다.</p>'
        '<div class="wg-mn"><p class="wg-mnt">통상은 정·하·명 / 평균 예외는 하·명·실·연 / 지급기준액은 책·의·상 빼기</p>'
        '<p class="small">책·의·상 = 직책보조비 / 의사 및 약사 등 확보조정비 / 상여수당 월할금액</p>'
        '<p class="small mute">원문 단서는 ‘하계‧명절상여금 / 실적평가급 / 연가보상비’ 3묶음이지만, 하계와 명절을 나누어 ‘하·명·실·연’ 4항목으로 외웁니다.</p></div>'
        '<details class="wg-more"><summary>오해 방지 6줄</summary><ul class="wg-myth">'
        + ''.join(f'<li>{m}</li>' for m in myth) + '</ul></details>'
    )


def calc():
    r, f, daily = totals()
    trs = []
    for name, recent, year, arts in ROWS:
        rf = reflect(recent, year)
        last = f'{year} ÷ 12 × 3 = <b>{rf}</b>' if year is not None else f'<b>{rf}</b>'
        hl = ' wg-hl' if name in ('명절상여금', '실적평가급') else ''
        trs.append(
            f'<tr class="wg-row{hl}"><th scope="row"><button class="wg-rb" data-wgrow aria-expanded="false">{name}</button></th>'
            f'<td class="n">{recent}</td><td class="n">{year if year is not None else "<span class=mute>확인 불필요</span>"}</td><td class="n">{last}</td></tr>'
            f'<tr class="wg-flow" hidden><td colspan="4">{flow(name, recent, year)} {chip(arts[1], "원문")}</td></tr>')
    return (
        '<p class="wg-goal">목적 — 항목마다 <b>어떤 금액</b>을 가져오는지 따라갑니다. 행을 누르면 계산 순서가 펼쳐집니다.</p>'
        f'<p class="wg-assume"><span class="wg-tag">연습용 가정</span> 다른 지급 항목은 없고, 대상 3개월의 총일수는 {DAYS}일로 가정합니다. 실제로는 해당 3개월의 총일수를 씁니다. 금액 단위: 만 원.</p>'
        '<div class="tw"><table class="wg-t wg-calc"><tr><th>항목</th><th>최근 3개월<br>실제 지급액</th><th>이전 1년<br>지급액</th><th>평균임금 산정에<br>반영할 3개월분</th></tr>'
        + ''.join(trs) +
        f'<tr class="wg-sum"><th scope="row">합계</th><td class="n">{r:,}</td><td class="n">—</td><td class="n"><b>{f:,}</b></td></tr></table></div>'
        f'<p class="wg-res">평균임금 = {f * 10000:,}원 ÷ {DAYS}일 = 1일 약 <b>{daily}원</b> {chip("3", "제3조 9호")}</p>'
        '<ul class="wg-vs"><li><b>명절상여금</b>: 최근 3개월에 0원을 받았어도 <b>30만 원</b> 반영</li>'
        '<li><b>실적평가급</b>: 최근 3개월에 240만 원을 받았어도 <b>60만 원</b> 반영</li></ul>'
        '<p class="mute small">‘÷ 12’ 로 얻는 것은 월평균 반영액(예: 명절 월 10만 원)이고, 1일 평균임금은 마지막에 3개월분 합계를 총일수로 나눠서 나옵니다.</p>'
    )


TRAPS = [
    ('정기상여금은 평균임금에서 제외된다.', 'X', '‘1년치 ÷ 12’ 예외 목록에 없을 뿐, 최근 3개월 실제 지급액으로 반영한다.', [('3', '제3조 9호'), ('11의2', '제11조의2①')]),
    ('실적평가급은 통상임금의 상여수당 월할금액에 포함된다.', 'X', '제3조 제11호는 정기·하계·명절상여를 열거한다.', [('3', '제3조 11호')]),
    ('하계·명절상여금은 통상임금의 월할금액과 평균임금의 단서에 모두 등장한다.', 'O', '같은 항목이라도 두 계산에서 쓰는 목적과 반영 방식을 구분한다.', [('3', '제3조 9호·11호')]),
]


def quiz():
    r, f, daily = totals()
    trs = []
    for name, recent, year, _ in ROWS:
        rf = reflect(recent, year)
        ans = f'{year} ÷ 12 × 3 = {rf}' if year is not None else f'{rf} (실제 지급액 그대로)'
        trs.append(f'<tr><th scope="row">{name}</th><td class="n">{recent}</td><td class="n">{year if year is not None else "—"}</td>'
                   f'<td class="n"><button class="wg-ans" data-wgans aria-expanded="false" aria-label="{name} 반영액 펼치기"><span class="wg-a">{ans}</span></button></td></tr>')
    trs.append(f'<tr class="wg-sum"><th scope="row">합계</th><td class="n">{r:,}</td><td class="n">—</td>'
               f'<td class="n"><button class="wg-ans" data-wgans aria-expanded="false" aria-label="합계 펼치기"><span class="wg-a">{f:,} → {f * 10000:,}원 ÷ {DAYS}일 ≈ {daily}원</span></button></td></tr>')
    ox = ''.join(
        f'<li class="wg-ox" data-ans="{a}"><p>{"①②③"[i]} {e(s)}</p><div class="row"><button class="chip" data-wgox="O" aria-label="O">O</button><button class="chip" data-wgox="X" aria-label="X">X</button></div>'
        f'<p class="wg-oxr" hidden><b class="wg-mark"></b> 정답 {a} — {e(w)} {"".join(chip(n, l) for n, l in refs)}</p></li>'
        for i, (s, a, w, refs) in enumerate(TRAPS))
    return (
        '<p class="wg-goal">목적 — 가린 칸을 먼저 머릿속으로 계산하고, 눌러서 맞춰 봅니다. 학습 기록에는 남지 않습니다.</p>'
        '<div class="row"><button class="chip" data-wgall aria-pressed="false">전부 펼치기</button></div>'
        '<div class="tw"><table class="wg-t wg-calc"><tr><th>항목</th><th>최근 3개월</th><th>이전 1년</th><th>반영할 3개월분</th></tr>'
        + ''.join(trs) + '</table></div>'
        f'<h4 class="wg-h">함정 확인</h4><ol class="wg-oxs">{ox}</ol>'
    )


STEPS = [('concept', '개념 비교'), ('calc', '계산 따라가기'), ('quiz', '가리고 풀기')]


def section(arts):
    check(arts)
    chips = ''.join(f'<button class="chip{" on" if i == 0 else ""}" data-wgstep="{k}" aria-pressed="{str(i == 0).lower()}">{t}</button>' for i, (k, t) in enumerate(STEPS))
    panes = ''.join(f'<div class="wg-pane" data-wgpane="{k}"{"" if i == 0 else " hidden"}>{fn()}</div>' for i, (k, fn) in enumerate([('concept', concept), ('calc', calc), ('quiz', quiz)]))
    return ('<h4 class="wg-h0">통상임금 · 지급기준액 · 평균임금 구분</h4>\n'
            f'<div class="wg"><div class="row wg-chips" role="group" aria-label="통상·평균임금 단계">{chips}</div>{panes}</div>\n')
