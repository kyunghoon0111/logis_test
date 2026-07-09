# -*- coding: utf-8 -*-
"""기출 PDF에서 문항별 표와 박스 지문을 괘선 좌표 기반으로 추출한다.

    python tools/extract.py blocks.json lex.json      (저장소 루트에서 실행)

테두리 있는 영역을 선분 연결요소로 찾고, 그 안의 세로/가로 괘선으로 격자를 세운다.
격자가 1x1이면 박스 지문, 그 외에는 표. 셀 병합은 경계 괘선의 존재 여부로 판정한다.
"""
import fitz, re, json, sys, glob, io
import joiner

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

ROUND = {'2020': 24, '2021': 25, '2022': 26, '2023': 27, '2024': 28, '2025': 29}
SUBJ1 = ['물류관리론', '화물운송론', '국제물류론']
SUBJ2 = ['보관하역론', '물류관련법규']
EPS = 3.0
SPACE_RATIO = 0.3   # 글자 사이 간격이 폰트 크기의 30%를 넘으면 띄어쓰기로 본다

J = joiner.Joiner(sys.argv[2])


def weld_lines(lines):
    """셀 안에서 줄이 바뀔 때 띄어쓸지 붙일지 어절 통계로 정한다."""
    text = ''
    for t in lines:
        if not t:
            continue
        if text and J.space_between(text.rsplit(' ', 1)[-1], t.split(' ', 1)[0]):
            text += ' '
        text += t
    return text


def spaced(chars):
    """글자 좌표 간격으로 띄어쓰기를 복원한다. PDF에 공백 글자가 없어 위치로만 표현돼 있다."""
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


def raw_chars(page, clip=None):
    """[(y중심, char)] — clip 안의 모든 글자"""
    d = page.get_text('rawdict', clip=fitz.Rect(*clip)) if clip else page.get_text('rawdict')
    out = []
    for b in d['blocks']:
        if b['type'] != 0:
            continue
        for l in b['lines']:
            for s in l['spans']:
                for c in s['chars']:
                    out.append(((c['bbox'][1] + c['bbox'][3]) / 2, c))
    return out


def group_lines(chars, tol=5.0):
    """세로 중심이 가까운 글자끼리 한 줄로 묶는다."""
    chars.sort(key=lambda t: (t[0], t[1]['bbox'][0]))
    lines, cur, cy = [], [], None
    for yc, c in chars:
        if cy is None or abs(yc - cy) <= tol:
            cur.append(c)
            cy = yc if cy is None else cy
        else:
            lines.append(cur); cur, cy = [c], yc
    if cur:
        lines.append(cur)
    return lines


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


def segments(page):
    H, V, DIAG = [], [], []
    for d in page.get_drawings():
        if d['type'] != 's':
            continue
        r = d['rect']
        w, h = r.x1 - r.x0, r.y1 - r.y0
        if h < 2 and w >= 2:
            H.append((r.x0, r.y0, r.x1, r.y1))
        elif w < 2 and h >= 2:
            V.append((r.x0, r.y0, r.x1, r.y1))
        elif w >= 2 and h >= 2:
            DIAG.append((r.x0, r.y0, r.x1, r.y1))
    return H, V, DIAG


def regions(H, V):
    """선분들을 연결요소로 묶어 테두리 영역을 만든다."""
    segs = H + V
    if not segs:
        return []
    used = [False] * len(segs)
    out = []
    for i in range(len(segs)):
        if used[i]:
            continue
        grp = [i]; used[i] = True
        changed = True
        while changed:
            changed = False
            x0 = min(segs[k][0] for k in grp); y0 = min(segs[k][1] for k in grp)
            x1 = max(segs[k][2] for k in grp); y1 = max(segs[k][3] for k in grp)
            for j in range(len(segs)):
                if used[j]:
                    continue
                s = segs[j]
                if not (x1 + 4 < s[0] or s[2] + 4 < x0 or y1 + 4 < s[1] or s[3] + 4 < y0):
                    grp.append(j); used[j] = True; changed = True
        x0 = min(segs[k][0] for k in grp); y0 = min(segs[k][1] for k in grp)
        x1 = max(segs[k][2] for k in grp); y1 = max(segs[k][3] for k in grp)
        nh = sum(1 for k in grp if segs[k][3] - segs[k][1] < 2)
        nv = sum(1 for k in grp if segs[k][2] - segs[k][0] < 2)
        if x1 - x0 > 150 and y1 - y0 > 12 and nh >= 2 and nv >= 2 and not (x1 - x0 > 500 and y1 - y0 > 700):
            out.append(((x0, y0, x1, y1), [segs[k] for k in grp]))
    return out


