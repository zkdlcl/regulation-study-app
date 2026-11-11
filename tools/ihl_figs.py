"""국제인도법 원문 PDF 에서 그림(표장·방패·특수 표지)을 잘라 kb/ihl_figs/*.png 로 저장한다.
실행: python -X utf8 tools/ihl_figs.py
- 원본: audio/국제인도법/자료/국제인도법 질문과 답변.pdf (로컬 보관, Git 제외). 잘라 낸 png 는 저장소에 넣는다.
- 좌표는 쪽 너비 900px 로 렌더링했을 때의 (왼쪽, 위, 오른쪽, 아래). 어느 절에 넣을지는 kb/ihl_figs.json.
"""
import os
import pymupdf

SP = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PDF = os.path.join(SP, 'audio', '국제인도법', '자료', '국제인도법 질문과 답변.pdf')
OUT = os.path.join(SP, 'kb', 'ihl_figs')
ZOOM = 3          # 216dpi
CROPS = {         # 파일: (쪽, 왼쪽, 위, 오른쪽, 아래)
    'emblem-cross.png': (57, 281, 621, 463, 736),
    'emblem-crescent.png': (57, 281, 760, 463, 875),
    'emblem-lion.png': (57, 281, 899, 463, 1015),
    'emblem-crystal.png': (58, 152, 178, 334, 293),
    'emblem-crystal-combined.png': (58, 152, 367, 498, 486),
    'emblem-crystal-david.png': (58, 152, 783, 334, 899),
    'shield-cultural.png': (77, 148, 188, 234, 314),
    'sign-dangerous.png': (79, 146, 998, 338, 1060),
}


def main():
    os.makedirs(OUT, exist_ok=True)
    doc = pymupdf.open(PDF)
    for name, (pg, x0, y0, x1, y1) in CROPS.items():
        page = doc[pg - 1]
        k = page.rect.width / 900
        clip = pymupdf.Rect(x0 * k, y0 * k, x1 * k, y1 * k)
        pm = page.get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), clip=clip, alpha=False)
        path = os.path.join(OUT, name)
        pm.save(path)
        print(name, pm.width, 'x', pm.height, os.path.getsize(path), 'bytes')


if __name__ == '__main__':
    main()
