"""첨부 MD 원본에서 5주차 스터디 자료를 재현 가능하게 추출한다."""
from pathlib import Path
import re
import json
import shutil
import html
import sys
import base64

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / 'kb/study/5주차_국제인도법'
AUTHORS = ['구현지', '신희훈', '김배성', '전권능', '박준규', '최강락', '신승현', '하영진']
# 출제자 답과 사용자의 최초 표기를 각각 전사한다. 확신도는 제공되지 않았다.
ANSWERS = ['XOOXO③③', 'XOXOX②③', 'XOOOX③④', 'OOOOO③④', 'XXOXX②⑤', 'XOXOX③③④', 'OXOOO⑤②', 'XOOXO④②']
MINE = ['OOOXO②③', 'XOOOX②③', 'OOXOO③④', 'OOOOO③④', 'OOOXO③③', 'XOXXO②③④', 'OOOOX⑤④', 'XOOXO④②']
SECTIONS = [
    ['제6장 3)', '제7장 4)', '제11장 6)', '제14장 8)', '제14장 2)', '제10장 3)', '국제인도법은 언제 적용되나? 2)'],
    ['제2장 1)', '제5장 1)', '국제인도법은 언제 적용되나? 2)', '제8장 7)', '제9장 4)', '제3장 6)', '제4장 2)'],
    ['제7장 2)', '제5장 5)', '제4장 4)', '표장의 사용 및 보호와 관련된 국제인도법 조항에는 무엇이 있나? 4)', '제21장 5)', '제6장 3)', '제1장 4)'],
    ['제6장 3)', '제1장 6)', '제5장 8)', '제6장 1)', '제17장 3-4)', '제11장 2)', '제11장 3)'],
    ['제3장 1)', '제5장 8)', '표장의 사용 및 보호와 관련된 국제인도법 조항에는 무엇이 있나? 7)', '제11장 4)', '제17장 1)', '국제인도법은 전쟁의 수단과 방법을 어떻게 규제하고 있나? 5)', '제4장 2)'],
    ['제18장 1)', '제9장 4)', '제9장 9)', '제10장 4)', '제11장 1)', '제3장 6)', '표장의 사용 및 보호와 관련된 국제인도법 조항에는 무엇이 있나? 4)'],
    ['제14장 4)', '제15장 4)', '제6장 3)', '제7장 4)', '제8장 6)', '제17장 2-1)', '제11장 3)'],
    ['제5장 1)', '제5장 3)', '제11장 6)', '제1장 4)', '표장의 사용 및 보호와 관련된 국제인도법 조항에는 무엇이 있나? 6)', '제11장 3)', '제5장 3)'],
]


def question(lines, no):
    lines = list(lines)
    if lines[0].startswith(('(OX퀴즈)', '(객관식)')):
        lines.pop(0)
    first = lines[0]
    if no <= 5:
        first = re.sub(r'\s*\(\s*(?:[OX]\s*(?:,\s*[OX])?)?\s*\).*$','', first)
        first = re.sub(r'\s+[OX](?:\s+틀림.*)?$', '', first)
        return first.strip()
    first = re.sub(r'\s*(?:\(\s*[1-5]\s*\)|\[[1-5]\]).*$', '', first)
    result, choices = [first], set()
    for line in lines[1:]:
        if re.match(r'^[①②③④⑤]', line):
            mark = line[0]
            if mark in choices:
                continue
            choices.add(mark)
            if no == 6 and '의무수송수단' in line and line.startswith('⑤'):
                line = line.split('–')[0].strip()
            result.append(line)
        elif not choices and (re.match(r'^[가나다라]\.', line) or '구체적이고 직접적인 소기의' in line):
            result.append(line)
    # 구현지의 개수 보기는 한 줄에 묶여 있다.
    if len(choices) == 1 and '②' in result[-1]:
        result[-1:] = re.split(r'\s*(?=[②③④⑤])', result[-1])
    return '\n'.join(result)


def clean(s):
    s = re.sub(r'\\([.\-_)>(~\[\]])', r'\1', s)
    return s.replace('**', '').replace('~~', '').strip().lstrip('> ').strip()


def blocks(path):
    author, num = None, None
    out = {}
    for raw in path.read_text(encoding='utf-8').splitlines():
        if 'data:image' in raw:
            continue
        line = clean(raw)
        m = re.search(r'5주차\)(?:문제|답지)_([가-힣]+)', line)
        if m:
            author, num = m[1], None
            continue
        m = re.match(r'([1-7])\.\s*(.*)', line)
        if author and m:
            num = int(m[1])
            out[(author, num)] = [m[2]]
        elif author and num and line:
            out[(author, num)].append(line)
    return out


def archive():
    DEST.mkdir(parents=True, exist_ok=True)
    uploads = Path.home() / '.paseo/uploads'
    for folder, name in [
        ('upload_460bcca2-295e-4397-8a7d-ecec6e3aa92c', '공식답지_원본.md'),
        ('upload_9c82a49e-8112-4ea6-8d27-0b33023b5620', '내답_원본.md'),
    ]:
        target = DEST / name
        if not target.exists():
            shutil.copyfile(next((uploads / folder).glob('*.md')), target)
    s = (DEST / '내답_원본.md').read_text(encoding='utf-8')
    b = re.search(r'data:image/png;base64,([^>]+)', s).group(1)
    (DEST / '문화재표장.png').write_bytes(base64.b64decode(b))


