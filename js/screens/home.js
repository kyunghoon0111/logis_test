/**
 * home.js - 홈 대시보드 화면
 */
import { store } from '../data.js';
import { state, touchStreak } from '../state.js';
import { router } from '../router.js';
import { createProgressRing } from '../components/progressRing.js';

export function renderHome() {
  touchStreak();

  const progress  = state.getProgress(store);
  const examDate  = state.get('examDate');
  const dday      = calcDDay(examDate);
  const streak    = progress.streak;
  const est       = progress.estimatedScore;

  const el = document.createElement('div');
  el.innerHTML = `
    <div class="screen-content" style="padding-bottom: 24px;">

      <!-- 인삿말 -->
      <div style="margin-bottom: var(--sp-4);">
        <div class="home-greeting">안녕하세요! 👋</div>
        <div class="home-subtitle">오늘도 물류관리사 합격을 향해 한 걸음씩</div>
      </div>

      <!-- D-Day 카드 -->
      <div class="dday-card" id="dday-card">
        ${renderDDayCard(dday, examDate)}
      </div>

      <!-- 전체 진도 + 스트릭 -->
      <div class="card" style="margin-bottom: var(--sp-4);">
        <div class="overall-card" id="overall-ring-mount">
          <div id="ring-placeholder"></div>
          <div class="overall-stats">
            <div class="overall-stat-row">
              <div class="overall-stat-label">개념 학습</div>
              <div class="overall-stat-value">${progress.studiedSections}<span style="font-size:var(--text-sm);color:var(--text-muted);font-weight:500;">/${progress.totalSections} 섹션</span></div>
            </div>
            <div class="overall-stat-row">
              <div class="overall-stat-label">문제 풀이</div>
              <div class="overall-stat-value">${progress.attemptedQuizzes}<span style="font-size:var(--text-sm);color:var(--text-muted);font-weight:500;">/${progress.totalQuizzes} 문항</span></div>
            </div>
            <div class="overall-stat-row">
              <div class="overall-stat-label">정답률</div>
              <div class="overall-stat-value" style="color:var(--color-success);">${progress.accuracy}%</div>
            </div>
          </div>
        </div>
        ${streak > 0 ? `
        <div class="divider" style="margin: 0;"></div>
        <div class="streak-card">
          <span class="streak-fire">🔥</span>
          <div>
            <div class="streak-num">${streak}일</div>
            <div class="streak-label">연속 학습 중</div>
          </div>
        </div>` : ''}
      </div>

      <!-- 빠른 액션 -->
      <div class="quick-actions" style="margin-bottom: var(--sp-4);">
        <button class="quick-btn" id="btn-continue-study">
          <div class="quick-btn-icon">📖</div>
          <div class="quick-btn-label">이어서 학습</div>
          <div class="quick-btn-sub">개념 학습 계속</div>
        </button>
        <button class="quick-btn" id="btn-daily-quiz">
          <div class="quick-btn-icon">✏️</div>
          <div class="quick-btn-label">오늘의 퀴즈</div>
          <div class="quick-btn-sub">5문제 빠르게</div>
        </button>
      </div>

      <!-- 과목별 진도 -->
      <div class="card" style="margin-bottom: var(--sp-4);">
        <div class="card-body">
          <div class="section-title">과목별 학습 현황</div>
          ${renderSubjectProgress(progress)}
        </div>
      </div>

      <!-- 합격 예측 -->
      ${est.hasTried ? `
      <div class="card" style="margin-bottom: var(--sp-4);">
        <div class="card-body">
          <div class="section-title">합격 예측</div>
          <div style="display:flex; align-items:center; justify-content:space-between; padding: var(--sp-2) 0;">
            <div>
              <div style="font-size:var(--text-2xl); font-weight:800; color:var(--text-primary);">${est.avgScore}<span style="font-size:var(--text-sm); font-weight:400; color:var(--text-muted);">점 (평균)</span></div>
              <div style="font-size:var(--text-xs); color:var(--text-muted); margin-top:2px;">현재 정답률 기준 예상 점수</div>
            </div>
            <div style="font-size:var(--text-xs); font-weight:700; color:${est.passes ? 'var(--color-success)' : 'var(--color-danger)'};">${est.passes ? '합격권' : '불합격권'}</div>
          </div>
          <div style="margin-top:var(--sp-3);">
            ${Object.entries(store.subjects).map(([sid, meta]) => {
              const score = est.subjectScores[sid] || 0;
              return `<div style="font-size:var(--text-sm); color:var(--text-secondary); padding:2px 0;">${meta.fullLabel} ${score}/100점 ${score >= 40 ? '✅' : '⚠️'}</div>`;
            }).join('')}
          </div>
        </div>
      </div>` : ''}

      <!-- 취약 챕터 -->
      ${renderWeakChapters(progress)}

    </div>
  `;

  // 원형 진도 삽입
  const ring = createProgressRing(progress.studyPercent, {
    size: 88, stroke: 8, color: 'var(--color-primary)', label: '학습률'
  });
  el.querySelector('#ring-placeholder').replaceWith(ring);

  // D-Day 날짜 설정
  el.querySelector('#btn-dday-set')?.addEventListener('click', () => openExamDateModal());

  // 빠른 액션
  el.querySelector('#btn-continue-study')?.addEventListener('click', () => {
    const ch = state.get('lastStudyChapter') || 's1-p01';
    router.navigate('study', { chapterId: ch });
  });
  el.querySelector('#btn-daily-quiz')?.addEventListener('click', () => {
    router.navigate('quiz', { mode: 'daily' });
  });

  // 취약 챕터 버튼
  el.querySelectorAll('[data-weak-chapter]').forEach(btn => {
    btn.addEventListener('click', () => {
      router.navigate('quiz', { chapterId: btn.dataset.weakChapter });
    });
  });

  return el;
}

