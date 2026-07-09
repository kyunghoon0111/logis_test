# -*- coding: utf-8 -*-
"""줄바꿈 지점에서 띄어쓸지 붙일지 판단한다.

한 줄 안에서는 글자 간격으로 띄어쓰기를 정확히 알 수 있으므로, 그 데이터로
  · 어절 빈도표 TOK
  · 인접 음절쌍이 띄어져 있었는지 붙어 있었는지 BI
를 만들어 두고, 줄이 바뀌는 지점의 앞조각 L / 뒷조각 R 을 이 통계로 판정한다.
"""
import json, math, collections

# 로그오즈 가중치. 줄 안쪽 데이터로 leave-one-out 검증해 고른 값
# (어절 경계 95.9% / 어절 중간 95.7% 정확).
TAU = -0.5
W_BI = 1.5
W_TOK = 1.0


class Joiner:
    def __init__(self, path):
        d = json.load(open(path, encoding='utf-8'))
        self.TOK = collections.Counter(d['tok'])
        self.BI_SPACE = collections.Counter({tuple(k.split('\t')): v for k, v in d['bi_space'].items()})
        self.BI_JOIN = collections.Counter({tuple(k.split('\t')): v for k, v in d['bi_join'].items()})

    def space_between(self, L, R):
        """True면 L과 R 사이에 공백을 넣는다.

        두 가지 증거를 로그오즈로 더한다.
          · 음절쌍: (L의 끝글자, R의 첫글자)가 줄 안에서 띄어져 있었나 붙어 있었나
          · 어절  : L+R이 통째로 한 어절로 나타나나, 아니면 L과 R이 각각 어절인가
        어느 한쪽 증거가 빈약해도(예: L이 딱 한 번 나온 조각) 다른 쪽이 상쇄한다.
        """
        if not L or not R:
            return False
        j = self.TOK.get(L + R, 0)
        s = min(self.TOK.get(L, 0), self.TOK.get(R, 0))
        bs = self.BI_SPACE.get((L[-1], R[0]), 0)
        bj = self.BI_JOIN.get((L[-1], R[0]), 0)
        odds = (W_BI * math.log((bs + 0.5) / (bj + 0.5))
                + W_TOK * math.log((s + 0.5) / (j + 0.5)))
        return odds > TAU


def build(lines, out_path):
    TOK = collections.Counter()
    BI_SPACE = collections.Counter()
    BI_JOIN = collections.Counter()
    for t in lines:
        for tok in t.split():
            TOK[tok] += 1
        for a, b in zip(t, t[1:]):
            if a == ' ' or b == ' ':
                continue
            BI_JOIN[(a, b)] += 1
        toks = t.split(' ')
        for x, y in zip(toks, toks[1:]):
            if x and y:
                BI_SPACE[(x[-1], y[0])] += 1
    json.dump({
        'tok': TOK,
        'bi_space': {'\t'.join(k): v for k, v in BI_SPACE.items()},
        'bi_join': {'\t'.join(k): v for k, v in BI_JOIN.items()},
    }, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False)
    return TOK, BI_SPACE, BI_JOIN
