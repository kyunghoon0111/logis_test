# SQLD → 물류관리사 앱 전환 구현 계획서

## 개요
기존 SQLD 학습 PWA 앱을 **물류관리사 시험 대비 앱**으로 전환한다.
`물관_데이터/` 폴더에 5과목 35파트의 concepts/quizzes JSON(70개 파일)이 이미 준비되어 있다.
앱 구조(라우터, 상태관리, 컴포넌트)는 그대로 재사용하고, 데이터 로딩·메타데이터·UI 텍스트만 변경한다.

---

## 과목 구성

| 과목 | ID | 폴더명 | 파트 수 | 색상 |
|------|-----|--------|---------|------|
| 물류관리론 | s1 | `1. 물류관리론` | 8 (part01~08) | #3B82F6 |
| 화물운송론 | s2 | `2. 화물운송론` | 8 (part01~08) | #8B5CF6 |
| 국제물류론 | s3 | `3. 국제물류론` | 4 (part01~04) | #06B6D4 |
| 보관하역론 | s4 | `4. 보관하역론` | 8 (part01~08) | #10B981 |
| 물류관련법규 | s5 | `5. 물류관련법규` | 7 (part01~07) | #F59E0B |

**합격 기준**: 과목당 100점, 과락 40점 이상, 전과목 평균 60점 이상

### 데이터 파일 구조
- 경로 패턴: `물관_데이터/{과목폴더}/part{NN}_concepts.json`, `part{NN}_quizzes.json`
- concepts JSON: `{ "chapter": "PART 01 물류관리총론", "subject": "물류관리론", "sections": [...] }`
  - 각 section: `{ id, title, content, keyPoints[], tips[], tables[], formulaExamples[] }`
  - `formulaExamples`: `[{ formula: "수식 텍스트", desc: "설명" }]` (SQLD의 sqlExamples 대체)
- quizzes JSON: `{ "chapter": "PART 01 물류관리총론", "subject": "물류관리론", "quizzes": [...] }`
  - 각 quiz: `{ id, type, format, difficulty, topic, question, options(A~E 5지선다), answer, explanation, relatedConcept, examTip }`

---

## 수정 파일 목록 (12개)

### 1. `js/data.js` — 핵심 변경

**현재 구조:**
- `DATA_BASE = './data/'`
- `CHAPTER_META`: 5개 챕터 (s1-ch1, s1-ch2, s2-ch1, s2-ch2, s2-ch3)
- `SUBJECT_META`: 2과목 (s1, s2)
- `loadAll()`: 8개 JSON 파일 수동 나열하여 병렬 fetch
- `normalizeSubject1Concepts()`: 1과목 전용 (배열 형태 처리)
- `normalizeChapterConcepts()`: 2과목 전용 (단일 객체 처리)
- `normalizeSection()`: `sqlExamples` 필드 포함
- `detectS1Chapter()`: 1과목 퀴즈 챕터 감지

**변경 사항:**
- `DATA_BASE` → `'./물관_데이터/'`
- `CHAPTER_META` → 35개 파트 정의. ID 패턴: `'s1-p01'` ~ `'s5-p07'`
  ```js
  // 예시
  's1-p01': { label: 'PART 01', fullLabel: 'PART 01 물류관리총론', subject: 's1', color: '#3B82F6' },
  's1-p02': { label: 'PART 02', fullLabel: 'PART 02 물류관리 전략과 계획', subject: 's1', color: '#3B82F6' },
  // ... 35개 전부
  ```
  각 파트의 fullLabel은 해당 concepts JSON의 `chapter` 값과 매칭시킬 것
- `SUBJECT_META` → 5과목 정의
  ```js
  's1': { label: '1과목', fullLabel: '물류관리론', color: '#3B82F6', chapters: ['s1-p01','s1-p02',...,'s1-p08'], maxScore: 100, passScore: 40 },
  // ... 5과목
  ```
- `loadAll()` → 반복문으로 동적 로딩
  ```js
  // 과목별 폴더명과 파트 수 정의
  const SUBJECT_FILES = [
    { id: 's1', folder: '1. 물류관리론', parts: 8 },
    { id: 's2', folder: '2. 화물운송론', parts: 8 },
    { id: 's3', folder: '3. 국제물류론', parts: 4 },
    { id: 's4', folder: '4. 보관하역론', parts: 8 },
    { id: 's5', folder: '5. 물류관련법규', parts: 7 },
  ];
  // 모든 파일 경로 생성 후 Promise.all로 병렬 fetch
  // 각 결과를 normalizeChapterConcepts(), normalizeQuizzes()로 처리
  ```
