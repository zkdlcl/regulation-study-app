# Claude·Codex·Antigravity 공용 하네스

규칙의 원본은 루트 `AGENTS.md`, 스킬의 원본은 `.claude/skills/`다. 작업 도구가 바뀌어도 원본을 수정하면 모두 반영된다. 파일 복사본을 따로 유지하지 않는다.

| 경로 | 역할 |
|---|---|
| `CLAUDE.md` | `@AGENTS.md` 참조와 Claude 전용 연결 |
| `AGENTS.md` | Codex가 직접 읽는 공용 규칙 |
| `GEMINI.md` | Gemini용 공용 규칙 참조 |
| `.agents/skills` → `.claude/skills` | Codex·Antigravity 신버전 스킬 |
| `.agent/skills` → `.claude/skills` | Antigravity 구버전 스킬 |
| `.agent/rules/공용규칙.md` | `always_on` 규칙, AGENTS.md와 공용 CLI를 가리키는 짧은 진입점 |
| `.agents/rules` → `.agent/rules` | Antigravity 신버전 규칙 경로 |
| `.claude/settings.json`·`.codex/hooks.json` | 같은 `tools/ctx_guard.py`를 호출하는 도구별 설정 |

Windows에서는 관리자 권한이 필요 없는 정션을 사용한다. 다른 OS에서는 상대 심볼릭 링크를 사용한다. 링크는 Git에서 제외하고 클론마다 재생성한다. 기존 경로가 다른 파일이나 폴더이면 덮어쓰지 않고 실패한다.

## 공용 명령

저장소 루트에서 실행한다.

```powershell
python -X utf8 tools/ai_harness.py start
python -X utf8 tools/ai_harness.py verify
python -X utf8 tools/ai_harness.py status
```

`start`는 링크 설치·점검, 작업 줄 인계, Git 상태를 보여 준다. `verify`는 링크·훅 JSON과 보호 가드·링크·기존 하네스 테스트를 실행하며 첫 실패에서 멈춘다. `status`는 인계·미커밋·원격 추적 상태를 보여 준다. 원격 상태는 마지막 fetch 기준이다. 이 명령들은 자동 게시나 자동 커밋을 하지 않는다. 앱을 수정했으면 별도로 `artifact-release`의 빌드·브라우저 검증을 실행한다.

작업 줄은 `kb/진행/<줄>.md`로 분리하고 맨 위 `상태:`·`다음:`을 관리한다. 메모는 다음 명령으로 덧붙인다. 메모 로그도 Git에 보관한다.

```powershell
python -X utf8 tools/kbq.py checkpoint --줄 멀티도구협업 "검증한 작업과 다음 작업"
```

검증 후 형상관리는 `AGENTS.md`의 add·커밋·pull --rebase·push 순서를 따른다. 같은 폴더에서는 한 번에 한 세션만 Git 변경 명령을 실행한다. 다른 세션의 새 미커밋 변경 때문에 pull이 거절되면 stash하거나 지우지 않는다. 원격 이력은 force push로 덮지 않는다.

## 도구별 실제 지원 범위

- Claude는 기존 훅 형식을 사용한다. Codex는 프로젝트 `.codex/hooks.json`을 사용하며 처음이나 정의 변경 후 `/hooks`에서 신뢰 검토가 필요할 수 있다. 이 하네스는 신뢰 설정을 우회하지 않는다. [OpenAI 공식 훅 문서](https://learn.chatgpt.com/docs/hooks)
- Codex의 셸 호출은 `Bash` 또는 로컬 `exec_command` 형식에 대응하고, `apply_patch`로 공용 진행 파일을 삭제·재생성하는 호출을 차단한다. 부분 `Update File`은 허용한다. 셸 명령 검사는 제한된 정적 검사이므로 모든 명령·간접 도구 호출을 차단하는 보안 경계는 아니다.
- Antigravity는 `trigger: always_on` 규칙과 스킬 링크를 제공한다. 실제 앱을 이 환경에서 실행한 검증은 하지 않았다. 훅과 무관하게 공용 CLI를 실행해 같은 인계를 얻는다. [Google 공식 규칙 문서](https://antigravity.google/docs/rules/), [스킬 문서](https://antigravity.google/docs/skills)
- Gemini CLI의 스킬 자동 발견까지 검증한 것은 아니다. `GEMINI.md`에서 AGENTS.md를 읽고 필요한 `.claude/skills/<이름>/SKILL.md`를 직접 읽으면 같은 절차를 수행할 수 있다.
- 컨텍스트 경고는 현재 가드가 지원하는 Claude `message.usage` 기록에서만 계산한다. 다른 도구의 usage 형식이나 창 크기를 확인할 수 없으면 경고를 조용히 생략한다. 파일 바이트 수로 사용률을 추측하지 않는다. 컨텍스트 알림과 파일 보호 규칙은 별개다.
- 보호 가드의 JSON 응답·공용 명령·링크 동작은 자동 테스트하고, 각 앱이 훅을 실제로 신뢰해 호출하는지는 새 세션에서 확인한다. 테스트 통과를 앱 실행 검증으로 표시하지 않는다.

`tools/study_harness.py validate`는 구조도 전용 브라우저 검증으로 남겨 둔다. 기존 `stop` 명령은 이제 공용 상태 알림만 호출하며, 턴 종료 시 다른 세션 파일을 자동 커밋하지 않는다.

아티팩트 게시만 Artifact 도구가 있는 Claude 세션이 수행한다. 소스 수정·근거 조회·대본 제작·로컬 빌드·테스트·커밋·푸시는 모든 도구가 공용 절차로 수행한다. TTS는 사용자 방침에 따라 무료만 사용한다.
