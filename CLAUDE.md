# 승진고시 마스터 — Claude Code 안내

공용 규칙은 AGENTS.md 가 원본이다(모든 AI 도구 공통). 여기는 Claude 전용만 둔다.

@AGENTS.md

## Claude 전용
- 스킬은 Skill 도구로 부른다. 게시(Artifact 도구)는 Claude 세션만 할 수 있다 → `artifact-release`. 다른 도구가 남긴 "게시 필요"(작업 줄 파일 `다음:`)가 있으면 같이 올린다.
- 훅(`.claude/settings.json` → `tools/ctx_guard.py`): 큰 DB 통독 차단, 공용 진행 파일 Write 차단, 실측 컨텍스트 알림(70%·85%), 세션 시작 인계, 턴 끝 미커밋·미푸시 알림. 응답 언어는 `language: korean`.
- 이 폴더에서는 claude.ai 동기화 플러그인·커넥터를 끈다(`.claude/settings.local.json`).