- `normalizeSubject1Concepts()` → **삭제** (모든 새 데이터가 단일 객체 형태)
- `normalizeChapterConcepts()` → 그대로 재사용 (단, subjectId를 chapterId에서 추출하지 않고 명시적 전달)
- `normalizeSection()` → `sqlExamples` 필드를 `formulaExamples`로 변경
- `normalizeQuiz()` → `subjectId` 결정 로직 변경 (chapterId 접두사 `s1`~`s5` 기반)
- `detectS1Chapter()` → **삭제**

### 2. `js/state.js`

**변경 사항:**
- 5행: `STORAGE_KEY` → `'logis_state_v1'`
- 21행: `lastStudyChapter` 기본값 → `'s1-p01'`
- 179~198행: `getProgress()` 합격 예측 로직 전면 변경
  ```js
  // 현재 (SQLD): s1 20점, s2 80점, 합계 60점↑
  // 변경 (물류관리사): 5과목 각 100점, 과락 40점, 평균 60점↑
  // 각 과목 정답률 × 100 = 예상 점수
  // passes = 모든 과목 40점↑ && 평균 60점↑
  ```
- `estimatedScore` 반환 형태 변경: `{ bySubject: {s1: score, ...}, totalAvg, passes, hasTried }`

### 3. `js/components/conceptCard.js`

**변경 사항:**
- 12~30행: `SQL_KEYWORDS` 배열 → **삭제**
- 32행: `KW_SORTED` → **삭제**
- 34~54행: `highlightSQL()` 함수 → **삭제**
- 120~128행: `sqlExamples` 렌더링 블록 → `formulaExamples` 렌더링으로 변경
  ```js
  // formulaExamples 렌더링
  if (section.formulaExamples?.length) {
    parts.push(section.formulaExamples.map(ex => `
      <div class="formula-block">
        ${ex.formula ? `<div class="formula-text">${escHtml(ex.formula)}</div>` : ''}
        ${ex.desc ? `<div class="formula-desc">${escHtml(ex.desc)}</div>` : ''}
      </div>
    `).join(''));
  }
  ```
- `.formula-block`, `.formula-text`, `.formula-desc` 스타일은 기존 `.sql-block` 스타일을 활용하거나 간단히 새로 정의

### 4. `js/screens/study.js`

**현재**: 5개 챕터 탭이 한 줄로 나열
**문제**: 35개 파트를 한 줄 탭으로 표시 불가

**변경: 2단계 탭 네비게이션**
- 상단: 과목 탭 5개 (물류관리론, 화물운송론, 국제물류론, 보관하역론, 물류관련법규)
- 하단: 선택된 과목의 파트 탭 (PART 01, PART 02, ...)
- `CHAPTERS` 상수 삭제 → `store.subjects`와 `store.chapters`에서 동적 생성
  ```js
  const SUBJECTS = Object.entries(store.subjects).map(([id, meta]) => ({ id, label: meta.fullLabel }));
  // 과목 선택 시 해당 chapters 배열로 파트 탭 생성
  ```

### 5. `js/screens/quiz.js`

**변경 사항:**
- 56~63행: 범위 칩(scope-group) → 전체 + 5과목
  ```html
  <button class="toggle-chip active" data-scope="all">전체</button>
  <button class="toggle-chip" data-scope="s1">물류관리론</button>
  <button class="toggle-chip" data-scope="s2">화물운송론</button>
  <button class="toggle-chip" data-scope="s3">국제물류론</button>
  <button class="toggle-chip" data-scope="s4">보관하역론</button>
  <button class="toggle-chip" data-scope="s5">물류관련법규</button>
  ```
- `buildFilterOpts()` (176~186행): scope 처리 로직 변경
  - `s1`~`s5` → subjectId 필터
  - 파트 단위 필터는 과목 선택 후 추가 칩으로 (선택사항)

### 6. `js/screens/home.js`

**변경 사항:**
- 25행: `"오늘도 SQLD 합격을 향해"` → `"오늘도 물류관리사 합격을 향해"`
- 142행: `"SQLD 시험"` → `"물류관리사 시험"`
- 235행: `"SQLD 시험 날짜를 입력하세요"` → `"물류관리사 시험 날짜를 입력하세요"`
- 96~98행: 합격 예측 표시 → 5과목 점수 표시
  ```js
  // 현재: 1과목 ${est.s1Score}/20점, 2과목 ${est.s2Score}/80점
  // 변경: 각 과목 점수/100점 + 과락 여부 표시
  ```
