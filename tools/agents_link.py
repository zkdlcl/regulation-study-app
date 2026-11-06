"""여러 AI 코딩 도구가 같은 스킬·규칙을 쓰도록 링크를 만든다 (원본은 하나, 복사본 없음).

  python -X utf8 tools/agents_link.py          링크 만들기(이미 있으면 건너뜀)
  python -X utf8 tools/agents_link.py --check  상태만 보기

원본
  규칙  AGENTS.md            (Codex·Antigravity·Cursor 등이 읽는 공용 표준. CLAUDE.md·GEMINI.md 는 @AGENTS.md 로 가져옴)
  스킬  .claude/skills/       (Claude Code)
링크 (git 에 넣지 않음 — Windows git 은 심볼릭 링크를 글자 파일로 받기 쉬워서, 클론마다 이 스크립트로 만든다)
  .agents/skills  → .claude/skills   Codex 프로젝트 스킬
  .agent/skills   → .claude/skills   Antigravity 구버전 작업공간 스킬
  .agents/rules   → .agent/rules     Antigravity 신버전 공용 규칙 진입점
Windows 는 관리자 권한이 필요 없는 디렉터리 정션(mklink /J), 그 밖은 심볼릭 링크.
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / '.claude' / 'skills'
LINKS = [ROOT / '.agents' / 'skills', ROOT / '.agent' / 'skills']


def ensure_link(link, source, check=False):
    """기존 파일·잘못된 링크는 지우지 않고 오류로 알린다."""
    if not source.is_dir():
        raise ValueError(f'원본 폴더 없음: {source}')
    if os.path.lexists(link):
        if link.resolve() == source.resolve():
            return '있음'
        raise ValueError(f'다른 파일·폴더·링크가 이미 있음: {link}')
    if check:
        raise ValueError(f'링크 없음: {link}')
    link.parent.mkdir(parents=True, exist_ok=True)
    if os.name == 'nt':
        subprocess.run(['cmd', '/c', 'mklink', '/J', str(link), str(source)], check=True, capture_output=True)
    else:
        link.symlink_to(os.path.relpath(source, link.parent), target_is_directory=True)
    return '만듦'


def main():
    check = '--check' in sys.argv
    failures = 0
    pairs = [(link, SRC) for link in LINKS] + [(ROOT / '.agents/rules', ROOT / '.agent/rules')]
    for link, source in pairs:
        rel = link.relative_to(ROOT).as_posix()
        try:
            result = ensure_link(link, source, check)
            print(f'{result}  {rel} → {source.relative_to(ROOT).as_posix()}')
        except (OSError, ValueError, subprocess.CalledProcessError) as exc:
            print(f'확인 필요 {rel}: {exc}')
            failures += 1
    return int(bool(failures))


if __name__ == '__main__':
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf8')
    sys.exit(main())
