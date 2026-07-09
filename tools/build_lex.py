# -*- coding: utf-8 -*-
"""모든 기출 PDF의 '한 줄 안 띄어쓰기'에서 어절/음절쌍 통계를 만든다."""
import sys, glob, fitz
from lexicon import line_texts
import joiner

lines = []
for f in sorted(p for p in glob.glob('20*/*.pdf') if '정답' not in p and '가답안' not in p):
    lines += list(line_texts(fitz.open(f)))
TOK, BS, BJ = joiner.build(lines, sys.argv[1])
print(f'줄 {len(lines)}개, 어절 {len(TOK)}종, 음절쌍 띄움 {len(BS)}종 / 붙임 {len(BJ)}종 -> {sys.argv[1]}')
