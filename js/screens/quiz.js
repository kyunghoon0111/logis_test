/**
 * quiz.js - 퀴즈 엔진 (설정 → 문제 → 결과)
 */
import { store, getQuizzes } from '../data.js';
import { state, touchStreak } from '../state.js';
import { router } from '../router.js';
import { renderQuizCard } from '../components/quizCard.js';
import { showToast } from '../components/toast.js';
import { createProgressRing } from '../components/progressRing.js';

export function renderQuiz(params = {}) {
  // 진행중 세션 복구 또는 설정 화면
  const session = state.getQuizSession();

  if (params.mode === 'daily') {
    // 오늘의 퀴즈: 5문제 랜덤 (미도전 우선)
    startSession(buildDailyQuizzes());
    return renderSession();
  }

  if (params.chapterId) {
    // 챕터별 바로 시작
    const quizzes = getQuizzes({ chapterId: params.chapterId, shuffle: true, count: 10 });
    startSession(quizzes.map(q => q.id));
    return renderSession();
  }

  if (params.quizId) {
    // 검색에서 특정 문제 클릭 시 1문제 세션
    startSession([params.quizId]);
    return renderSession();
  }

  if (session && !params.reset) {
    return renderSession();
  }

  return renderSetup();
}

/* ===================================================
   설정 화면
   =================================================== */
function renderSetup() {
  const el = document.createElement('div');
  el.innerHTML = `
    <div class="quiz-setup" style="overflow-y:auto; height:100%; -webkit-overflow-scrolling:touch;">
      <div>
        <div style="font-size:var(--text-2xl); font-weight:800; margin-bottom:var(--sp-2);">문제 풀기</div>
        <div style="font-size:var(--text-sm); color:var(--text-muted);">원하는 조건으로 문제를 선택하세요</div>
      </div>

      <!-- 범위 -->
      <div class="quiz-setup-section">
        <div class="quiz-setup-label">📚 범위</div>
        <div class="chip-group" id="scope-group">
          <button class="toggle-chip active" data-scope="all">전체</button>
          ${Object.entries(store.subjects).map(([sid, meta]) =>
            `<button class="toggle-chip" data-scope="${sid}">${meta.fullLabel}</button>`
          ).join('')}
        </div>
      </div>

      <!-- 난이도 -->
      <div class="quiz-setup-section">
        <div class="quiz-setup-label">⭐ 난이도</div>
        <div class="chip-group" id="diff-group">
          <button class="toggle-chip active" data-diff="1">초급</button>
          <button class="toggle-chip active" data-diff="2">중급</button>
          <button class="toggle-chip active" data-diff="3">고급</button>
        </div>
      </div>

      <!-- 문제 수 -->
      <div class="quiz-setup-section">
        <div class="quiz-setup-label">📝 문항 수</div>
        <div class="chip-group" id="count-group">
          <button class="toggle-chip" data-count="5">5문제</button>
          <button class="toggle-chip active" data-count="10">10문제</button>
          <button class="toggle-chip" data-count="20">20문제</button>
          <button class="toggle-chip" data-count="0">전체</button>
        </div>
      </div>

      <!-- 유형 -->
      <div class="quiz-setup-section">
        <div class="quiz-setup-label">🎯 유형</div>
        <div class="chip-group" id="type-group">
          <button class="toggle-chip active" data-qtype="all">전체</button>
          <button class="toggle-chip" data-qtype="concept">개념확인</button>
          <button class="toggle-chip" data-qtype="exam">실전문제</button>
        </div>
      </div>

      <!-- 순서 -->
      <div class="quiz-setup-section">
        <div class="quiz-setup-label">🔀 출제 순서</div>
        <div class="chip-group" id="order-group">
          <button class="toggle-chip active" data-order="random">랜덤</button>
          <button class="toggle-chip" data-order="order">순서대로</button>
        </div>
      </div>

      <div id="quiz-count-preview" style="font-size:var(--text-sm); color:var(--text-muted); margin-bottom:var(--sp-2);">
        선택된 문제: 계산 중...
      </div>

      <button class="btn btn-primary btn-full" id="btn-start-quiz" style="font-size:var(--text-lg);">
        시작하기
      </button>
      <div style="height:var(--sp-10);"></div>
    </div>
  `;

  const settings = { scope:'all', difficulty:[1,2,3], count:10, type:'all', order:'random' };

  function makeExclusive(groupId, key) {
    el.querySelector(`#${groupId}`).addEventListener('click', e => {
      const btn = e.target.closest('.toggle-chip');
      if (!btn) return;
      el.querySelectorAll(`#${groupId} .toggle-chip`).forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      settings[key] = btn.dataset[key === 'count' ? 'count' : key === 'type' ? 'qtype' : key === 'order' ? 'order' : 'scope'];
      updatePreview();
    });
  }

  function makeMulti(groupId) {
    el.querySelector(`#${groupId}`).addEventListener('click', e => {
      const btn = e.target.closest('.toggle-chip');
      if (!btn) return;
      btn.classList.toggle('active');
      settings.difficulty = [...el.querySelectorAll(`#${groupId} .toggle-chip.active`)].map(b => parseInt(b.dataset.diff));
      if (settings.difficulty.length === 0) {
        settings.difficulty = [1,2,3];
        el.querySelectorAll(`#${groupId} .toggle-chip`).forEach(b => b.classList.add('active'));
      }
      updatePreview();
    });
  }

  makeExclusive('scope-group', 'scope');
  makeMulti('diff-group');
  makeExclusive('count-group', 'count');
  makeExclusive('type-group', 'type');
  makeExclusive('order-group', 'order');

  function updatePreview() {
    const opts = buildFilterOpts(settings);
    const list = getQuizzes(opts);
    el.querySelector('#quiz-count-preview').textContent = `선택된 문제: ${list.length}문항`;
  }

  el.querySelector('#btn-start-quiz').addEventListener('click', () => {
    const opts = buildFilterOpts(settings);
    const quizzes = getQuizzes(opts);
    if (quizzes.length === 0) {
      showToast('조건에 맞는 문제가 없습니다', 'error');
      return;
    }
    startSession(quizzes.map(q => q.id));
    // 세션 화면으로 전환
    const container = document.getElementById('screen-container');
    el.remove();
    const sessionEl = renderSession();
    sessionEl.classList.add('screen', 'screen-enter');
    container.appendChild(sessionEl);
  });

  updatePreview();
  return el;
}

