# 승진고시 마스터 — Gemini·Antigravity 안내

공용 규칙은 AGENTS.md 가 원본이다. 반드시 먼저 읽고 따른다. 응답은 한국어.

@AGENTS.md

## Gemini·Antigravity 전용
- 아티팩트 게시는 할 수 없다: 빌드·테스트·커밋·푸시까지 하고 작업 줄 파일 `다음:` 에 "게시 필요"를 남긴다.
- 스킬은 `.agent/skills/<이름>/SKILL.md` (= `.claude/skills`, 링크는 `python -X utf8 tools/agents_link.py`).
- 훅이 없으므로 큰 DB 파일(AGENTS.md 의 목록)을 통째로 읽지 않도록 스스로 지킨다.
- 시작·검증·종료 상태는 `python -X utf8 tools/ai_harness.py start|verify|status` 중 필요한 명령을 실행한다. 세 동작을 한 인자로 입력하는 문법은 아니다.