- 157~179행: `renderSubjectProgress()` → 5과목으로 확장
- 190~196행: `renderWeakChapters()` → CHAPTER_NAMES를 store.chapters에서 동적으로 가져오기

### 7. `js/screens/progress.js`

**변경 사항:**
- 9~23행: `CHAPTER_NAMES`, `CHAPTER_COLORS` → store.chapters에서 동적으로 가져오기
- 42~55행: 합격 예측 카드 → 5과목 기준
  - 각 과목 점수/100점 + 과락 40점 체크
  - 평균 60점 합격 판정
  - 안내 텍스트: `"합격기준: 평균 60점↑, 과목별 40점↑"`

### 8. `index.html`

- 10행: `content="SQLD"` → `content="물류관리사"`
- 17행: `<title>SQLD - SQL 개발자</title>` → `<title>물류관리사</title>`
- 31행: `SQLD` → `물류관리사`
- 52행: `SQLD` → `물류관리사`

### 9. `manifest.json`

- `"name"` → `"물류관리사 시험"`
- `"short_name"` → `"물류관리사"`
- `"description"` → `"물류관리사 자격증 시험 대비 앱 - 개념 학습 및 문제 풀이"`

### 10. `sw.js`

- 6행: `CACHE_VER` → `'logis-v1'`
- 7행: `DATA_CACHE` → `'logis-data-v1'`
- 38~47행: `DATA_FILES` → 70개 새 파일 경로 (물관_데이터 하위)
- 77행: `url.pathname.includes('/data/')` → 물관_데이터 경로 감지로 변경

### 11. `css/base.css`

- 42~48행: 챕터 색상 CSS 변수 → 5과목 색상으로 교체
  ```css
  --s1-color: #3B82F6;
  --s2-color: #8B5CF6;
  --s3-color: #06B6D4;
  --s4-color: #10B981;
  --s5-color: #F59E0B;
  ```

### 12. `data/` 폴더 — 삭제
- 기존 SQLD JSON 파일 8개 삭제 (sqld_subject1_*.json, sqld_2_ch*_*.json)

---

## 변경하지 않는 파일
- `js/router.js` — 범용 라우터
- `js/components/bottomNav.js` — 범용 네비게이션
- `js/components/quizCard.js` — 범용 퀴즈 카드 렌더링
- `js/components/progressRing.js` — 범용 원형 진도 표시
- `js/components/toast.js` — 범용 토스트 알림
- `js/components/search.js` — 범용 검색 (data.js의 searchIndex 활용)
- `js/screens/bookmarks.js` — 범용 즐겨찾기
- `css/layout.css`, `css/components.css`, `css/screens.css`, `css/animations.css`

---

## 구현 순서 (권장)
1. `data.js` — 메타데이터 + 로더 변경 (이것이 동작해야 나머지 가능)
2. `state.js` — 스토리지 키 + 합격 예측 로직
3. `conceptCard.js` — formulaExamples 렌더링 (sqlExamples/highlightSQL 제거)
4. `study.js` — 2단계 과목→파트 탭 UI
5. `quiz.js` — 5과목 범위 선택 UI
6. `home.js` — 텍스트 + 5과목 진도 + 합격 예측
7. `progress.js` — 동적 챕터 이름 + 5과목 합격 예측
8. `index.html` + `manifest.json` + `sw.js` — 앱 메타 정보
9. `base.css` — 챕터 색상 변수
10. `data/` 폴더 삭제

---

## 검증 체크리스트
- [ ] 앱 실행 → 홈 화면 "물류관리사" 로고 표시
- [ ] 5과목 데이터 전부 로딩 (콘솔 에러 없음)
- [ ] 개념 학습 → 과목 탭 5개 전환, 파트별 카드/리스트 표시
- [ ] formulaExamples가 있는 섹션에서 수식 정상 표시
- [ ] 퀴즈 → 과목별 문제 필터링 동작
- [ ] 5지선다(A~E) 퀴즈 정상 표시 및 채점
- [ ] 진도 현황 → 5과목 합격 예측 (과락 40점, 평균 60점)
- [ ] D-Day → "물류관리사 시험" 표시
- [ ] localStorage 키 → `logis_state_v1` 확인
- [ ] 서비스 워커 → 새 캐시명 `logis-v1` 동작
