# -*- coding: utf-8 -*-
"""줄바꿈 지점의 띄어쓰기를 판정하기 위한 어절 사전을 만든다.

한 줄 안에서는 글자 간격으로 띄어쓰기를 정확히 알 수 있다. 그 정보를 모아
어절(공백으로 구분되는 토막) 빈도표를 만든 뒤, 줄이 바뀌는 지점에서
    앞조각 L, 뒷조각 R
을 붙일지(LR이 한 어절) 띄울지(L과 R이 각각 어절) 판단한다.
"""
import fitz, re, json, sys, glob, io, collections
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SPACE_RATIO = 0.3
FOOTER = re.compile(r'^\d{4}년도?제\d+회|교시A형')


def line_texts(doc):
    """페이지의 각 시각적 줄을, 글자 간격으로 띄어쓰기를 넣은 문자열로."""
    for page in doc:
        frags = []
        for b in page.get_text('rawdict')['blocks']:
            if b['type'] != 0:
                continue
            for l in b['lines']:
                bb = l['bbox']
                if bb[1] > 780:
                    continue
                chars = [c for s in l['spans'] for c in s['chars']]
                if chars:
                    frags.append(((bb[1] + bb[3]) / 2, bb[0], chars))
        frags.sort(key=lambda f: (round(f[0] / 5), f[1]))
        merged, cur, cy = [], [], None
        for yc, _, chars in frags:
            if cy is None or abs(yc - cy) <= 5:
                cur += chars
                cy = yc if cy is None else cy
            else:
                merged.append(cur); cur, cy = list(chars), yc
        if cur:
            merged.append(cur)
        for chars in merged:
            chars.sort(key=lambda c: c['bbox'][0])
            out, prev, pend = [], None, False
            for c in chars:
                ch = c['c']
                if not ch.strip():
                    pend = True
                    continue
                if prev is not None:
                    fs = max(1.0, c['bbox'][3] - c['bbox'][1])
                    if pend or c['bbox'][0] - prev['bbox'][2] > SPACE_RATIO * fs:
                        out.append(' ')
                out.append(ch)
                prev, pend = c, False
            t = ''.join(out).strip()
            if t and not FOOTER.search(t.replace(' ', '')):
                yield t


if __name__ == '__main__':
    TOK = collections.Counter()
    for f in sorted(p for p in glob.glob('20*/*.pdf') if '정답' not in p and '가답안' not in p):
        for t in line_texts(fitz.open(f)):
            for tok in t.split():
                TOK[tok] += 1

    json.dump(TOK, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False)
    print(f'어절 {len(TOK)}종, 총 {sum(TOK.values())}개 -> {sys.argv[1]}')
    print('  최빈:', TOK.most_common(8))