function renderDDayCard(dday, examDate) {
  if (examDate && dday !== null) {
    const label = dday === 0 ? '오늘이 시험일입니다!' : dday > 0 ? `시험까지 D-${dday}` : `시험 D+${Math.abs(dday)}`;
    return `
      <div class="dday-label">물류관리사 시험</div>
      <div class="dday-count">${dday === 0 ? 'D-Day' : dday > 0 ? `D-${dday}` : `D+${Math.abs(dday)}`}</div>
      <div class="dday-desc">${new Date(examDate).toLocaleDateString('ko-KR', {year:'numeric', month:'long', day:'numeric'})}</div>
      <button class="dday-set-btn" id="btn-dday-set">📅 날짜 변경</button>
    `;
  }
  return `
    <div class="dday-label">목표 시험일</div>
    <div class="dday-count" style="font-size:var(--text-2xl);">날짜를 설정하세요</div>
    <div class="dday-desc">시험 날짜를 입력하면 D-Day를 추적합니다</div>
    <button class="dday-set-btn" id="btn-dday-set">📅 시험일 설정</button>
  `;
}

function renderSubjectProgress(progress) {
  return Object.entries(store.subjects).map(([sid, meta]) => {
    const p = progress.bySubject[sid] || {};
    return `
      <div class="subject-progress-item">
        <div class="subject-progress-header">
          <span class="subject-progress-name">${meta.label} - ${meta.fullLabel}</span>
          <span class="subject-progress-pct" style="color:${meta.color};">${p.studyPercent || 0}%</span>
        </div>
        <div class="progress-bar">
          <div class="progress-bar-fill" style="width:${p.studyPercent || 0}%; background:${meta.color};"></div>
        </div>
        <div style="display:flex; gap:var(--sp-4); font-size:var(--text-xs); color:var(--text-muted);">
          <span>개념 ${p.studiedSections || 0}/${p.totalSections || 0}</span>
          <span>문제 ${p.attemptedQuizzes || 0}/${p.totalQuizzes || 0}</span>
          <span>정답률 ${p.accuracy || 0}%</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderWeakChapters(progress) {
  const chapters = Object.entries(progress.byChapter)
    .filter(([, p]) => p.attemptedQuizzes > 0)
    .sort((a, b) => a[1].accuracy - b[1].accuracy)
    .slice(0, 3);

  if (chapters.length === 0) return '';

  return `
    <div class="card" style="margin-bottom: var(--sp-4);">
      <div class="card-body">
        <div class="section-title">취약 챕터 집중 훈련</div>
        ${chapters.map(([chId, p], i) => `
          <div class="weak-chapter-item">
            <div class="weak-chapter-rank">${i+1}</div>
            <div class="weak-chapter-info">
              <div class="weak-chapter-name">${store.chapters[chId]?.fullLabel || chId}</div>
              <div class="weak-chapter-stat">${p.attemptedQuizzes}문항 시도</div>
            </div>
            <div class="weak-chapter-acc">${p.accuracy}%</div>
            <button class="btn btn-secondary" style="padding: 0 var(--sp-3); height:36px; font-size:var(--text-xs);" data-weak-chapter="${chId}">훈련</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function calcDDay(examDateStr) {
  if (!examDateStr) return null;
  const exam  = new Date(examDateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  exam.setHours(0, 0, 0, 0);
  return Math.floor((exam - today) / 86400000);
}

function openExamDateModal() {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  const current = state.get('examDate') || '';

  content.innerHTML = `
    <div style="margin-bottom: var(--sp-5);">
      <div style="font-size:var(--text-xl); font-weight:700; margin-bottom:var(--sp-2);">시험일 설정</div>
      <div style="font-size:var(--text-sm); color:var(--text-muted);">물류관리사 시험 날짜를 입력하세요</div>
    </div>
    <input type="date" id="exam-date-input" value="${current}"
      style="width:100%; height:50px; border:2px solid var(--border-color); border-radius:var(--r-md); padding:0 var(--sp-4); font-size:var(--text-md); background:var(--bg-secondary); color:var(--text-primary); margin-bottom:var(--sp-5);">
    <div style="display:flex; gap:var(--sp-3);">
      <button class="btn btn-secondary btn-full" id="modal-cancel">취소</button>
      <button class="btn btn-primary btn-full" id="modal-confirm">저장</button>
    </div>
  `;

  overlay.classList.remove('hidden');
  content.classList.add('modal-slide-up');

  content.querySelector('#modal-cancel').addEventListener('click', () => {
    overlay.classList.add('hidden');
    content.classList.remove('modal-slide-up');
  });
  content.querySelector('#modal-confirm').addEventListener('click', () => {
    const val = content.querySelector('#exam-date-input').value;
    state.set('examDate', val || null);
    overlay.classList.add('hidden');
    content.classList.remove('modal-slide-up');

    // D-day 카드 즉시 업데이트
    const ddayCard = document.getElementById('dday-card');
    if (ddayCard) {
      const newExamDate = val || null;
      const newDday = calcDDay(newExamDate);
      ddayCard.innerHTML = renderDDayCard(newDday, newExamDate);
      ddayCard.querySelector('#btn-dday-set')?.addEventListener('click', () => openExamDateModal());
    }
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) {
      overlay.classList.add('hidden');
      content.classList.remove('modal-slide-up');
    }
  }, { once: true });
}
