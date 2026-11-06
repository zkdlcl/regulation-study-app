"""모든 AI 도구의 공용 진입점. 시작·설정 점검·진행 인계만 수행한다.

start: 링크 설치·인계·Git 상태 / check: 설정 검사 / status: 진행·Git 상태
verify: 설정 검사 및 하네스 테스트. 앱 변경 검증은 artifact-release를 따른다.
"""
import argparse
import json
from pathlib import Path
import subprocess
import sys

import agents_link
import ctx_guard

ROOT = Path(__file__).resolve().parents[1]


def command(args):
    return subprocess.run(args, cwd=ROOT, check=True)


def check():
    command([sys.executable, '-X', 'utf8', 'tools/agents_link.py', '--check'])
    for name in ('AGENTS.md', 'CLAUDE.md', 'GEMINI.md', '.agent/rules/공용규칙.md'):
        text = (ROOT / name).read_text(encoding='utf-8-sig')
        if name != 'AGENTS.md' and 'AGENTS.md' not in text:
            raise ValueError(f'{name}: 공용 규칙 참조 없음')
    for name in ('.claude/settings.json', '.codex/hooks.json'):
        data = json.loads((ROOT / name).read_text(encoding='utf-8-sig'))
        for event in ('PreToolUse', 'SessionStart', 'UserPromptSubmit', 'PreCompact', 'Stop'):
            entries = data.get('hooks', {}).get(event, [])
            if not entries or any('ctx_guard.py' not in hook.get('command', '')
                                  for entry in entries for hook in entry.get('hooks', [])):
                raise ValueError(f'{name}: {event} 공용 가드 설정 확인 필요')
    print('공용 규칙·스킬 링크·훅 설정 검사 통과. 실제 훅 신뢰·실행 여부는 각 도구에서 확인하세요.', flush=True)


def status():
    context = ctx_guard.resume({}).get('hookSpecificOutput', {}).get('additionalContext', '')
    print(context or '진행 인계 없음', flush=True)
    command(['git', 'status', '--short'])
    command(['git', 'branch', '-vv'])
    print('검증 후 git add -A → [작업줄] 커밋 → git pull --rebase → git push. 게시는 Claude Artifact 도구만.', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['start', 'check', 'status', 'verify'])
    args = parser.parse_args()
    if args.action == 'start':
        command([sys.executable, '-X', 'utf8', 'tools/agents_link.py'])
        check()
        status()
    elif args.action == 'status':
        status()
    else:
        check()
        if args.action == 'verify':
            for pattern in ('ctx_guard_test.py', 'agents_link_test.py', 'harness_test.py'):
                command([sys.executable, '-X', 'utf8', '-m', 'unittest', 'discover', '-s', 'tests', '-p', pattern])


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf8')
    try:
        main()
    except (OSError, ValueError, subprocess.CalledProcessError) as exc:
        print(f'공용 하네스 확인 필요: {exc}', file=sys.stderr)
        sys.exit(1)
