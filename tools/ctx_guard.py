"""컨텍스트 보호 훅 (Claude Code · Codex 공용). 표준 라이브러리만 쓴다. 푸시·게시·커밋 기능 없음.
  pretool     큰 DB 파일을 통째로 읽으려는 Read/Bash 를 막고 tools/kbq.py 로 안내
  prompt      대화 기록 크기로 컨텍스트 사용률을 추정해 50%·70% 에서 한 줄 알림
  resume      세션 시작(startup/resume/clear/compact) 때 kb/진행상황.md 의 다음 순서·세션 메모만 주입
  precompact  압축 직전 git 상태를 .git/study-harness/ctx-handoff.md 에 저장
CTX_GUARD=off 환경변수로 차단을 끈다. CTX_WINDOW_TOKENS(기본 200000)로 창 크기를 바꾼다.
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
STAGES = (70, 50)


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
    name, ti = data.get('tool_name', ''), data.get('tool_input') or {}
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
    cmd = ti.get('command') or ''
    if name in ('Bash', 'PowerShell', 'shell', 'local_shell') and cmd and READERS.search(cmd) and not SAFE.search(cmd):
        norm = cmd.replace('\\', '/')
        for g in WATCH:
            base = g.split('*')[0] if '*' in g else g
            if base and base in norm:
                if '*' in g or watched(g):
                    return deny(f'명령이 {g} 를 통째로 출력할 수 있다. ' + HINT)
    return {}


def estimate_percent(path):
    try:
        size = Path(path).stat().st_size
    except OSError:
        return None
    window = int(os.environ.get('CTX_WINDOW_TOKENS', '200000'))
    return min(99, int(size / 3 / window * 100))     # 대화 기록 바이트÷3 ≈ 토큰(한글·JSON 섞임 어림값)


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
    seen = {sid: stage}
    f.write_text(json.dumps(seen), encoding='utf8')
    msg = (f'컨텍스트 약 {pct}% (추정). 지금 단원·묶음이 끝나면 `python -X utf8 tools/kbq.py checkpoint "<한 줄>"` 로 '
           '진행을 남기고, 사용자에게 /clear 를 권한다(새 세션은 자동으로 이어받는다).')
    return {'hookSpecificOutput': {'hookEventName': 'UserPromptSubmit', 'additionalContext': msg}}


def section(text, head):
    m = re.search(r'^' + re.escape(head) + r'.*?\n(.*?)(?=^## |\Z)', text, re.S | re.M)
    return m.group(0).strip() if m else ''


RESUME_MAX = 3000      # SessionStart 주입 한도(자). 넘치면 오래된 메모부터 버린다.
RESUME_MEMOS = 10      # 최근 메모 몇 줄


def resume(_):
    p = ROOT / 'kb' / '진행상황.md'
    if not p.exists():
        return {}
    text = p.read_text(encoding='utf-8-sig')
    head = '진행 인계(kb/진행상황.md 발췌, 최신 메모가 맨 아래). 응답은 한국어. 큰 DB 파일은 통독하지 말고 tools/kbq.py 로 조회한다.\n'
    nxt = section(text, '## 다음 순서')
    memo = [x for x in section(text, '## 세션 메모').splitlines() if x.startswith('- ')][-RESUME_MEMOS:]

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


ACTIONS = {'pretool': pretool, 'prompt': prompt, 'resume': resume, 'precompact': precompact}


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
