"""컨텍스트 보호 훅 (Claude Code · Codex 공용). 표준 라이브러리만 쓴다. 푸시·게시·커밋 기능 없음.
  pretool     큰 DB 파일을 통째로 읽으려는 Read/Bash 를 막고 tools/kbq.py 로 안내
  prompt      지원되는 usage 형식으로 컨텍스트 사용률을 계산해 70%·85% 에서 한 줄 알림
  resume      세션 시작(startup/resume/clear/compact) 때 kb/진행/ 의 상태·다음·최근 메모 주입
  precompact  압축 직전 git 상태를 .git/study-harness/ctx-handoff.md 에 저장
  stop        턴 끝에 미커밋·미푸시 알림(커밋 안 함)
  Write 가드  병렬 세션 공용 진행 파일의 통째 덮어쓰기 차단
CTX_GUARD=off 환경변수로 차단을 끈다. CTX_WINDOW_TOKENS(기본 1000000)로 창 크기를 바꾼다.
"""
import fnmatch
import json
import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
WATCH = ['kb/exam_kb.json', 'regs.json', 'quiz/dump.json', 'kb/study/답지.json', 'orgmaster.html',
         'orgmaster.wrapped.html', 'site/index.html', 'dist/orgmaster.html', 'base/orgmaster.base.html',
         'kb/annot/*.json', 'site/data/laws/*.json', 'site/data/quiz/*.json']
MIN_BYTES = 30_000
MAX_LIMIT = 400                  # 줄 단위 Read 한도
READERS = re.compile(r'(?<![\w-])(cat|type|more|less|get-content|gc|python|node)(?![\w-])', re.I)
SAFE = re.compile(r'\|\s*(head|select-object|measure)|\b(head|tail|wc|grep|rg|sed\s+-n|select-string|findstr|diff|git)\b'
                  r'|-totalcount|-first\s+\d|kbq\.py|check_kb\.py|build_artifact\.py|kb[\\/]work\.py|\.json\.load|json\.load', re.I)
STAGES = (85, 70)              # 실측 토큰 기준. 지나친 /clear 권고를 피한다
PROGRESS = ('kb/진행상황.md', 'kb/진행/*.md', 'kb/진행/메모.log')   # 병렬 세션이 같이 쓰는 파일: Write(통째 덮어쓰기) 금지


def rel(p):
    try:
        return Path(p).resolve().relative_to(ROOT).as_posix()
    except (ValueError, OSError):
        return None


def watched(r):
    return bool(r) and any(fnmatch.fnmatch(r, g) for g in WATCH) and (ROOT / r).is_file() and (ROOT / r).stat().st_size >= MIN_BYTES


def minified(r):
    with open(ROOT / r, 'rb') as f:
        return f.read(MIN_BYTES).count(b'\n') < 5


def deny(reason):
    return {'hookSpecificOutput': {'hookEventName': 'PreToolUse', 'permissionDecision': 'deny', 'permissionDecisionReason': reason}}


HINT = ('컨텍스트 보호: 큰 DB 파일은 통째로 읽지 않는다. `python -X utf8 tools/kbq.py digest|item|art|find|ans` 로 필요한 조각만 조회하거나 '
        'Grep(-n, head_limit)로 찾는다. 줄이 있는 파일은 offset+limit(≤%d줄)로만 읽을 수 있다. 꼭 필요하면 CTX_GUARD=off.' % MAX_LIMIT)