def uniq(vals):
    vals = sorted(vals)
    out = []
    for v in vals:
        if not out or v - out[-1] > EPS:
            out.append(v)
    return out


def has_v(segs, x, y0, y1):
    """x 위치에 y0~y1 구간을 덮는 세로 괘선이 있는가"""
    for s in segs:
        if s[2] - s[0] < 2 and abs(s[0] - x) <= EPS and s[1] <= y0 + EPS and s[3] >= y1 - EPS:
            return True
    return False


def has_h(segs, y, x0, x1):
    for s in segs:
        if s[3] - s[1] < 2 and abs(s[1] - y) <= EPS and s[0] <= x0 + EPS and s[2] >= x1 - EPS:
            return True
    return False


def merge_runs(segs):
    """같은 직선 위에서 맞닿은 선분들을 하나로 잇는다.

    표 괘선은 셀 단위로 쪼개져 그려지는 경우가 많다. 이어 붙이지 않으면
    '행 전체를 가로지르는 선'을 알아볼 수 없어 병합 셀 판정이 어긋난다.
    """
    out = []
    for horiz in (True, False):
        group = {}
        for s in segs:
            is_h = s[3] - s[1] < 2
            if is_h != horiz:
                continue
            key = round((s[1] if horiz else s[0]) / EPS)
            group.setdefault(key, []).append(s)
        for key, items in group.items():
            items.sort(key=lambda s: s[0] if horiz else s[1])
            cur = list(items[0])
            for s in items[1:]:
                lo, hi = (0, 2) if horiz else (1, 3)
                if s[lo] <= cur[hi] + EPS:
                    cur[hi] = max(cur[hi], s[hi])
                else:
                    out.append(tuple(cur)); cur = list(s)
            out.append(tuple(cur))
    return out


def grid_table(page, rect, segs, words, major_only=False):
    x0, y0, x1, y1 = rect
    segs = merge_runs(segs)
    if major_only:
        # 수송표는 셀 안에 운임 표시용 소형 칸이 또 있다 — 표 전체를 가로지르는 괘선만 쓴다
        segs = [s for s in segs
                if (s[3] - s[1] < 2 and s[2] - s[0] >= 0.9 * (x1 - x0))
                or (s[2] - s[0] < 2 and s[3] - s[1] >= 0.9 * (y1 - y0))]
    xs = uniq([s[0] for s in segs if s[2] - s[0] < 2] + [x0, x1])
    ys = uniq([s[1] for s in segs if s[3] - s[1] < 2] + [y0, y1])
    nc, nr = len(xs) - 1, len(ys) - 1
    if nc < 1 or nr < 1:
        return None
    occupied = [[False] * nc for _ in range(nr)]
    cells = []                      # {r,c,cs,rs,t}
    for r in range(nr):
        for c in range(nc):
            if occupied[r][c]:
                continue
            cs, rs = 1, 1
            while c + cs < nc and not has_v(segs, xs[c + cs], ys[r], ys[r + 1]):
                cs += 1
            while r + rs < nr and not has_h(segs, ys[r + rs], xs[c], xs[c + cs]):
                rs += 1
            for rr in range(r, r + rs):
                for cc in range(c, c + cs):
                    occupied[rr][cc] = True
            cx0, cy0, cx1, cy1 = xs[c], ys[r], xs[c + cs], ys[r + rs]
            inside = [(yc, ch) for yc, ch in words
                      if cx0 <= (ch['bbox'][0] + ch['bbox'][2]) / 2 <= cx1 and cy0 <= yc <= cy1]
            txt = weld_lines([spaced(ln) for ln in group_lines(inside)])
            cells.append({'r': r, 'c': c, 'cs': cs, 'rs': rs, 't': re.sub(r'\s+', ' ', txt).strip()})

    # 수송표처럼 대각선 분할 셀이 있으면 빈 행/열이 생긴다 — 통째로 빈 것만 걷어낸다
    def col_empty(c):
        return all(cl['t'] == '' for cl in cells if cl['c'] == c and cl['cs'] == 1)

    def row_empty(r):
        return all(cl['t'] == '' for cl in cells if cl['r'] == r and cl['rs'] == 1)

    dead_c = {c for c in range(nc) if col_empty(c)}
    dead_r = {r for r in range(nr) if row_empty(r)}
    if len(dead_c) >= nc or len(dead_r) >= nr:
        return None
    cmap = {c: i for i, c in enumerate(sorted(set(range(nc)) - dead_c))}
    rmap = {r: i for i, r in enumerate(sorted(set(range(nr)) - dead_r))}
    rows = {}
    for cl in cells:
        # 병합 셀은 살아남은 열/행이 하나라도 있으면 유지한다(헤더가 빈 하위열에서 시작할 수 있음)
        cols = [c for c in range(cl['c'], cl['c'] + cl['cs']) if c not in dead_c]
        rws = [r for r in range(cl['r'], cl['r'] + cl['rs']) if r not in dead_r]
        if not cols or not rws:
            continue
        cs, rs = len(cols), len(rws)
        rows.setdefault(rmap[rws[0]], []).append(
            (cmap[cols[0]], {'t': cl['t'], **({'cs': cs} if cs > 1 else {}),
                             **({'rs': rs} if rs > 1 else {})}))
    out = [[c for _, c in sorted(v)] for _, v in sorted(rows.items())]
    return {'cols': len(cmap), 'rows': out}


