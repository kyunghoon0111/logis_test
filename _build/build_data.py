# -*- coding: utf-8 -*-
"""6개년 exam_structured.json -> app/data/exams.json 통합 빌드.
_patches/ 에 해설 패치가 있으면 병합해서 반영한다.
"""
import json, glob, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'app', 'data', 'exams.json')
PATCH_DIR = os.path.join(ROOT, '_patches')

YEAR_BY_ROUND = {24: 2020, 25: 2021, 26: 2022, 27: 2023, 28: 2024, 29: 2025}
SUBJECT_ORDER = ['물류관리론', '화물운송론', '국제물류론', '보관하역론', '물류관련법규']


def normalize_answer(raw):
    """정답을 인정 답안 리스트로 정규화. 복수정답/전항정답 대응.
    반환: (primary_int, accept_list)"""
    if isinstance(raw, int):
        return raw, [raw]
    s = str(raw).strip().lower()
    if s in ('all', '전항', '전항정답'):
        return 1, [1, 2, 3, 4, 5]
    nums = [int(x) for x in re.findall(r'[1-5]', s)]
    nums = sorted(set(nums))
    if not nums:
        return 1, [1]
    return nums[0], nums


def load_patches():
    patches = {}  # (round, subjIdx) -> {no(str): {...}}
    for p in glob.glob(os.path.join(PATCH_DIR, 'exp_*.json')):
        try:
            d = json.load(open(p, encoding='utf-8'))
            patches[(d['round'], d['subjectIndex'])] = d['explanations']
        except Exception as e:
            print('  [warn] patch load fail', p, e)
    return patches


def main():
    patches = load_patches()
    exams = []
    for f in sorted(glob.glob(os.path.join(ROOT, '*', 'exam_structured.json'))):
        d = json.load(open(f, encoding='utf-8'))
        info = d['examInfo']
        rnd = info['round']
        year = info.get('year') or YEAR_BY_ROUND.get(rnd)
        subjects = []
        exp_count = 0
        for si, s in enumerate(d['subjects']):
            patch = patches.get((rnd, si), {})
            qs = []
            for q in s['questions']:
                no = q['no']
                exp = q.get('explanation')
                tip = q.get('examTip')
                rel = q.get('relatedTopic')
                pk = patch.get(str(no))
                if pk:
                    exp = exp or pk.get('explanation')
                    tip = tip or pk.get('examTip')
                    rel = rel or pk.get('relatedTopic')
                if exp:
                    exp_count += 1
                primary, accept = normalize_answer(q['answer'])
                qs.append({
                    'no': no,
                    'q': q['question'],
                    'options': q['options'],
                    'answer': primary,
                    'accept': accept,
                    'explanation': exp or '',
                    'examTip': tip or '',
                    'relatedTopic': rel or '',
                })
            subjects.append({'name': s['name'], 'questions': qs})
        total_q = sum(len(s['questions']) for s in subjects)
        exams.append({
            'round': rnd,
            'year': year,
            'title': f'제{rnd}회 물류관리사',
            'totalQuestions': total_q,
            'explained': exp_count,
            'subjects': subjects,
        })
        print(f'제{rnd}회({year}) 문제 {total_q} 해설 {exp_count}/{total_q}')

    exams.sort(key=lambda e: e['round'])
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    out = {
        'meta': {
            'name': '물류관리사 기출문제',
            'subjectOrder': SUBJECT_ORDER,
            'passRule': {'perSubjectMin': 40, 'avgMin': 60, 'maxScore': 100},
            'roundCount': len(exams),
        },
        'exams': exams,
    }
    json.dump(out, open(OUT, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    size = os.path.getsize(OUT)
    print(f'\n저장: {OUT}  ({size/1024:.0f} KB)  회차 {len(exams)}개')


if __name__ == '__main__':
    main()
