# 회독UI
상태: 진행 중
다음: 없음 — v86 게시 완료(칩이 읽던 곳 따라감, 인도법 원문 그림·박스). 사용자 실사용 피드백 대기

## 기록
- 11-10 회독 +1/−1 뒤 제자리 유지: 기준 drawRead 가 이해 칩(MutationObserver)이 붙기 전 짧은 문서에 scrollY 를 되돌려 앵커링이 엉뚱한 절을 잡던 문제. 칩을 동기로 붙이고 화면 맨 위 조문 기준으로 위치 보정. 테스트 tests/rc-keep-test.mjs
- 11-10 조 제목 강조: 기준 drawRead 의 `(제목)` 괄호를 build_artifact.py rep 로 벗기고, ui7.css 에서 `.art-h .tt`·`.rv-h .tt` 를 굵은 --ink, `.no` 를 --red-d 로. 게시 v84
- 11-11 칩 따라가기: 칩 줄은 본문 맨 위(고정 아님)라 읽는 동안 화면 밖. 칩 줄이 화면 밖일 때의 맨 위 조문을 읽는 곳으로 기억(ux4.js chipSpy), 위로 올라온 동안은 유지. 인도법 원문 그림·박스: kb/ihl_figs.json + kb/ihl_figs/*.png(tools/ihl_figs.py 가 로컬 PDF 에서 자름), ihl-study.js figs(). 넣을 자리는 원문 줄 번호로 찾음(가리기 단계 무관). 클라우드 세션 브랜치(ccr-ddc296a1-6ylh7v, v84·v85)를 main 에 병합. 테스트 tests/read-focus-test.mjs. 게시 v86
