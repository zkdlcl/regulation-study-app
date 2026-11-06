"""구조도 검증용 기존 하네스. 공용 시작·종료는 ai_harness.py를 사용한다."""
from __future__ import annotations
import functools
import hashlib
import http.server
import json
import os
from pathlib import Path
import subprocess
import sys
import threading
from datetime import datetime, timezone

ROOT = Path(__file__).resolve().parents[1]
OWNED = {
    'README.md', 'build_artifact.py', 'op-study.js', 'op-study.css',
    'card-review.js', 'card-review.css', 'tests/review-scope-test.mjs', 'tests/card-test.mjs',
    'ux8.js', 'study_tables.py', 'tests/table_guidance_test.py', 'tests/table-goal-test.mjs',
    'tests/op-study-test.mjs', 'tests/study-map-test.mjs', 'tests/harness_test.py',
    'tools/study_harness.py', '.codex/hooks.json', '.claude/hooks/auto-commit.sh',
    'docs/구조도-확장-진행.md', 'docs/구조도-새세션-프롬프트.md',
}

def run(args, cwd=None, env=None):
    r = subprocess.run(args, cwd=cwd or ROOT, env=env, capture_output=True, encoding='utf8', errors='replace')
    if r.returncode:
        raise RuntimeError(f"{' '.join(map(str,args))}\n{r.stdout[-3000:]}\n{r.stderr[-2000:]}")
    return r.stdout

def git(*args):
    return run(['git', *args])

def state_dir():
    p = Path(git('rev-parse', '--absolute-git-dir').strip()) / 'study-harness'
    p.mkdir(exist_ok=True)
    return p

def paths(output):
    return set(filter(None, output.split('\0')))

def changed_paths():
    return paths(git('diff','--name-only','-z','HEAD')) | paths(git('ls-files','--others','--exclude-standard','-z'))

def fingerprint():
    """검사 대상 소스·테스트의 바이트 해시. 진행 메모 변경은 재검사 없이 허용."""
    selected = {p for p in OWNED if not p.startswith('docs/') and p != 'README.md'}
    for pattern in ('*.js','*.css','*.py','base/*.html','site/*.json','site/data/laws/*.json',
                    'kb/annot/*.json','kb/study/*.json','kb/*.py','tests/*.mjs','tests/*.py','tests/package.json'):
        selected.update(str(p.relative_to(ROOT)).replace('\\','/') for p in ROOT.glob(pattern) if p.is_file())
    digest = hashlib.sha256()
    for rel in sorted(selected):
        p = ROOT/rel
        digest.update(rel.encode('utf8')+b'\0')
        digest.update(p.read_bytes() if p.exists() else b'<missing>')
        digest.update(b'\0')
    return digest.hexdigest()

class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