function buildFilterOpts(settings) {
  const count = parseInt(settings.count) || 0;
  const scope = settings.scope;
  return {
    subjectId:  (scope !== 'all' && !scope.includes('-p')) ? scope : undefined,
    chapterId:  scope.includes('-p') ? scope : undefined,
    difficulty: settings.difficulty,
    type:       settings.type !== 'all' ? settings.type : undefined,
    shuffle:    settings.order === 'random',
    count:      count || undefined,
  };
}

/* ===================================================
   세션 시작
   =================================================== */
function startSession(quizIds) {
  state.setQuizSession({
    quizIds,
    currentIndex: 0,
    answers: {},
    startedAt: Date.now(),
  });
}

/* ===================================================
   문제 풀이 화면
   =================================================== */
function renderSession() {
  const session = state.getQuizSession();
  if (!session || session.quizIds.length === 0) return renderSetup();

  const el = document.createElement('div');
  el.className = 'quiz-session';

  let currentIndex = session.currentIndex;
  const total      = session.quizIds.length;

  function buildQuestion() {
    const qid     = session.quizIds[currentIndex];
    const quiz    = store.quizzes[qid];
    const answered = !!session.answers[qid];
    const chosen   = session.answers[qid] || null;
    const bookmarked = state.isBookmarkedQuiz(qid);

    el.innerHTML = `
      <div class="quiz-session-header">
        <button class="quiz-exit-btn" id="btn-exit">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          종료
        </button>
        <div class="quiz-counter">${currentIndex + 1} / ${total}</div>
        <button class="bookmark-btn${bookmarked ? ' active' : ''}" id="btn-bm-quiz" aria-label="북마크" style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="${bookmarked ? '#F59E0B' : 'none'}" stroke="${bookmarked ? '#F59E0B' : 'currentColor'}" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
      </div>
      <div class="quiz-session-progress">
        <div class="quiz-session-progress-fill" style="width:${Math.round((currentIndex / total) * 100)}%;"></div>
      </div>
      <div class="quiz-session-body">
        <div id="quiz-card-mount"></div>
      </div>
      <div class="quiz-session-footer">
        <button class="btn btn-primary btn-full" id="btn-next" ${!answered ? 'disabled' : ''}>
          ${currentIndex < total - 1 ? '다음 문제 →' : '결과 보기'}
        </button>
      </div>
    `;

    // 퀴즈 카드
    const cardEl = renderQuizCard(quiz, (qid, answer, correct) => {
      session.answers[qid] = answer;
      session.currentIndex = currentIndex;
      state.recordQuiz(qid, correct);
      state.setQuizSession(session);
      touchStreak();
      el.querySelector('#btn-next').disabled = false;
    }, answered, chosen);

    el.querySelector('#quiz-card-mount').appendChild(cardEl);

    // 북마크
    el.querySelector('#btn-bm-quiz').addEventListener('click', () => {
      const isNow = state.toggleBookmarkQuiz(qid);
      showToast(isNow ? '⭐ 즐겨찾기 추가' : '즐겨찾기 해제');
      el.querySelector('#btn-bm-quiz').innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="${isNow ? '#F59E0B' : 'none'}" stroke="${isNow ? '#F59E0B' : 'currentColor'}" stroke-width="2">
          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
        </svg>`;
    });

    // 다음
    el.querySelector('#btn-next').addEventListener('click', () => {
      if (currentIndex < total - 1) {
        currentIndex++;
        session.currentIndex = currentIndex;
        state.setQuizSession(session);
        buildQuestion();
      } else {
        showResult();
      }
    });

    // 종료
    el.querySelector('#btn-exit').addEventListener('click', () => {
      if (Object.keys(session.answers).length > 0) {
        showExitModal();
      } else {
        state.clearQuizSession();
        router.navigate('quiz', { reset: true });
      }
    });
  }

  function showExitModal() {
    const overlay = document.getElementById('modal-overlay');
    const content = document.getElementById('modal-content');
    content.innerHTML = `
      <div style="text-align:center; margin-bottom:var(--sp-5);">
        <div style="font-size:var(--text-xl); font-weight:700; margin-bottom:var(--sp-2);">퀴즈 종료</div>
        <div style="font-size:var(--text-sm); color:var(--text-muted);">지금까지 ${Object.keys(session.answers).length}문제를 풀었습니다.<br>종료하시겠습니까?</div>
      </div>
      <div style="display:flex; gap:var(--sp-3);">
        <button class="btn btn-secondary btn-full" id="modal-cancel">계속 풀기</button>
        <button class="btn btn-danger btn-full" id="modal-exit">종료</button>
      </div>
    `;
    overlay.classList.remove('hidden');
    content.querySelector('#modal-cancel').addEventListener('click', () => overlay.classList.add('hidden'));
    content.querySelector('#modal-exit').addEventListener('click', () => {
      overlay.classList.add('hidden');
      state.clearQuizSession();
      router.navigate('quiz', { reset: true });
    });
  }

  function showResult() {
    state.clearQuizSession();
    const answered = Object.keys(session.answers);
    const correct  = answered.filter(qid => {
      const quiz = store.quizzes[qid];
      return session.answers[qid] === quiz?.answer;
    });
    const pct = answered.length ? Math.round(correct.length / answered.length * 100) : 0;
    const elapsed = Math.floor((Date.now() - session.startedAt) / 1000);
    const min = Math.floor(elapsed / 60);
    const sec = elapsed % 60;

    const wrongList = answered.filter(qid => {
      const quiz = store.quizzes[qid];
      return session.answers[qid] !== quiz?.answer;
    });

    el.innerHTML = `
      <div class="quiz-result" style="overflow-y:auto; -webkit-overflow-scrolling:touch; height:100%;">
        <div class="quiz-result-emoji">${pct >= 80 ? '🎉' : pct >= 60 ? '👍' : '💪'}</div>
        <div class="quiz-result-title">${pct >= 80 ? '훌륭해요!' : pct >= 60 ? '잘 했어요!' : '계속 노력해요!'}</div>
        <div id="result-ring"></div>
        <div>
          <div class="quiz-result-score">${correct.length} / ${answered.length} 정답 (${pct}%)</div>
          <div class="quiz-result-time">소요 시간: ${min}분 ${sec}초</div>
        </div>
        <div class="quiz-result-actions">
          ${wrongList.length > 0 ? `<button class="btn btn-primary btn-full" id="btn-retry-wrong">틀린 문제 다시 풀기 (${wrongList.length})</button>` : ''}
          <button class="btn btn-secondary btn-full" id="btn-back-home">홈으로</button>
          <button class="btn btn-ghost btn-full" id="btn-new-quiz">새 퀴즈</button>
        </div>
        ${wrongList.length > 0 ? `
          <div class="quiz-wrong-list" style="width:100%;">
            <div class="section-title" style="margin-bottom:var(--sp-3);">오답 목록</div>
            ${wrongList.map(qid => {
              const q = store.quizzes[qid];
              return `<div class="quiz-wrong-item">${q?.question?.slice(0,60) || qid}...</div>`;
            }).join('')}
          </div>` : ''}
      </div>
    `;

    const ringEl = createProgressRing(pct, { size: 100, stroke: 9, color: pct >= 80 ? '#10B981' : pct >= 60 ? '#F59E0B' : '#EF4444' });
    el.querySelector('#result-ring').appendChild(ringEl);

    el.querySelector('#btn-back-home')?.addEventListener('click', () => router.navigate('home'));
    el.querySelector('#btn-new-quiz')?.addEventListener('click', () => router.navigate('quiz', { reset: true }));
    el.querySelector('#btn-retry-wrong')?.addEventListener('click', () => {
      startSession(wrongList);
      const newSessionEl = renderSession();
      newSessionEl.classList.add('screen');
      el.replaceWith(newSessionEl);
    });
  }

  buildQuestion();
  return el;
}

/* ===================================================
   오늘의 퀴즈 (미도전 우선 5문제)
   =================================================== */
function buildDailyQuizzes() {
  const all = store.allQuizIds;
  // 미도전 문제 우선, 그 다음 틀린 문제, 그 다음 전체 랜덤
  const untried = all.filter(id => !state.getQuizResult(id));
  const wrong   = all.filter(id => state.getQuizResult(id) && !state.getQuizResult(id).correct);
  const pool = [...shuffle(untried), ...shuffle(wrong), ...shuffle(all)];
  // 중복 제거
  const seen = new Set();
  const result = [];
  for (const id of pool) {
    if (!seen.has(id)) { seen.add(id); result.push(id); }
    if (result.length >= 5) break;
  }
  return result;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
