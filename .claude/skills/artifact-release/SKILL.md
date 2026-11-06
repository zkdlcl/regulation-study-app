---
name: artifact-release
description: 승진고시 마스터 아티팩트를 고친 뒤 빌드·크롬 테스트·화면 확인·게시·학습 기록 백업·커밋까지 할 때 쓴다. "게시해", "반영해", "배포", "백업" 요청.
---

# 빌드 → 테스트 → 게시 → 백업 → 커밋

아티팩트: https://claude.ai/artifact/XmAgPN8DtD9eoujJX8naXs (capability `db`, 학습 기록은 `state/progress`)

## 1. 빌드
```
python -X utf8 convert_regs.py     # 규정 원문이 바뀐 경우만
python -X utf8 make_cards.py --progress backup/progress.json   # 카드 규칙·DB가 바뀐 경우
python -X utf8 build_artifact.py   # kb 검사 통과해야 빌드됨 → orgmaster.html, site/index.html
```

## 2. 테스트 (site 를 8765 포트로)
```
cd site && python -m http.server 8765        # 백그라운드
(cd tests && npm install)
for t in tests/*-test.mjs; do node $t | grep -v ^PASS; done   # 저장소 루트에서 돌린다(캡처 경로가 tests/…). PASS 말고 나오는 줄이 없어야 통과
```
알려진 무해 실패는 없다. 실패하면 앱 결함인지 테스트 가정인지 구분하고, 테스트 가정이면 테스트를 고쳐 다시 PASS 만 나오게 한다(실패를 '무해'로 남겨 두지 않는다).
화면은 태블릿 가로(1180×820)·세로(820×1180)·폰(390×844), 라이트·다크로 캡처해 눈으로 확인한다.

## 3. 게시
1. 게시 전 확인: `Artifact read` 로 게시본을 받아 `<body>` 안이 `dist/orgmaster.html` 과 같은지 비교(다른 곳에서 바뀐 걸 덮지 않기).
2. Artifact 도구는 작업 폴더·scratchpad 밖 파일을 받지 않으므로 scratchpad 에 `orgmaster.html` 과 바뀐 `data/...` 파일을 복사.
3. `Artifact publish` (url 지정, root = 그 폴더, files = **바뀐** 데이터 파일만). capabilities 는 생략(기존 `db` 유지).
4. U+FFFD(깨진 글자)가 있으면 거부되므로 미리 검사.
5. 도구에 `root`·`files` 입력이 없으면(v62 현재) data 파일은 못 올린다. 별표가 바뀐 규정은 `build_artifact.py` `EXTRA_INLINE` 에 추가해 페이지에 넣는다.

## 4. 학습 기록 백업 (읽기만)
`ArtifactData get` (collection `state`, doc `progress`) → `backup/progress.json` 에 그대로 저장. **절대 set/update 하지 않는다.**

## 5. 마무리 (SVN 식: 묻지 않고 끝까지)
공용 형상관리·병렬 작업 규칙은 `AGENTS.md`를 따른다. Artifact 도구가 없는 세션은 게시·운영 백업을 수행하지 않고 검증·커밋·푸시 후 자기 작업 줄 `다음:`에 게시 필요를 남긴다. 도구가 있는 Claude 세션은 게시·백업 후 커밋·푸시한다.

`cp orgmaster.html dist/orgmaster.html`, README 의 게시 버전 갱신, 커밋·푸시.
