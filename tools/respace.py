# -*- coding: utf-8 -*-
"""문항 지문과 선지의 띄어쓰기를 PDF 글자 좌표에서 복원한다.

PDF에는 공백 글자가 없고 단어 사이를 위치로만 벌려 놓았다. 그래서 텍스트를 뽑으면
"화물자동차운수사업은화물자동차운송사업"처럼 붙어 나온다. 글자 사이 간격이 폰트 크기의
30%를 넘으면 띄어쓰기로 보고 되살린다.

안전장치: 공백을 제거한 문자열이 기존 값과 완전히 같을 때만 교체한다.
글자가 하나라도 달라지면 기존 값을 그대로 둔다.
    python tools/respace.py merged.json final.json lex.json   (저장소 루트에서 실행)
"""
import fitz, re, json, sys, glob, io
import joiner

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROUND = {'2020': 24, '2021': 25, '2022': 26, '2023': 27, '2024': 28, '2025': 29}
SUBJ1 = ['물류관리론', '화물운송론', '국제물류론']
SUBJ2 = ['보관하역론', '물류관련법규']
SPACE_RATIO = 0.3
FOOTER = re.compile(r'^\d{4}년도?제\d+회|교시A형|^\(\s*\d+\s*-\s*\d+\s*\)$')


def ns(s):
    return re.sub(r'\s+', '', s or '')


def qstarts(doc):
    out = []
    for pi, p in enumerate(doc):
        for b in p.get_text('dict')['blocks']:
            if b['type'] != 0:
                continue
            for l in b['lines']:
                if not l['spans']:
                    continue
                s0 = l['spans'][0]['text'].strip()
                if l['bbox'][0] < 80 and re.fullmatch(r'\d{1,3}\.', s0):
                    out.append((pi, l['bbox'][1], int(s0[:-1])))
    out.sort(key=lambda x: (x[0], x[1]))
    return out


def spaced(chars):
    """한 줄 안의 띄어쓰기를 글자 간격으로 복원한다."""
    out, prev, pend = [], None, False
    for c in sorted(chars, key=lambda c: c['bbox'][0]):
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
    return ''.join(out).strip()


def page_lines(page, y_from=-1e9, y_to=1e9):
    """읽기 순서의 시각적 줄 목록(띄어쓰기 복원됨)."""
    frags = []
    for b in page.get_text('rawdict')['blocks']:
        if b['type'] != 0:
            continue
        for l in b['lines']:
            bb = l['bbox']
            if bb[1] < y_from - 2 or bb[1] >= y_to - 2 or bb[1] > 780:
                continue
            chars = [c for s in l['spans'] for c in s['chars']]
            if chars:
                frags.append(((bb[1] + bb[3]) / 2, bb[0], chars))
    frags.sort(key=lambda f: (round(f[0] / 5), f[1]))

    out, cur, cy = [], [], None
    for yc, _, chars in frags:           # 세로 중심이 가까우면 같은 줄
        if cy is None or abs(yc - cy) <= 5:
            cur += chars
            cy = yc if cy is None else cy
        else:
            out.append(cur); cur, cy = list(chars), yc
    if cur:
        out.append(cur)
    res = []
    for chars in out:
        t = spaced(chars)
        if t and not FOOTER.search(t.replace(' ', '')):
            res.append(t)
    return res


def weld(lines, J):
    """줄들을 이어 붙인다. 줄바꿈 지점은 어절 통계로 띄울지 결정한다."""
    text = ''
    for t in lines:
        if text:
            L = text.rsplit(' ', 1)[-1]
            R = t.split(' ', 1)[0]
            if J.space_between(L, R):
                text += ' '
        text += t
    stream, pend = [], False
    for ch in text:
        if ch == ' ':
            pend = True
            continue
        stream.append((ch, pend))
        pend = False
    return stream


def _seg(stream, pos, length):
    out = []
    for i in range(pos, pos + length):
        ch, sp = stream[i]
        if sp and i > pos:
            out.append(' ')
        out.append(ch)
    return ''.join(out)