def pretool(data):
    if os.environ.get('CTX_GUARD') == 'off':
        return {}
    name, ti = data.get('tool_name', '').split('.')[-1], data.get('tool_input') or {}
    if not isinstance(ti, dict):
        return {}
    cmd = ti.get('command') or ti.get('cmd') or ''
    if name == 'apply_patch':
        for path in re.findall(r'^\*\*\* (?:Delete|Add) File: (.+)$', cmd, re.M):
            r = rel(path.strip())
            if r and (ROOT / r).exists() and any(fnmatch.fnmatch(r, g) for g in PROGRESS):
                return deny(f'{r} 통째 교체·삭제 대신 Update File 부분 수정을 사용하세요.')
        return {}
    if name == 'Write':
        r = rel(ti.get('file_path', ''))
        if r and (ROOT / r).exists() and any(fnmatch.fnmatch(r, g) for g in PROGRESS):
            return deny(f'{r} 는 여러 세션이 같이 쓰는 진행 파일이라 통째 덮어쓰기(Write)를 막는다. '
                        '다른 세션 기록이 지워질 수 있다. Edit 로 고치거나 `python -X utf8 tools/kbq.py checkpoint --줄 <이름> "<한 줄>"` 을 쓴다.')
        return {}
    if name == 'Read':
        r = rel(ti.get('file_path', ''))
        if not watched(r):
            return {}
        limit = ti.get('limit')
        if minified(r):
            return deny(f'{r} 는 줄바꿈이 거의 없어 일부만 읽을 수 없다. ' + HINT)
        if not limit or int(limit) > MAX_LIMIT:
            return deny(f'{r} 를 한도 없이 읽으려 했다. ' + HINT)
        return {}
    if name in ('Bash', 'PowerShell', 'shell', 'local_shell', 'exec_command') and cmd and READERS.search(cmd) and not SAFE.search(cmd):
        norm = cmd.replace('\\', '/')
        for g in WATCH:
            base = g.split('*')[0] if '*' in g else g
            if base and base in norm:
                if '*' in g or watched(g):
                    return deny(f'명령이 {g} 를 통째로 출력할 수 있다. ' + HINT)
    return {}


def used_tokens(path):
    """대화 기록 끝부분에서 마지막 응답의 usage(입력+캐시) = 지금 컨텍스트에 실린 실제 토큰 수."""
    try:
        with open(path, 'rb') as f:
            f.seek(0, 2)
            f.seek(max(0, f.tell() - 400_000))
            lines = f.read().decode('utf-8', 'replace').splitlines()
    except OSError:
        return None
    for line in reversed(lines):
        if '"usage"' not in line:
            continue
        try:
            u = (json.loads(line).get('message') or {}).get('usage') or {}
        except ValueError:
            continue
        n = sum(int(u.get(k) or 0) for k in ('input_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'))
        if n:
            return n
    return None


def estimate_percent(path):
    n = used_tokens(path)
    if n is None:
        return None
    # 지금 쓰는 Opus·Sonnet 은 1M 창. 200K 모델이면 자동 압축이 먼저 일어나고 압축 지침(CLAUDE.md)이 상태를 지킨다.
    window = int(os.environ.get('CTX_WINDOW_TOKENS', '1000000'))
    return min(99, int(n / window * 100))


def state_dir():
    r = subprocess.run(['git', 'rev-parse', '--absolute-git-dir'], cwd=ROOT, capture_output=True, encoding='utf8')
    d = Path(r.stdout.strip()) / 'study-harness'
    d.mkdir(exist_ok=True)
    return d


def prompt(data):
    tp = data.get('transcript_path')
    pct = estimate_percent(tp) if tp else None
    if pct is None:
        return {}
    sid = str(data.get('session_id') or tp)
    f = state_dir() / 'ctx-warned.json'
    try:
        seen = json.loads(f.read_text(encoding='utf8'))
    except (OSError, ValueError):
        seen = {}
    stage = next((s for s in STAGES if pct >= s), 0)
    if not stage or seen.get(sid, 0) >= stage:
        return {}
    seen[sid] = stage
    f.write_text(json.dumps(seen), encoding='utf8')
    msg = (f'컨텍스트 약 {pct}% (추정). 지금 단원·묶음이 끝나면 `python -X utf8 tools/kbq.py checkpoint --줄 <줄> "<한 줄>"` 로 '
           '진행을 남기고, 사용자에게 /clear 를 권한다(새 세션은 자동으로 이어받는다).')
    return {'hookSpecificOutput': {'hookEventName': 'UserPromptSubmit', 'additionalContext': msg}}


def section(text, head):
    m = re.search(r'^' + re.escape(head) + r'.*?\n(.*?)(?=^## |\Z)', text, re.S | re.M)
    return m.group(0).strip() if m else ''


RESUME_MAX = 3000      # SessionStart 주입 한도(자). 넘치면 오래된 메모부터 버린다.
RESUME_MEMOS = 10      # 최근 메모 몇 줄