def box_lines(page, rect):
    """박스 안 텍스트를 시각적 줄 단위로 묶는다.

    폰트가 섞인 줄은 dict에서 조각난 line으로 나오고 bbox의 y도 조금씩 다르다.
    y 좌표만으로 정렬하면 'the IncotermsⓇ2020 order' 같은 순서가 뒤집히므로
    세로 중심이 가까운 조각끼리 한 줄로 묶은 뒤 x 순으로 잇는다.
    """
    lines = group_lines(raw_chars(page, rect))
    return [t for t in (spaced(ln) for ln in lines) if t]


def extract(path):
    doc = fitz.open(path)
    starts = qstarts(doc)
    spans = []
    for i, (pi, y, no) in enumerate(starts):
        nxt = starts[i + 1] if i + 1 < len(starts) else (len(doc), 0, None)
        spans.append((no, (pi, y), (nxt[0], nxt[1])))
    items = {no: [] for no, _, _ in spans}

    for pi, page in enumerate(doc):
        H, V, DIAG = segments(page)
        words = raw_chars(page)
        for rect, segs in regions(H, V):
            owner = None
            for no, (sp, sy), (ep, ey) in spans:
                after = (pi > sp) or (pi == sp and rect[1] >= sy - 2)
                before = (pi < ep) or (pi == ep and rect[1] < ey - 2)
                if after and before:
                    owner = no
            if owner is None:
                continue
            has_diag = any(rect[0] - 2 <= d[0] and d[2] <= rect[2] + 2
                           and rect[1] - 2 <= d[1] and d[3] <= rect[3] + 2 for d in DIAG)
            # 지문 대조용: PDF 원문 읽기 순서 그대로의 텍스트
            flat = re.sub(r'\s+', '', page.get_text('text', clip=fitz.Rect(*rect)))
            g = grid_table(page, rect, segs, words, major_only=has_diag)
            if g and (g['cols'] > 1 or len(g['rows']) > 1):
                items[owner].append((pi, rect[1],
                                     {'type': 'table', 'cols': g['cols'], 'rows': g['rows'], 'flat': flat}))
            else:
                lines = box_lines(page, rect)
                # 과목명 배너("화 물 운 송 론")도 테두리 박스라 걸린다 — 제외
                if lines and re.sub(r'\s', '', ''.join(lines)) not in SUBJ1 + SUBJ2:
                    items[owner].append((pi, rect[1], {'type': 'box', 'lines': lines, 'flat': flat}))
    for no in items:
        items[no].sort(key=lambda x: (x[0], x[1]))
    return {no: [b for _, _, b in v] for no, v in items.items() if v}


def subject_of(session, no):
    if session == 1:
        return SUBJ1[(no - 1) // 40], (no - 1) % 40 + 1
    return SUBJ2[(no - 1) // 40], (no - 1) % 40 + 1


out = {}
ntab = nbox = 0
for f in sorted(p for p in glob.glob('20*/*.pdf') if '정답' not in p and '가답안' not in p):
    rnd = ROUND[re.search(r'(20\d\d)', f).group(1)]
    sess = 1 if '1교시' in f else 2
    items = extract(f)
    t = sum(1 for v in items.values() for b in v if b['type'] == 'table')
    b_ = sum(1 for v in items.values() for b in v if b['type'] == 'box')
    ntab += t; nbox += b_
    print(f'{rnd}회 {sess}교시: 표 {t}, 박스 {b_}, 블록 있는 문항 {len(items)}')
    for no, blks in items.items():
        subj, sno = subject_of(sess, no)
        out.setdefault(str(rnd), {}).setdefault(subj, {})[str(sno)] = blks

json.dump(out, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'합계: 표 {ntab}, 박스 {nbox} -> {sys.argv[1]}')
