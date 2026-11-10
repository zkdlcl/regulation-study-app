# 회독UI
상태: 진행 중
다음: 없음 — v84 게시 완료(조 제목 강조). 사용자 실사용 피드백 대기

## 기록
- 11-10 회독 +1/−1 뒤 제자리 유지: 기준 drawRead 가 이해 칩(MutationObserver)이 붙기 전 짧은 문서에 scrollY 를 되돌려 앵커링이 엉뚱한 절을 잡던 문제. 칩을 동기로 붙이고 화면 맨 위 조문 기준으로 위치 보정. 테스트 tests/rc-keep-test.mjs
- 11-10 조 제목 강조: 기준 drawRead 의 `(제목)` 괄호를 build_artifact.py rep 로 벗기고, ui7.css 에서 `.art-h .tt`·`.rv-h .tt` 를 굵은 --ink, `.no` 를 --red-d 로. 게시 v84