if __name__ == '__main__':
    archive()
    mine = blocks(DEST / '내답_원본.md')
    official = blocks(DEST / '공식답지_원본.md')
    assert len(mine) == len(official) == 56
    sys.path.insert(0, str(ROOT / 'kb'))
    from kb_lib import articles
    A = articles()
    records, responses = [], []
    for ai, author in enumerate(AUTHORS):
        for no in range(1, 8):
            ident = f'st5-{author}-{no}'
            answer = ANSWERS[ai][no-1: no] if no < 7 else ANSWERS[ai][6:]
            my = MINE[ai][no-1: no] if no < 7 else MINE[ai][6:]
            key = '국제인도법:' + SECTIONS[ai][no-1]
            # 인용은 규정 원문에서 직접 가져온다. 출제자 해설과는 구분한다.
            cue = {
                ('구현지', 1): '제2추가의정서는 공통',
                ('구현지', 4): '중앙포로정보국은 중립국',
                ('김배성', 1): '- 중립국',
                ('전권능', 5): '청색과 흰색',
                ('최강락', 4): '- 억류는',
                ('신승현', 2): '이동의 자유',
            }.get((author, no))
            quote = next((line for line in A[key]['text'].split('\n') if cue and cue in line), A[key]['text'].split('\n')[0])
            q = question(mine[author, no], no)
            if (author, no) == ('최강락', 7):
                # 문제 파일에 덧붙은 선택 개수는 공식 지문에 없어 제거한다.
                q = q.replace('(2개)', '')
            source_ex = '\n'.join(official[author, no])
            ex = '<b>출제자 답지: ' + answer + '</b><br>'
            ex += '<details><summary>출제자 원문·해설</summary>' + html.escape(source_ex).replace('\n', '<br>') + '</details>'
            ex += '<br><b>관련 교재 원문</b> ' + html.escape(key) + ': ' + html.escape(quote)
            r = dict(id=ident, grp='st5', no=no, kind='ox' if no<=5 else 'mc', area=author, q=q, a=answer, art=key, quote=quote, ex=ex)
            records.append(r)
            responses.append(dict(id=ident, my=my, official=answer, confidence=None, source='내답_원본.md', raw='\n'.join(mine[author, no])))
    # 다중 선택은 기존 앱과 같은 쉼표 구분으로 저장한다.
    records[41]['a'] = '③,④'
    responses[41]['official'] = responses[41]['my'] = '③,④'
    for record, response in zip(records, responses):
        record['my'] = response['my']
    picture = records[25]
    picture['image'] = 'data:image/png;base64,' + base64.b64encode((DEST / '문화재표장.png').read_bytes()).decode('ascii')
    picture['imageAlt'] = '첨부 문제 원본의 문화재 식별표장 그림'
    notes = {
        'st5-전권능-5': '출제자 정답 O를 보존했다. 교재는 청색과 흰색 방패를 1954년 협약 설명에 제시한다. 문제의 제2의정서 표현과 그림의 대응은 출제자 확인이 필요하다.',
        'st5-신승현-7': '출제자 정답 ②를 보존했다. 문제 파일과 답지의 지문·⑤ 보기 표현이 다르다. 교재는 평가를 통해 예상 민간인 손실이 소기의 군사적 이익을 초과하지 않는 경우를 설명한다. 단순히 군사적 이익이 크다는 이유만으로 모든 공격의 적법성이 확정된다고 일반화하지 않는다.',
        'st5-최강락-7': '출제자 해설에 ③과 ④가 각각 오답 보기로 명시되어 있어 정답은 ③,④로 전사했다.',
        'st5-박준규-5': '출제자 답 X는 교재 제17장의 특별 보호 대상 목록에 따른다. 교육시설이 일반적인 민간 물자로서 받는 보호까지 부정하는 뜻으로 확대하지 않는다.',
    }
    for record in records:
        if record['id'] in notes:
            record['reviewNote'] = notes[record['id']]
            record['ex'] += '<br><b>자료 대조 메모</b>: ' + html.escape(notes[record['id']])
    assert len({r['id'] for r in records}) == 56
    assert all(not re.search(r'틀림|정답:|\[image', r['q']) for r in records)
    assert all(all(c in r['q'] for c in '①②③④') for r in records if r['kind'] == 'mc')
    data = dict(week=5, date='2026-11-12', source_url='https://docs.google.com/document/d/1IeWPKv9kcMsUbfHO0MMz8R7frtluZxV0c9xhW7PrE5I/edit?tab=t.x0wknxnqieue', responses=responses)
    (DEST / '내답.json').write_text(json.dumps(data, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (DEST / '문항.json').write_text(json.dumps(records, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    if '--apply' in sys.argv:
        path = ROOT / 'kb/study/답지.json'
        db = json.loads(path.read_text(encoding='utf-8'))
        db['sources']['st5-스터디8인'] = '2026-11-12 첨부 MD 2개(5주차 국제인도법 문제·내 답, 공식 답지). 원본: kb/study/5주차_국제인도법/. 56문항, 출제자 답 보존. 최강락-7은 해설의 ③·④를 함께 전사. 표현 차이·검토 사항은 해당 폴더 README 및 해설 참고. 최초 답은 메타데이터로 보관하며 운영 학습 기록을 seed하지 않음.'
        db['add'] = [x for x in db['add'] if x['grp'] != 'st5'] + records
        path.write_text(json.dumps(db, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    print(f'문항·최초 답 분리: {len(records)}개')
