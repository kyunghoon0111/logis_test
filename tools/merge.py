# -*- coding: utf-8 -*-
"""추출한 표/박스 블록을 exams.json에 병합하고, 평문 지문에서 중복 텍스트를 제거한다."""
import json, re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

blocks_path, exams_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
B = json.load(open(blocks_path, encoding='utf-8'))
D = json.load(open(exams_path, encoding='utf-8'))


def ns(s):
    return re.sub(r'\s+', '', s or '')


def strip_ns(text, needle):
    """공백을 무시하고 needle을 text에서 한 번 제거. 실패하면 None."""
    if not needle:
        return text
    idx = []          # text 내 비공백 문자의 원본 인덱스
    buf = []
    for i, ch in enumerate(text):
        if not ch.isspace():
            idx.append(i); buf.append(ch)
    hay = ''.join(buf)
    pos = hay.find(needle)
    if pos < 0:
        return None
    a, b = idx[pos], idx[pos + len(needle) - 1]
    return text[:a] + text[b + 1:]


def block_text(blk):
    # flat: PDF 원문 읽기 순서 텍스트. 평문 지문이 이 순서로 만들어졌으므로 대조 기준으로 쓴다.
    if blk.get('flat'):
        return blk['flat']
    if blk['type'] == 'box':
        return ns(''.join(blk['lines']))
    return ns(''.join(c['t'] for row in blk['rows'] for c in row))


def cell_texts(blk):
    if blk['type'] == 'box':
        return [ns(l) for l in blk['lines']]
    return [ns(c['t']) for row in blk['rows'] for c in row]


CIRCLED = '①②③④⑤'


def as_option_table(blk, options):
    """선지 자체가 표인 유형: 첫 열이 ①~⑤ 이고 행 수가 선지 수와 맞는다."""
    if blk['type'] != 'table' or len(blk['rows']) != len(options) + 1:
        return None
    body = blk['rows'][1:]
    if not all(row and row[0]['t'].strip() == CIRCLED[i] for i, row in enumerate(body)):
        return None
    header = [c['t'] for c in blk['rows'][0]]
    header = header[1:] if header and not header[0].strip() else header
    cells = [[c['t'] for c in row[1:]] for row in body]
    if not all(ns(''.join(cs)) == ns(o) for cs, o in zip(cells, options)):
        return None
    return header, cells


stats = {'q': 0, 'blocks': 0, 'whole': 0, 'piecewise': 0, 'failed': 0, 'opttable': 0}
fails = []
piece = []

for ex in D['exams']:
    r = str(ex['round'])
    if r not in B:
        continue
    for subj in ex['subjects']:
        sm = B[r].get(subj['name'], {})
        for q in subj['questions']:
            blks = sm.get(str(q['no']))
            if not blks:
                continue
            stats['q'] += 1
            stats['blocks'] += len(blks)
            text = q['q']
            keep = []
            for blk in blks:
                ot = as_option_table(blk, q['options'])
                if ot:
                    header, cells = ot
                    q['optionHeader'] = header
                    q['optionCells'] = cells
                    stats['opttable'] += 1
                    t0 = strip_ns(text, ns(''.join(header)))
                    if t0 is not None:
                        text = t0
                    continue
                keep.append(blk)
                whole = block_text(blk)
                t2 = strip_ns(text, whole)
                if t2 is not None:
                    text = t2
                    stats['whole'] += 1
                    continue
                # 통째로 못 찾으면 셀/줄 단위로 순서대로 제거
                ok = 0
                for frag in cell_texts(blk):
                    if len(frag) < 2:
                        continue
                    t3 = strip_ns(text, frag)
                    if t3 is not None:
                        text = t3; ok += 1
                pieces = [p for p in cell_texts(blk) if len(p) >= 2]
                if ok >= max(1, int(len(pieces) * 0.8)):
                    stats['piecewise'] += 1
                    piece.append((r, subj['name'], q['no'], blk['type'], ok, len(pieces)))
                else:
                    stats['failed'] += 1
                    fails.append((r, subj['name'], q['no'], blk['type'], ok, len(pieces)))
            for blk in blks:
                blk.pop('flat', None)
            text = re.sub(r'\s+', ' ', text).strip()
            text = re.sub(r'\s+([,.?)\]])', r'\1', text)
            q['q'] = text
            if keep:
                q['blocks'] = keep

json.dump(D, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
print(f"블록 붙은 문항 {stats['q']}, 블록 {stats['blocks']}")
print(f"  통째 제거 {stats['whole']}, 조각 제거 {stats['piecewise']}, 실패 {stats['failed']}, 선지형표 {stats['opttable']}")
for x in piece: print('  조각:', x)
for f in fails[:20]:
    print('  실패:', f)
