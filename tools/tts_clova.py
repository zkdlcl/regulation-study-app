"""폐기된 유료 TTS 명령. 무료 생성기 tools/tts_narration.py를 사용한다."""
import sys

MESSAGE = '유료 CLOVA TTS는 프로젝트에서 제외되었습니다. 무료 tools/tts_narration.py를 사용하세요.'


def synthesize(*args, **kwargs):
    """이전 코드가 직접 호출하더라도 유료 요청을 실행하지 않는다."""
    raise RuntimeError(MESSAGE)


def main():
    print(MESSAGE, file=sys.stderr)
    return 2


if __name__ == '__main__':
    sys.exit(main())
