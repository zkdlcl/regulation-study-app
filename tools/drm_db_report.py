"""보호 파일 조사 결과에 DB 범위와 복호화 우선순위를 덧붙인다. DB는 읽기만 한다."""
from collections import Counter, defaultdict
import csv
import json
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'kb'))
import kb_lib


def main():
    out=ROOT/'kb/자료점검/DRM'
    result=json.loads((out/'조사결과.json').read_text(encoding='utf-8'))
    records=result['records']
    drm=[r for r in records if r['status']=='DRM 확인']
    loose=[r for r in drm if not r['archive']]
    hashes={r['sha256'] for r in loose}
    archive_only={r['sha256']:r for r in drm if r['archive'] and r['sha256'] not in hashes}
    official=[r for r in loose if '역대 승진 필기 시험 모음' in r['path']]
    items=kb_lib.exam_items()
    groups=Counter()
    for x in items:
        group=x['id'].rsplit('-',1)[0]
        groups[group]+=1
    index={x['id']:x for x in json.loads((ROOT/'site/quizindex.json').read_text(encoding='utf-8'))}
    stats=Counter()
    for p in (ROOT/'kb/annot').glob('*.json'):
        for item in json.loads(p.read_text(encoding='utf-8-sig')):
            stats[item['status']]+=1
    snapshot={'exam_items':len(items),'empty_question':sum(not x['q'].strip() for x in items),
              'empty_answer':sum(not str(x['a']).strip() for x in items),'annotation_status':dict(stats),
              'groups':[{'id':g,'name':index[g]['name'] if g in index else '2026년 4급 기출','count':n} for g,n in groups.items()],
              'provenance':'문항별 원본 PDF/HWP 경로와 SHA-256을 연결한 이력은 확인되지 않음. 현재 src는 시험명과 문항번호이며 원본파일 대조 증명이 아님.'}
    (out/'DB현황.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    def csvwrite(name,rs):
        with (out/name).open('w',encoding='utf-8-sig',newline='') as f:
            w=csv.writer(f);w.writerow(['파일명','원본경로','sha256','DB대조상태'])
            for r in rs:w.writerow([r['name'],r['path'],r['sha256'],'원본 미대조·누락 여부 미확정'])
    csvwrite('우선복호화_공식시험24개.csv',official)
    csvwrite('압축에만있는DRM_고유목록.csv',archive_only.values())
    representatives={r['sha256']:r for r in loose}
    csvwrite('실제DRM_중복제거목록.csv',representatives.values())
    lines=['# DB 영향과 복호화 우선순위','',
           '## 확인된 결론','',
           f'- 실제 DRM 파일 {len(loose)}개, SHA-256 기준 고유 {len(hashes)}종. ZIP 내부 {len(drm)-len(loose)}개까지 포함하면 고유 {len({r["sha256"] for r in drm})}종.',
           f'- ZIP 안에만 존재하는 보호 내용은 고유 {len(archive_only)}종. 이 목록은 압축을 풀어 복호화할 후보이며 단순 ZIP 사본을 중복 집계하지 않았다.',
           '- 프로젝트 artifact-build 내부 및 조사한 승진 관련 Downloads 파일에서 DRM 헤더는 발견되지 않았다. 보호 파일은 상위 승진 자료에 있다.',
           f'- 실제 파일 분류(경로·파일명 기반): {dict(Counter(r["purpose"] for r in loose))}. 분류는 내용 확인 결과가 아니다.',
           f'- 현재 기출 근거 DB {len(items)}문항, 빈 본문 {snapshot["empty_question"]}, 빈 정답 {snapshot["empty_answer"]}. 근거 기록 상태: {dict(stats)}.',
           '- 위 수치는 수록 문항의 존재를 확인한 것이며, 원본 전체가 빠짐없이 수록되었다는 증명은 아니다. 일부확인·확인필요·개정차이를 DRM 탓으로 단정하지 않는다.', '',
           '## 1순위: 공식 시험자료 24개','',
           '`우선복호화_공식시험24개.csv`에 전체 경로가 있다. 폴더 자체가 공식 시험자료 모음이므로 우선 이 폴더를 정상 파일로 다시 제공하면 된다. 시험지·정답표·질의 검토결과는 함께 필요하다.', '',
           '```text',str(Path(official[0]['path']).parent) if official else '', '```','',
           *['- '+r['name'] for r in official], '',
           '파일명에 2009~2015·2017~2020 묶음이 있다. 현재 근거 DB는 2018~2026을 대상으로 하므로 더 오래된 시험의 존재와 반영 범위는 복호화 후 별도로 확인해야 한다. 묶음 제목만으로 포함 연도·문항 수를 확정하지 않는다.', '',
           '## 2순위: 기출·복원 후보와 미수록 스터디','',
           '`실제DRM_중복제거목록.csv`의 고유 파일을 확인한다. 전체 경로 및 용도 분류는 `복호화확인목록.csv`에 있다. 스터디 문항을 실제 기출과 섞어 출제 빈도를 계산하지 않는다. 별도 출처 유형으로 보관하고, 실제 기출 연도별 추이의 분모는 공식 시험 원본과 대조한 뒤 정한다.', '',
           '정상 HWP/Office도 컨테이너만 검사했으며 전 문서 본문 추출은 미실시다. 글자층 없는 PDF는 렌더링/OCR 대상이다. 기존 정상 앱 JSON으로 이미 반영됐는지는 문항별 대조가 필요하다.', '',
           '## 현재 기출 수록 범위','', '| 패키지 | 시험명 | 문항 수 |','|---|---|---:|',
           *[f"| {g['id']} | {g['name']} | {g['count']} |" for g in snapshot['groups']], '',
           '## DB가 만들어진 경로와 미확정 부분','',
           '- `quiz/convert_quiz.py`: 선배 앱 문제 JSON `quiz/dump.json` → `site/data/quiz/*.json` 및 목차. `quiz/REPORT.md`는 당시 변환 4,550문항을 기록한다. 이 과정은 개별 PDF/HWP 직접 변환이 아니다.',
           '- `kb/kb_lib.py::exam_items`: 현재 past-01~12 파일과 base의 2026 문항에서 432문항을 읽는다. `kb/annot/*.json`은 이 문항들에 근거를 붙인 기록이다.',
           '- 원본 PDF/HWP 파일별로 어떤 문항을 가져왔는지 경로·원본 해시가 연결된 대조표는 확인하지 못했다. 따라서 DRM 때문에 빠진 문항 수는 지금 확정할 수 없다.',
           '- 게시 아티팩트의 원격 데이터는 이번에 조회하지 않았다. 이 보고서는 프로젝트 로컬 DB와 제공 원본 기준이다. 원격 게시본의 동일성은 다음 게시·검증 단계에서 확인한다.', '',
           '## 복호화본을 받은 뒤','',
           '1. 원본은 보존하고 복호화본을 별도 폴더로 받는다. `tools/drm_audit.py`로 정상 열기 여부를 재검사한다.',
           '2. 공식 시험지·정답표·최종 질의 검토결과를 연도·시험 구분·문항번호로 연결한다. 취소/정정 문항은 별도 표시한다.',
           '3. 현재 DB와 문항 본문·보기·정답·문항 수를 맞대조하고 누락/변형/중복/정답차이를 검토한다. 원본파일 해시·페이지·문항번호를 출처로 남긴다.',
           '4. 추이 분석은 실제 기출과 스터디를 구분하고, 연도별 수록 완전성·미확인 범위를 표시한다. 현재 문항 수 차이를 실제 출제 비중 변화로 해석하지 않는다.', '',
           '## 인도법 정상 대체본','',
           '`audio/국제인도법/자료/국제인도법 질문과 답변.pdf`는 사용자 지정 정상본이며 96쪽 이미지 PDF다. 동일 제목의 보호 파일을 복호화해야 TTS 제작을 이어갈 수 있는 상태는 아니다. 보호본과 내용이 완전히 같다는 뜻은 아니다.','']
    (out/'DB영향과우선순위.md').write_text('\n'.join(lines),encoding='utf-8')
    print('공식자료',len(official),'실제고유',len(hashes),'압축전용고유',len(archive_only),'기출DB',len(items))


if __name__=='__main__':main()
