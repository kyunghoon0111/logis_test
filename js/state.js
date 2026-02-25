/**
 * state.js - localStorage 기반 상태 관리
 */

const STORAGE_KEY = 'logis_state_v1';

const DEFAULT_STATE = {
  // 개념 학습 완료
  studiedSections: {},      // { sectionId: true }
  // 퀴즈 결과
  quizResults: {},          // { quizId: { correct: bool, attempts: int, lastAt: timestamp } }
  // 즐겨찾기
  bookmarkedSections: {},   // { sectionId: true }
  bookmarkedQuizzes: {},    // { quizId: true }
  // 퀴즈 세션 (앱 종료 후 복구용)
  quizSession: null,
  // UI 설정
  darkMode: 'auto',         // 'auto' | 'light' | 'dark'
  studyViewMode: 'card',    // 'card' | 'list'
  lastScreen: 'home',
  lastStudyChapter: 's1-p01',
  lastSectionIndex: 0,
  // 시험 날짜
  examDate: null,
  // 학습 스트릭
  studyStreak: 0,
  lastStudyDate: null,
};

let _state = null;

function _load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_STATE };
}

function _save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
  } catch {}
}

export const state = {
  init() {
    _state = _load();
    _updateStreak();
  },

  get(key) {
    return _state[key];
  },

  set(key, value) {
    _state[key] = value;
    _save();
  },

  /* === 개념 학습 === */
  markStudied(sectionId) {
    _state.studiedSections[sectionId] = true;
    _save();
  },
  unmarkStudied(sectionId) {
    delete _state.studiedSections[sectionId];
    _save();
  },
  isStudied(sectionId) {
    return !!_state.studiedSections[sectionId];
  },

  /* === 퀴즈 결과 === */
  recordQuiz(quizId, correct) {
    const prev = _state.quizResults[quizId] || { correct: false, attempts: 0 };
    _state.quizResults[quizId] = {
      correct,
      attempts: prev.attempts + 1,
      lastAt: Date.now(),
    };
    _save();
  },
  getQuizResult(quizId) {
    return _state.quizResults[quizId] || null;
  },

  /* === 즐겨찾기 === */
  toggleBookmarkSection(sectionId) {
    if (_state.bookmarkedSections[sectionId]) {
      delete _state.bookmarkedSections[sectionId];
    } else {
      _state.bookmarkedSections[sectionId] = true;
    }
    _save();
    return !!_state.bookmarkedSections[sectionId];
  },
  toggleBookmarkQuiz(quizId) {
    if (_state.bookmarkedQuizzes[quizId]) {
      delete _state.bookmarkedQuizzes[quizId];
    } else {
      _state.bookmarkedQuizzes[quizId] = true;
    }
    _save();
    return !!_state.bookmarkedQuizzes[quizId];
  },
  isBookmarkedSection(sectionId) { return !!_state.bookmarkedSections[sectionId]; },
  isBookmarkedQuiz(quizId)       { return !!_state.bookmarkedQuizzes[quizId]; },

  getBookmarkedSectionIds() {
    return Object.keys(_state.bookmarkedSections).filter(id => _state.bookmarkedSections[id]);
  },
  getBookmarkedQuizIds() {
    return Object.keys(_state.bookmarkedQuizzes).filter(id => _state.bookmarkedQuizzes[id]);
  },

  /* === 퀴즈 세션 === */
  setQuizSession(session) {
    _state.quizSession = session;
    _save();
  },
  getQuizSession() { return _state.quizSession; },
  clearQuizSession() {
    _state.quizSession = null;
    _save();
  },

  /* === 통계 계산 === */
  getProgress(store) {
    const allSections = store.allSectionIds;
    const allQuizzes  = store.allQuizIds;

    const studiedCount  = Object.keys(_state.studiedSections).length;
    const attemptedList = Object.entries(_state.quizResults);
    const attemptedCount = attemptedList.length;
    const correctCount   = attemptedList.filter(([, v]) => v.correct).length;

    const bySubject = {};
    const byChapter = {};

    Object.keys(store.subjects).forEach(sid => {
      const subChapters = store.subjects[sid].chapters;
      const subSections = allSections.filter(id => store.sections[id]?.subjectId === sid);
      const subQuizzes  = allQuizzes.filter(id => store.quizzes[id]?.subjectId === sid);

      const studiedInSub  = subSections.filter(id => _state.studiedSections[id]).length;
      const attemptedInSub = subQuizzes.filter(id => _state.quizResults[id]).length;
      const correctInSub   = subQuizzes.filter(id => _state.quizResults[id]?.correct).length;

      bySubject[sid] = {
        totalSections:    subSections.length,
        studiedSections:  studiedInSub,
        studyPercent:     subSections.length ? Math.round(studiedInSub / subSections.length * 100) : 0,
        totalQuizzes:     subQuizzes.length,
        attemptedQuizzes: attemptedInSub,
        correctQuizzes:   correctInSub,
        accuracy:         attemptedInSub ? Math.round(correctInSub / attemptedInSub * 100) : 0,
      };

      subChapters.forEach(chId => {
        const chSections = allSections.filter(id => store.sections[id]?.chapterId === chId);
        const chQuizzes  = allQuizzes.filter(id => store.quizzes[id]?.chapterId === chId);
        const chStudied   = chSections.filter(id => _state.studiedSections[id]).length;
        const chAttempted = chQuizzes.filter(id => _state.quizResults[id]).length;
        const chCorrect   = chQuizzes.filter(id => _state.quizResults[id]?.correct).length;

        byChapter[chId] = {
          totalSections:    chSections.length,
          studiedSections:  chStudied,
          studyPercent:     chSections.length ? Math.round(chStudied / chSections.length * 100) : 0,
          totalQuizzes:     chQuizzes.length,
          attemptedQuizzes: chAttempted,
          correctQuizzes:   chCorrect,
          accuracy:         chAttempted ? Math.round(chCorrect / chAttempted * 100) : 0,
        };
      });
    });

    // 합격 예측 (물류관리사: 5과목 각 100점, 과목당 과락 40점, 평균 60점↑)
    const subjectScores = {};
    let totalScoreSum = 0;
    let allAboveMin = true;
    const subjectIds = Object.keys(store.subjects);

    subjectIds.forEach(sid => {
      const acc = bySubject[sid]?.accuracy ?? 0;
      const score = Math.round(acc);  // 정답률 % = 100점 만점 기준 점수
      subjectScores[sid] = score;
      totalScoreSum += score;
      if (score < 40) allAboveMin = false;
    });

    const avgScore = subjectIds.length ? Math.round(totalScoreSum / subjectIds.length) : 0;
    const passes = allAboveMin && avgScore >= 60;
    const hasTried = attemptedCount > 0;

    return {
      totalSections:    allSections.length,
      studiedSections:  studiedCount,
      studyPercent:     allSections.length ? Math.round(studiedCount / allSections.length * 100) : 0,
      totalQuizzes:     allQuizzes.length,
      attemptedQuizzes: attemptedCount,
      correctQuizzes:   correctCount,
      accuracy:         attemptedCount ? Math.round(correctCount / attemptedCount * 100) : 0,
      bySubject,
      byChapter,
      estimatedScore: { subjectScores, avgScore, passes, hasTried },
      bookmarkCount: {
        sections: Object.keys(_state.bookmarkedSections).length,
        quizzes:  Object.keys(_state.bookmarkedQuizzes).length,
      },
      streak: _state.studyStreak,
    };
  },

  /* === 스트릭 === */
  updateStreak() { _updateStreak(); },

  /* === 초기화 === */
  reset() {
    _state = { ...DEFAULT_STATE };
    _save();
  },
};

function _updateStreak() {
  const today = _todayStr();
  const last  = _state.lastStudyDate;
  if (!last) return;

  const lastDate = new Date(last);
  const diff = Math.floor((new Date(today) - lastDate) / 86400000);
  if (diff > 1) {
    _state.studyStreak = 0;
    _save();
  }
}

function _todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export function touchStreak() {
  const today = _todayStr();
  if (_state.lastStudyDate === today) return;
  const last = _state.lastStudyDate;
  const diff = last ? Math.floor((new Date(today) - new Date(last)) / 86400000) : 999;
  _state.studyStreak = diff === 1 ? (_state.studyStreak + 1) : 1;
  _state.lastStudyDate = today;
  _save();
}