def validate():
    print('구조도 검증 시작', flush=True)
    (state_dir()/'verified.json').unlink(missing_ok=True)
    run(['node','--check','op-study.js'])
    run([sys.executable,'-m','unittest','discover','-s','tests','-p','harness_test.py'])
    run([sys.executable,'-m','unittest','discover','-s','tests','-p','table_guidance_test.py'])
    # 기존 빌드의 KB 출력 순서만 바뀌는 부수효과 제거. 내용이 달라지면 중단.
    kb = ROOT/'kb/exam_kb.json'; before = kb.read_bytes()
    print(run([sys.executable,'-X','utf8','build_artifact.py']),end='')
    if json.loads(before) != json.loads(kb.read_bytes()):
        raise RuntimeError('빌드 후 KB 내용 변경: 별도 검토 필요')
    kb.write_bytes(before)
    server = http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=str(ROOT/'site')))
    threading.Thread(target=server.serve_forever,daemon=True).start()
    env = dict(os.environ,TEST_URL=f'http://127.0.0.1:{server.server_port}/index.html')
    try:
        for name in ('op-study','study-map','review-scope','table-goal'):
            print(run(['node',f'tests/{name}-test.mjs'],env=env),end='',flush=True)
        for name in ('ux8','card','law'):
            # 고정 URL만 임시 서버로 바꾼 복사본. 원본 테스트는 수정하지 않는다.
            source = ROOT/f'tests/{name}-test.mjs'; temporary = ROOT/f'tests/.harness-{name}.mjs'
            try:
                temporary.write_text(source.read_text(encoding='utf8').replace('http://localhost:8765/index.html',env['TEST_URL']),encoding='utf8')
                output = run(['node',temporary.name],cwd=ROOT/'tests',env=env)
                if any(line.startswith('FAIL') for line in output.splitlines()):
                    raise RuntimeError(output)
                print(f'{name}: {sum(line.startswith("PASS") for line in output.splitlines())}개 검사 통과',flush=True)
            finally:
                temporary.unlink(missing_ok=True)
    finally:
        server.shutdown(); server.server_close()
    git('diff','--check')
    receipt = {'fingerprint':fingerprint(),'base_head':git('rev-parse','HEAD').strip(),
               'validated_at':datetime.now(timezone.utc).isoformat(),'tests':['harness','table-guidance','op-study','study-map','review-scope','table-goal','ux8','card','law']}
    (state_dir()/'verified.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2),encoding='utf8')
    print('검증 영수증 저장 완료. AGENTS.md에 따라 커밋·pull --rebase·push까지 진행하세요.',flush=True)

def auto_commit():
    changed = changed_paths() & OWNED
    if not changed:
        return '자동 커밋: 구조도 작업 변경 없음'
    if git('branch','--show-current').strip() != 'main':
        return '자동 커밋 보류: main 브랜치가 아님'
    if git('ls-files','-u').strip():
        return '자동 커밋 보류: 미해결 충돌 있음'
    staged = paths(git('diff','--cached','--name-only','-z'))
    if staged - OWNED:
        return '자동 커밋 보류: 구조도 작업 외 파일이 이미 stage되어 있음'
    receipt_path = state_dir()/'verified.json'
    if not receipt_path.exists():
        return '자동 커밋 보류: python tools/study_harness.py validate를 먼저 실행하세요.'
    receipt = json.loads(receipt_path.read_text(encoding='utf8'))
    if receipt.get('fingerprint') != fingerprint() or receipt.get('base_head') != git('rev-parse','HEAD').strip():
        return '자동 커밋 보류: 검증 후 소스/HEAD가 변경됨. validate를 다시 실행하세요.'
    git('diff','--check')
    git('add','--',*sorted(changed))
    git('commit','-m','feat: 전 과목 구조도와 진행표·검증 자동 커밋 하네스')
    return '자동 커밋 완료: '+git('rev-parse','--short','HEAD').strip()+' (로컬만, push 안 함)'

def checkpoint():
    note = '# 구조도 세션 체크포인트\n\n'+datetime.now(timezone.utc).isoformat()+'\n\n'
    note += '## Git 상태\n```\n'+git('status','--short')+'```\n\n'
    for rel in ('docs/구조도-확장-진행.md','docs/구조도-새세션-프롬프트.md'):
        p=ROOT/rel
        if p.exists(): note+='\n## '+rel+'\n'+p.read_text(encoding='utf8')+'\n'
    target=state_dir()/'handoff.md'; target.write_text(note,encoding='utf8')
    return '인계 체크포인트 저장: '+str(target)+'. 새 대화가 필요하면 docs/구조도-새세션-프롬프트.md를 사용하세요.'

def main():
    if hasattr(sys.stdout,'reconfigure'): sys.stdout.reconfigure(encoding='utf8')
    action=sys.argv[1] if len(sys.argv)>1 else 'stop'
    if action=='validate':
        validate(); return
    try:
        if action=='stop':
            import ctx_guard
            result=ctx_guard.stop({})
        elif action=='checkpoint': result={'systemMessage':checkpoint()}
        elif action=='resume':
            import ctx_guard
            result=ctx_guard.resume({})
        else: raise ValueError('사용법: study_harness.py validate|stop|checkpoint|resume')
    except Exception as exc:
        result={'systemMessage':'구조도 하네스 보류: '+str(exc)}
    print(json.dumps(result,ensure_ascii=False))

if __name__=='__main__': main()
