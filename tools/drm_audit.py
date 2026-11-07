"""자료 헤더·문서 열기·ZIP 내부를 읽기 전용으로 검사한다. 복호화는 하지 않는다."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime
import csv
import hashlib
import io
import json
from pathlib import Path
import re
import zipfile

DOCS = {'.pdf', '.hwp', '.hwpx', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.rtf', '.txt'}
SKIP = {'.git', 'node_modules', '__pycache__', '.venv', 'venv'}
MARKERS = (b'\x9b DRMONE', b'DRMONE', b'Fasoo DRM', b'FASOO DRM', b'MARKANY', b'MarkAny', b'SOFTCAMP', b'SoftCamp')


def header_kind(head):
    """확장자와 무관하게 알려진 보호 헤더를 우선한다."""
    if any(head.startswith(m) for m in MARKERS):
        return 'DRM 확인'
    return None


def purpose(name):
    if re.search(r'기출|복원|전직|승진고시.*문제', name):
        return '기출·복원 후보'
    if re.search(r'스터디|연습문제|주차|회독|문제|답안|정답', name):
        return '스터디·문제 후보'
    return '교재·규정·기타'


def inspect(data, suffix):
    """암호/파싱 실패/글자층 부재를 DRM과 구분한다."""
    import pymupdf
    import olefile
    protected = header_kind(data[:4096])
    if protected:
        return protected, '제조사 보호 헤더 확인', {}
    if suffix == '.pdf':
        try:
            with pymupdf.open(stream=data, filetype='pdf') as doc:
                if doc.needs_pass:
                    return 'PDF 암호 필요', '암호 없이 열 수 없음', {}
                chars = sum(len(page.get_text().strip()) for page in doc)
                return ('정상 PDF' if chars else 'PDF 글자층 없음'), '전체 페이지 글자 추출 검사', {'pages': len(doc), 'text_chars': chars}
        except Exception as exc:
            return '문서 열기 실패', str(exc)[:250], {}
    if suffix in {'.hwpx', '.docx', '.xlsx', '.pptx'}:
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                if any(i.flag_bits & 1 for i in z.infolist()):
                    return '문서 암호 필요', 'ZIP 멤버 암호화', {}
                bad = z.testzip()
                if bad:
                    return '문서 열기 실패', 'ZIP CRC 오류: '+bad, {}
            return '정상 문서 컨테이너', 'ZIP 구조/CRC 확인. 본문·정답 품질은 별도 검수', {}
        except Exception as exc:
            if data.startswith(b'\xd0\xcf\x11\xe0'):
                try:
                    with olefile.OleFileIO(io.BytesIO(data)) as ole:
                        if ole.exists('EncryptedPackage'):
                            return '문서 암호 필요', 'Office EncryptedPackage', {}
                except Exception:
                    pass
            return '문서 열기 실패', str(exc)[:250], {}
    if suffix in {'.hwp', '.doc', '.xls', '.ppt'}:
        try:
            with olefile.OleFileIO(io.BytesIO(data)) as ole:
                if ole.exists('EncryptedPackage'):
                    return '문서 암호 필요', 'Office EncryptedPackage', {}
                if suffix == '.hwp':
                    if not ole.exists('FileHeader'):
                        return '문서 형식 확인 필요', 'HWP FileHeader 없음', {}
                    h = ole.openstream('FileHeader').read()
                    flags = int.from_bytes(h[36:40], 'little')
                    if flags & 2:
                        return 'HWP 암호 필요', 'FileHeader 암호 플래그', {}
                    if flags & 4:
                        return 'HWP 배포용', '배포용 플래그. 일반 HWP 추출과 다른 처리 필요', {}
                    return '정상 HWP 컨테이너', 'OLE/FileHeader 확인. 본문 추출·문항 대조는 별도', {}
                return '정상 문서 컨테이너', 'OLE 구조 확인. 본문 추출은 별도', {}
        except Exception as exc:
            return '문서 열기 실패', str(exc)[:250], {}
    return '헤더 보호표식 미검출', '검사 범위 내 알려진 DRM 표식 없음', {}


def audit(roots):
    records, errors, archives = [], [], []
    inspected = 0
    seen = set()

    def record(path, data, suffix, archive=False):
        status, detail, extra = inspect(data, suffix)
        records.append(dict(path=path, name=path.split('!/')[-1].replace('\\', '/').split('/')[-1],
                            bytes=len(data), sha256=hashlib.sha256(data).hexdigest(), status=status,
                            detail=detail, purpose=purpose(path.split('!/')[-1]), archive=archive, **extra))

    def scan_zip(data_or_path, label, depth=0):
        try:
            with zipfile.ZipFile(data_or_path) as z:
                archives.append(label)
                for info in z.infolist():
                    if info.is_dir() or SKIP.intersection(Path(info.filename).parts):
                        continue
                    suffix = Path(info.filename).suffix.lower()
                    if suffix not in DOCS | {'.zip'}:
                        continue
                    loc = label+'!/'+info.filename
                    if info.flag_bits & 1:
                        records.append(dict(path=loc, name=Path(info.filename).name, bytes=info.file_size,
                                            sha256='', status='ZIP 암호 필요', detail='압축 항목 암호화', purpose=purpose(info.filename), archive=True))
                        continue
                    if info.file_size > 600_000_000:
                        errors.append({'path': loc, 'error': '600MB 초과 항목: 별도 검사 필요'})
                        continue
                    content = z.read(info)
                    if suffix == '.zip' and depth < 3:
                        scan_zip(io.BytesIO(content), loc, depth+1)
                    elif suffix == '.zip':
                        errors.append({'path': loc, 'error': '중첩 ZIP 깊이 제한: 별도 검사 필요'})
                    else:
                        record(loc, content, suffix, True)
        except Exception as exc:
            errors.append({'path': label, 'error': str(exc)[:250]})

    for root in roots:
        if not root.exists():
            errors.append({'path': str(root), 'error': '조사 경로 없음'})
            continue
        for p in root.rglob('*'):
            if not p.is_file() or SKIP.intersection(p.parts):
                continue
            # 다운로드 폴더는 승진 자료만 조사해 무관한 개인 문서 목록을 남기지 않는다.
            if root.name.casefold() == 'downloads' and not re.search(r'승진|기출|스터디|인도법|적십자|규정|규약|법규집|조직도',p.name):
                continue
            key = str(p.resolve()).casefold()
            if key in seen:
                continue
            seen.add(key)
            try:
                with p.open('rb') as f:
                    head = f.read(4096)
                inspected += 1
                suffix = p.suffix.lower()
                if header_kind(head) or suffix in DOCS:
                    record(str(p), p.read_bytes(), suffix)
                elif suffix == '.zip':
                    if zipfile.is_zipfile(p):
                        scan_zip(p, str(p))
                    else:
                        errors.append({'path': str(p), 'error': 'ZIP 확장자이나 ZIP으로 열리지 않음'})
            except Exception as exc:
                errors.append({'path': str(p), 'error': str(exc)[:250]})
    return dict(created_at=datetime.now().astimezone().isoformat(), roots=[str(r) for r in roots],
                header_files=inspected, archives=archives, errors=errors, records=records)


def write_report(result, output):
    output.mkdir(parents=True, exist_ok=True)
    rs = result['records']
    groups = defaultdict(list)
    for r in rs:
        if r['sha256']:
            groups[r['sha256']].append(r)
    drm = [r for r in rs if r['status'] == 'DRM 확인']
    blocked = [r for r in rs if r['status'] in {'DRM 확인', 'PDF 암호 필요', '문서 암호 필요', 'HWP 암호 필요', 'ZIP 암호 필요', '문서 열기 실패', '문서 형식 확인 필요', 'HWP 배포용'}]
    result['summary'] = dict(status_counts=dict(Counter(r['status'] for r in rs)),
        drm_files=len(drm), drm_unique_hashes=len({r['sha256'] for r in drm}),
        drm_loose_files=sum(not r['archive'] for r in drm), drm_archive_members=sum(r['archive'] for r in drm))
    (output/'조사결과.json').write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    fields=['번호','분류','상태','동일내용사본수','sha256','파일명','경로','확인내용']
    with (output/'복호화확인목록.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.writer(f);w.writerow(fields)
        for i,r in enumerate(blocked,1):
            w.writerow([i,r['purpose'],r['status'],len(groups[r['sha256']]),r['sha256'],r['name'],r['path'],r['detail']])
    lines=['# 문서 보호·DB 입력 조사', '', f"조사 시각: {result['created_at']}", '',
           '원본은 읽기만 했다. 복호화·삭제·교체·학습 기록 변경 없음.', '',
           '## 조사 범위', '', *['- '+r for r in result['roots']], '',
           f"일반 파일 헤더 {result['header_files']}개, ZIP {len(result['archives'])}개(중첩 포함). Downloads는 승진 관련 이름의 파일만 조사했다. 압축 내부는 문서 확장자만 검사했다. 제외: .git/node_modules/가상환경/바이트코드. 알려진 보호 헤더·문서 형식 검사이며 모든 DRM 제품 탐지를 보증하지 않는다. 보호된 FZI 등 컨테이너 내부는 열어보지 못한 범위다.", '',
           '## 결과', '', '| 상태 | 파일/압축 항목 수 |','|---|---:|',
           *[f'| {k} | {v} |' for k,v in Counter(r['status'] for r in rs).most_common()], '',
           f"DRM 확인 {len(drm)}개 중 실제 파일 {sum(not r['archive'] for r in drm)}개, 압축 항목 {sum(r['archive'] for r in drm)}개. 바이트 해시 기준 고유 {len({r['sha256'] for r in drm})}종. 같은 제목이라도 해시가 다르면 같은 내용이라고 확정하지 않았다.", '',
           '## 복호화 확인', '', '전체 경로는 `복호화확인목록.csv`, 정상/글자층 없는 PDF를 포함한 전체 목록은 `조사결과.json` 참조. 중복 해시별로 대표 한 개를 복호화한 뒤 원본과 대조하면 중복 작업을 줄일 수 있다.', '',
           '| 번호 | 파일명 | 분류 | 동일 해시 사본 |', '|---|---|---|---:|']
    unique={r['sha256']:r for r in blocked}
    for i,r in enumerate(unique.values(),1):
        lines.append(f"| {i} | {r['name'].replace('|','/')} | {r['status']} / {r['purpose']} | {len(groups[r['sha256']])} |")
    lines += ['', '## 해석의 한계', '',
              '- 글자층 없는 PDF는 DRM이 아니다. 렌더링·OCR로 처리할 수 있다.',
              '- 정상 HWP/Office 컨테이너는 본문·문항·정답의 추출 완료를 뜻하지 않는다.',
              '- 같은 SHA-256은 동일 바이트의 사본이다. 복호화본과 보호본은 해시가 달라 자동으로 같은 내용이라고 판정할 수 없다.',
              '- 보호 파일 존재만으로 현재 DB 문항 누락을 확정할 수 없다. DB는 별도의 앱 JSON에서 유래했다. 원본별 문항 수·본문·정답 대조가 필요하다.', '',
              '## 조사 오류/별도 확인', '', *['- '+e['path']+': '+e['error'] for e in result['errors']]]
    (output/'조사보고서.md').write_text('\n'.join(lines)+'\n',encoding='utf-8')
    print(json.dumps(result['summary'],ensure_ascii=False))
    print('조사 오류',len(result['errors']), '보고서',str(output))


if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',action='append',required=True)
    parser.add_argument('--out',default='kb/자료점검/DRM')
    args=parser.parse_args()
    write_report(audit([Path(p) for p in args.root]),Path(args.out))
