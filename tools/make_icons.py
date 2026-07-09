# -*- coding: utf-8 -*-
"""앱 아이콘(PWA)을 생성한다.

  python tools/make_icons.py app/icons

파란 라운드 사각형 위에 흐린 택배 상자를 깔고 '물류' 글자를 얹는다.
maskable 아이콘이라 원형으로 잘려도 살아남도록 내용은 가운데 60% 안에 둔다.
"""
import sys, os
from PIL import Image, ImageDraw, ImageFont

FONT = r'C:\Windows\Fonts\malgunbd.ttf'      # 맑은 고딕 볼드
TOP, BOTTOM = (96, 165, 250), (29, 78, 216)  # #60A5FA -> #1D4ED8
S = 1024                                     # 원본 해상도(축소해서 안티에일리어싱)


def lerp(a, b, t):
    return tuple(round(x + (y - x) * t) for x, y in zip(a, b))


def build():
    img = Image.new('RGB', (S, S))
    d = ImageDraw.Draw(img)
    for y in range(S):                        # 세로 그라데이션
        d.line([(0, y), (S, y)], fill=lerp(TOP, BOTTOM, y / (S - 1)))

    # 흐린 택배 상자 (배경 엠블럼)
    box = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    b = ImageDraw.Draw(box)
    w = round(S * 0.015)
    ink = (255, 255, 255, 82)
    # maskable: 원형(지름 80%)으로 잘려도 살아남도록 모서리를 안전영역 안에 둔다
    x0, x1 = round(S * 0.24), round(S * 0.76)
    y0, y1 = round(S * 0.24), round(S * 0.76)
    lid = round(S * 0.37)
    b.rounded_rectangle([x0, y0, x1, y1], radius=round(S * 0.03), outline=ink, width=w)
    b.line([(x0, lid), (x1, lid)], fill=ink, width=w)                 # 뚜껑 접힌 선
    b.line([(S // 2, y0), (S // 2, lid)], fill=ink, width=w)          # 테이프
    img = Image.alpha_composite(img.convert('RGBA'), box)

    # '물류' 글자 — 뚜껑 선 아래, 상자 폭 안에 들어가게
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, round(S * 0.23))
    text = '물류'
    l, t, r, bm = d.textbbox((0, 0), text, font=font)
    cx, cy = S / 2, (lid + y1) / 2
    d.text((cx - (r - l) / 2 - l, cy - (bm - t) / 2 - t), text, font=font, fill=(255, 255, 255, 255))

    # 라운드 코너 마스크
    mask = Image.new('L', (S, S), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=round(S * 0.22), fill=255)
    out = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


if __name__ == '__main__':
    dst = sys.argv[1] if len(sys.argv) > 1 else 'app/icons'
    os.makedirs(dst, exist_ok=True)
    master = build()
    for name, size in [('icon-512.png', 512), ('icon-192.png', 192), ('apple-touch-icon.png', 180)]:
        img = master.resize((size, size), Image.LANCZOS)
        if name == 'apple-touch-icon.png':    # iOS는 알파를 검게 칠하므로 배경을 깐다
            bg = Image.new('RGB', (size, size), BOTTOM)
            bg.paste(img, (0, 0), img)
            img = bg
        img.save(os.path.join(dst, name))
        print('생성:', os.path.join(dst, name), f'{size}x{size}')