def resume(_):
    d = ROOT / 'kb' / '진행'
    if not d.is_dir():
        return {}
    head = ('진행 인계(kb/진행/ 발췌, 최신 메모가 맨 아래). 응답은 한국어. 큰 DB 파일은 통독하지 말고 tools/kbq.py 로 조회한다. '
            '병렬 세션이 있을 수 있다: 자기 작업 줄 파일만 Edit, 메모는 `kbq.py checkpoint --줄 <줄>`.\n')
    rows = []
    for f in sorted(d.glob('*.md')):
        if f.name == 'README.md':
            continue
        t = f.read_text(encoding='utf-8-sig')
        st = re.search(r'^상태:\s*(.*)$', t, re.M)
        nx = re.search(r'^다음:\s*(.*)$', t, re.M)
        st = st.group(1).strip() if st else '?'
        if st.startswith('완료'):
            continue
        rows.append(f'- [{f.stem}] {st} — 다음: {nx.group(1).strip() if nx else "?"}')
    nxt = '## 작업 줄\n' + '\n'.join(rows)
    log = d / '메모.log'
    lines = log.read_text(encoding='utf8').splitlines() if log.exists() else []
    memo = ['- ' + x for x in lines if x.strip()][-RESUME_MEMOS:]

    def tail():
        return '\n\n## 최근 세션 메모\n' + '\n'.join(memo)

    # 최신 메모를 반드시 남긴다: 넘치면 오래된 메모부터 버리고(최소 3줄), 그래도 넘치면 '다음 순서' 꼬리를 자른다
    while len(memo) > 3 and len(head + nxt + tail()) > RESUME_MAX:
        memo.pop(0)
    room = RESUME_MAX - len(head) - len(tail())
    if len(nxt) > room:
        nxt = nxt[:max(0, room - 1)] + '…'
    return {'hookSpecificOutput': {'hookEventName': 'SessionStart', 'additionalContext': (head + nxt + tail())[-RESUME_MAX:]}}


def precompact(_):
    s = subprocess.run(['git', 'status', '--short'], cwd=ROOT, capture_output=True, encoding='utf8', errors='replace').stdout
    (state_dir() / 'ctx-handoff.md').write_text('# 압축 직전 git 상태\n```\n' + s + '```\n', encoding='utf8')
    return {'systemMessage': '압축 직전: 진행 중이던 묶음이 있으면 kbq.py checkpoint 로 한 줄 남겼는지 확인하세요 (git 상태는 .git/study-harness/ctx-handoff.md).'}


def stop(_):
    """턴이 끝날 때 미커밋·미푸시만 알린다(커밋은 하지 않는다). SVN 식 규칙 상기용."""
    st = subprocess.run(['git', 'status', '--porcelain'], cwd=ROOT, capture_output=True, encoding='utf8', errors='replace').stdout
    ahead = subprocess.run(['git', 'rev-list', '--count', '@{u}..HEAD'], cwd=ROOT, capture_output=True, encoding='utf8').stdout.strip()
    dirty = [l for l in st.splitlines() if l.strip()]
    parts = []
    if dirty:
        parts.append(f'미커밋 {len(dirty)}개')
    if ahead and ahead != '0':
        parts.append(f'미푸시 커밋 {ahead}개')
    if not parts:
        return {}
    return {'systemMessage': '알림: ' + ', '.join(parts) + ' — 한 단위 작업이 끝났으면 커밋·푸시까지 (다른 세션 작업 중일 수 있음).'}


ACTIONS = {'pretool': pretool, 'prompt': prompt, 'resume': resume, 'precompact': precompact, 'stop': stop}


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf8')
    action = sys.argv[1] if len(sys.argv) > 1 else ''
    try:
        # Windows 기본 stdin 은 cp949 → 한글 경로가 깨져 가드가 무력화된다. 바이트로 받아 UTF-8 로 푼다.
        raw = sys.stdin.buffer.read().decode('utf-8', 'replace') if not sys.stdin.isatty() else ''
        data = json.loads(raw) if raw.strip() else {}
        result = ACTIONS[action](data)
    except Exception as exc:       # 훅이 작업을 막지 않도록 실패는 조용히 알리기만 한다
        result = {'systemMessage': 'ctx_guard 보류: ' + str(exc)}
    if result:
        print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
