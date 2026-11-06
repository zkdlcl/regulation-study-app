# 국제인도법 SOURCE · TTS 인계

2026-11-07. SOURCE 02·03 작성 및 국내 TTS 합성 준비 완료. **음원 합성·청취·앱 연결을 마친 뒤 게시할 단계**이며 지금 바로 게시할 완성 음원은 없다. 게시와 푸시는 Claude 담당이다.

## 추가한 원고

| 파일 | 교재 범위 | 합성용 글자 수 |
|---|---|---:|
| 02_전투가_멈춘_뒤에도_지켜야_할_규칙.md | 제1장 5~7절: 루소·핵심 규칙·마르텐스 | 2,577 |
| 03_전쟁의_이유와_전쟁_중의_규칙.md | 제2장 1~3절: 개전법·교전법·전쟁 금지·보호책임 | 3,065 |

원고에는 제목과 낭독 본문만 둔다. 자료 URL·해시 목록은 `01_대응표.json`의 `sources`, 02·03 근거와 번역 차이는 번호별 대응표에 있다. 국문은 PDF 이미지, 영문은 텍스트, 시험 표현은 수록본과 기출 근거 DB로 대조했다. 대응표의 기출 ID 전체를 문항 본문으로 재검수한 것은 아니며, 직접 확인한 ID는 notes에 구분했다. `draft`는 청취·사용자 검토 완료를 뜻하지 않는다.

번역 차이: 핵심 규칙의 무기 금지 문장 연결 방식, 영문에만 있는 부상자·병자 수색 문장, 정당방위의 individual/collective 표현을 기록했다. 외부 최신 설명으로 시험 교재를 덮어쓰지 않는다. 본문은 교재 해설이며 현행 개별 분쟁의 법적 판단을 다루지 않는다.

## CLOVA Voice 합성 준비

후보는 네이버 CLOVA Voice Premium. 아라 `nara`와 진호 `njinho`를 같은 대본으로 비교한다. 기본 속도 0, 피치 0으로 시작하고, 필요하면 속도 1(조금 느리게)도 비교한다. 최고 음질이라고 확정한 것은 아니다. [공식 API 문서](https://api.ncloud-docs.com/docs/ai-naver-clovavoice-ttspremium)에서 한국어 요청당 2,000자 제한, 목소리 ID, 속도 방향, WAV 24kHz 지원을 확인했다.

`tools/tts_clova.py`는 **기본 실행 시 네트워크·과금 없이** `plan.json`·`녹음용.txt`를 생성한다. 제목·절·문단별로 분리하고 절 제목 뒤 0.8초, 문단 뒤 1.2초 쉼을 설정했다. URL·근거·검토 메모는 읽지 않는다. 2,000자를 넘는 문단은 묵시적으로 잘라 읽지 않고 분할을 요구한다.

```powershell
python -X utf8 tools/tts_clova.py --script audio/국제인도법/02_전투가_멈춘_뒤에도_지켜야_할_규칙.md
python -X utf8 tools/tts_clova.py --script audio/국제인도법/03_전쟁의_이유와_전쟁_중의_규칙.md
```

합성은 `NCP_CLOVA_API_KEY_ID`, `NCP_CLOVA_API_KEY` 환경변수가 필요하다. 키는 로컬에서 설정하고 저장소·원고·채팅에 남기지 않는다. `--synthesize` 실행은 텍스트를 네이버 API로 보내며 사용량이 청구될 수 있다. 계정·서비스 개설은 이번 작업에 포함하지 않았다.

먼저 같은 첫 두 문단을 두 목소리로 생성해 비교한다.

```powershell
python -X utf8 tools/tts_clova.py --script audio/국제인도법/02_전투가_멈춘_뒤에도_지켜야_할_규칙.md --speaker nara --sample --synthesize
python -X utf8 tools/tts_clova.py --script audio/국제인도법/02_전투가_멈춘_뒤에도_지켜야_할_규칙.md --speaker njinho --sample --synthesize
```

확정한 목소리로 `--sample` 없이 생성한다. 01도 같은 도구로 재합성할 수 있다. 기본 출력은 `audio/.cache/clova/<원고>/<목소리>-<속도>/sample` 또는 `full`이다. WAV 조각을 검증·캐시하고 PCM 무음을 삽입해 `preview.wav`·`manifest.json`을 만든다. 기존 Edge 전용 MP3 프레임 결합은 사용하지 않는다. 15분 초과 시 절 경계에서 원고를 나눠야 한다. API 실제 응답 형식·발음·억양은 아직 검증하지 않았고, WAV 처리·캐시·목차 시간은 모의 응답으로 검사했다.

## 게시 전 남은 작업

1. 샘플 청취 후 목소리·속도 확정. 전체 합성 후 숫자, 라틴어, 루소·마르텐스, 적신월·적수정, 문단 쉼을 실제로 듣고 점검한다.
2. WAV를 게시용 MP3로 변환한다면 재인코딩 후 길이·목차 시간을 검사한다. `site/data/tts/ihl.json`의 기존 트랙을 보존하며 02·03 추가를 연결한다. 현재 앱 목차는 변경하지 않았다.
3. 앱 연결 후 artifact-release 스킬에 따라 빌드, 재생·구간 이동·태블릿 검사와 기존 보수 듣기 회귀 검증을 수행한다. 이번 작업은 대본·별도 합성 도구만 변경하여 앱 빌드는 수행하지 않았다.
4. Claude가 기존 게시본과 비교 후 게시한다. 학습 기록은 읽기만 한다.

로컬 검증 명령:

```powershell
python -X utf8 -m unittest discover -s tests -p tts_narration_test.py
python -X utf8 -m unittest discover -s tests -p tts_clova_test.py
```

다음 SOURCE는 미작성 머릿글을 보완하고 제3장부터 계속한다. `진도.json`의 151개 절 중 10개가 draft, 141개는 pending이다. 전체 범위 제작이 완료된 상태로 표시하지 않는다.