def rebuild(stream, hay, target, cursor):
    """target(공백무시)을 stream에서 찾아 띄어쓰기를 넣은 문자열로 되살린다.

    표 사이에 낀 소제목처럼 지문이 두 조각으로 떨어져 있을 수 있으므로,
    한 번에 못 찾으면 앞에서부터 가장 긴 조각씩 끊어 이어 붙인다.
    """
    nt = ns(target)
    if not nt:
        return target, cursor
    parts, i = [], 0
    while i < len(nt):
        lo, hi, best = 1, len(nt) - i, 0
        while lo <= hi:                       # 붙는 최장 길이를 이분탐색
            mid = (lo + hi) // 2
            if hay.find(nt[i:i + mid], cursor) >= 0:
                best = mid; lo = mid + 1
            else:
                hi = mid - 1
        if not best:
            return None, cursor
        pos = hay.find(nt[i:i + best], cursor)
        parts.append(_seg(stream, pos, best))
        i += best
        cursor = pos + best
    return ' '.join(p.strip() for p in parts).strip(), cursor


def subject_of(session, no):
    if session == 1:
        return SUBJ1[(no - 1) // 40], (no - 1) % 40 + 1
    return SUBJ2[(no - 1) // 40], (no - 1) % 40 + 1


J = joiner.Joiner(sys.argv[3])
D = json.load(open(sys.argv[1], encoding='utf-8'))
index = {}
for ex in D['exams']:
    for s in ex['subjects']:
        for q in s['questions']:
            index[(ex['round'], s['name'], q['no'])] = q

stat = {'q_ok': 0, 'q_no': 0, 'opt_ok': 0, 'opt_no': 0}
misses = []

for f in sorted(p for p in glob.glob('20*/*.pdf') if '정답' not in p and '가답안' not in p):
    rnd = ROUND[re.search(r'(20\d\d)', f).group(1)]
    sess = 1 if '1교시' in f else 2
    doc = fitz.open(f)
    starts = qstarts(doc)
    for i, (pi, y, no) in enumerate(starts):
        if i + 1 < len(starts):
            ep, ey = starts[i + 1][0], starts[i + 1][1]
        else:
            ep, ey = len(doc) - 1, 1e9
        lines = []
        for p in range(pi, ep + 1):
            lo = y if p == pi else -1e9
            hi = ey if p == ep else 1e9
            lines += page_lines(doc[p], lo, hi)
        stream = weld(lines, J)
        hay = ''.join(c for c, _ in stream)

        subj, sno = subject_of(sess, no)
        q = index[(rnd, subj, sno)]
        cursor = 0
        newq, cursor = rebuild(stream, hay, q['q'], cursor)
        if newq is None or ns(newq) != ns(q['q']):
            stat['q_no'] += 1; misses.append((rnd, subj, sno, 'q'))
        else:
            q['q'] = newq; stat['q_ok'] += 1

        if q.get('optionCells'):
            # 선지가 표인 문제 — 이미 띄어쓰기가 복원된 셀에서 평문 선지를 만든다
            for oi, cells in enumerate(q['optionCells']):
                q['options'][oi] = ' '.join(c for c in cells if c).strip()
                stat['opt_ok'] += 1
            continue
        for oi, opt in enumerate(q['options']):
            newo, cursor = rebuild(stream, hay, opt, cursor)
            if newo is None or ns(newo) != ns(opt):
                stat['opt_no'] += 1; misses.append((rnd, subj, sno, f'opt{oi+1}'))
            else:
                q['options'][oi] = newo; stat['opt_ok'] += 1

json.dump(D, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(f"지문 복원 {stat['q_ok']} / 실패 {stat['q_no']}")
print(f"선지 복원 {stat['opt_ok']} / 실패 {stat['opt_no']}")
for m in misses[:15]:
    print('  실패:', m)
