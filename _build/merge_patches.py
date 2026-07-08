# -*- coding: utf-8 -*-
"""_patches/exp_*.json 해설을 각 연도 exam_structured.json 원본에 병합."""
import json, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROUND_FOLDER = {}
for f in glob.glob(os.path.join(ROOT, '*', 'exam_structured.json')):
    d = json.load(open(f, encoding='utf-8'))
    ROUND_FOLDER[d['examInfo']['round']] = f

patches = {}
for p in glob.glob(os.path.join(ROOT, '_patches', 'exp_*.json')):
    d = json.load(open(p, encoding='utf-8'))
    patches.setdefault(d['round'], {})[d['subjectIndex']] = d['explanations']

changed = 0
for rnd, byidx in patches.items():
    f = ROUND_FOLDER.get(rnd)
    if not f:
        print('  [skip] round', rnd, 'no source'); continue
    d = json.load(open(f, encoding='utf-8'))
    added = 0
    for si, exps in byidx.items():
        for q in d['subjects'][si]['questions']:
            e = exps.get(str(q['no']))
            if e and not q.get('explanation'):
                q['explanation'] = e.get('explanation', '')
                q['examTip'] = e.get('examTip', '')
                q['relatedTopic'] = e.get('relatedTopic', '')
                added += 1
    json.dump(d, open(f, 'w', encoding='utf-8'), ensure_ascii=False, indent=2)
    changed += added
    print(f'제{rnd}회: {added}문항 해설 병합')

print(f'\n총 {changed}문항 병합 완료')
