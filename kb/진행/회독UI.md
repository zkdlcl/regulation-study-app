# 회독UI
상태: 진행 중
다음: 게시 필요 — 회독 +1 클릭 시 국제인도법이 몇 절 아래로 밀리던 오류 수정본(ihl-study.js drawRead 래퍼). Artifact 도구 있는 Claude 세션이 게시

## 기록
- 11-10 회독 +1/−1 뒤 제자리 유지: 기준 drawRead 가 이해 칩(MutationObserver)이 붙기 전 짧은 문서에 scrollY 를 되돌려 앵커링이 엉뚱한 절을 잡던 문제. 칩을 동기로 붙이고 화면 맨 위 조문 기준으로 위치 보정. 테스트 tests/rc-keep-test.mjs
