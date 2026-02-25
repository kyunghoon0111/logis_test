/**
 * progress.js - 학습 현황 및 합격 예측 화면
 */
import { store } from '../data.js';
import { state } from '../state.js';
import { router } from '../router.js';
import { showToast } from '../components/toast.js';

export function renderProgress() {
  const progress = state.getProgress(store);
  const est      = progress.estimatedScore;
  const streak   = progress.streak;

  const el = document.createElement('div');
  el.innerHTML = `
    <div style="overflow-y:auto; height:100%; -webkit-overflow-scrolling:touch;">
      <div class="progress-screen" style="padding-bottom: var(--sp-10);">

        <!-- 타이틀 -->
        <div style="margin-bottom:var(--sp-5);">
          <div style="font-size:var(--text-2xl); font-weight:800;">학습 현황</div>
          ${streak > 0 ? `<div style="font-size:var(--text-sm); color:var(--text-muted); margin-top:var(--sp-1);">🔥 ${streak}일 연속 학습 중</div>` : ''}
        </div>

        <!-- 합격 예측 카드 -->
        <div class="pass-predict-card" style="margin-bottom:var(--sp-4);">
          <div class="pass-predict-label">합격 예측 점수</div>
          <div class="pass-predict-score">${est.hasTried ? est.avgScore + '점 (평균)' : '—'}</div>
          ${est.hasTried ? `
            <div class="pass-predict-status ${est.passes ? 'pass' : est.avgScore >= 55 ? 'caution' : 'fail'}">
              ${est.passes ? '✅ 합격권' : est.avgScore >= 55 ? '⚠️ 위험권' : '❌ 불합격권'}
            </div>
            ${Object.entries(store.subjects).map(([sid, meta]) => {
              const score = est.subjectScores[sid] || 0;
              return `<div class="pass-subject-row"><span>${meta.fullLabel}</span><span>${score}/100점 ${score >= 40 ? '(과락 없음 ✅)' : '(과락 ⚠️)'}</span></div>`;
            }).join('')}
            <div style="font-size:var(--text-xs); opacity:0.6; margin-top:var(--sp-3);">※ 현재 정답률 기반 예상 점수 (합격기준: 평균 60점↑, 과목별 40점↑)</div>
          ` : `
            <div style="font-size:var(--text-sm); opacity:0.75;">문제를 풀면 합격 예측 점수가 나타납니다</div>
          `}
        </div>

        <!-- 개념 학습 현황 -->
        <div class="card" style="margin-bottom:var(--sp-4);">
          <div class="card-body">
            <div class="section-title">개념 학습 현황</div>
            <div style="margin-bottom:var(--sp-3); display:flex; justify-content:space-between; font-size:var(--text-sm); color:var(--text-muted);">
              <span>전체 ${progress.studiedSections}/${progress.totalSections} 섹션</span>
              <span style="font-weight:700; color:var(--color-primary);">${progress.studyPercent}%</span>
            </div>
            <div class="progress-bar" style="margin-bottom:var(--sp-5);">
              <div class="progress-bar-fill" style="width:${progress.studyPercent}%;"></div>
            </div>
            ${Object.entries(store.chapters).map(([chId, chMeta]) => {
              const p = progress.byChapter[chId] || {};
              const pct = p.studyPercent || 0;
              const color = chMeta.color || '#3B82F6';
              return `
                <div class="chapter-progress-item">
                  <div class="chapter-progress-header">
                    <span class="chapter-progress-name">${chMeta.fullLabel}</span>
                    <span class="chapter-progress-nums">${p.studiedSections || 0}/${p.totalSections || 0} (${pct}%)</span>
                  </div>
                  <div class="progress-bar">
                    <div class="progress-bar-fill" style="width:${pct}%; background:${color};"></div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 문제 정답률 -->
        <div class="card" style="margin-bottom:var(--sp-4);">
          <div class="card-body">
            <div class="section-title">문제 정답률</div>
            <div style="margin-bottom:var(--sp-3); display:flex; justify-content:space-between; font-size:var(--text-sm); color:var(--text-muted);">
              <span>전체 ${progress.attemptedQuizzes}/${progress.totalQuizzes} 문항 도전</span>
              <span style="font-weight:700; color:var(--color-success);">${progress.accuracy}%</span>
            </div>
            <div class="progress-bar" style="margin-bottom:var(--sp-5);">
              <div class="progress-bar-fill success" style="width:${progress.accuracy}%;"></div>
            </div>
            ${Object.entries(store.chapters).map(([chId, chMeta]) => {
              const p = progress.byChapter[chId] || {};
              const acc = p.accuracy || 0;
              const color = acc >= 80 ? '#10B981' : acc >= 60 ? '#F59E0B' : '#EF4444';
              return `
                <div class="chapter-progress-item">
                  <div class="chapter-progress-header">
                    <span class="chapter-progress-name">${chMeta.fullLabel}</span>
                    <span class="chapter-progress-nums" style="color:${p.attemptedQuizzes ? color : 'var(--text-muted)'};">
                      ${p.attemptedQuizzes ? `${p.correctQuizzes}/${p.attemptedQuizzes} (${acc}%)` : '미도전'}
                    </span>
                  </div>
                  ${p.attemptedQuizzes ? `
                    <div class="progress-bar">
                      <div class="progress-bar-fill" style="width:${acc}%; background:${color};"></div>
                    </div>` : ''}
                </div>
              `;
            }).join('')}
          </div>
        </div>

        <!-- 취약 챕터 집중 훈련 -->
        ${renderWeakTraining(progress)}

        <!-- 학습 초기화 -->
        <div class="card" style="margin-bottom:var(--sp-4);">
          <div class="card-body" style="text-align:center;">
            <button class="btn btn-danger" id="btn-reset" style="width:100%;">
              학습 기록 초기화
            </button>
            <div style="font-size:var(--text-xs); color:var(--text-muted); margin-top:var(--sp-2);">
              모든 학습 진도, 퀴즈 결과, 즐겨찾기가 삭제됩니다
            </div>
          </div>
        </div>

      </div>
    </div>
  `;

  el.querySelector('#btn-reset').addEventListener('click', () => {
    showResetModal();
  });

  el.querySelectorAll('[data-quiz-chapter]').forEach(btn => {
    btn.addEventListener('click', () => router.navigate('quiz', { chapterId: btn.dataset.quizChapter }));
  });

  return el;
}

function renderWeakTraining(progress) {
  const weak = Object.entries(progress.byChapter)
    .filter(([, p]) => p.attemptedQuizzes > 0 && p.accuracy < 80)
    .sort((a, b) => a[1].accuracy - b[1].accuracy)
    .slice(0, 3);

  if (weak.length === 0) return '';

  return `
    <div class="card" style="margin-bottom:var(--sp-4);">
      <div class="card-body">
        <div class="section-title">취약 챕터 집중 훈련</div>
        ${weak.map(([chId, p]) => `
          <div style="display:flex; align-items:center; gap:var(--sp-3); padding:var(--sp-3) 0; border-bottom:1px solid var(--border-color);">
            <div style="flex:1;">
              <div style="font-size:var(--text-sm); font-weight:600;">${store.chapters[chId]?.fullLabel || chId}</div>
              <div style="font-size:var(--text-xs); color:var(--text-muted);">정답률 ${p.accuracy}%</div>
            </div>
            <button class="btn btn-secondary" style="height:36px; padding:0 var(--sp-3); font-size:var(--text-sm);" data-quiz-chapter="${chId}">
              훈련 →
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function showResetModal() {
  const overlay = document.getElementById('modal-overlay');
  const content = document.getElementById('modal-content');
  content.innerHTML = `
    <div style="text-align:center; margin-bottom:var(--sp-5);">
      <div style="font-size:32px; margin-bottom:var(--sp-3);">⚠️</div>
      <div style="font-size:var(--text-xl); font-weight:700; margin-bottom:var(--sp-2);">정말 초기화하시겠습니까?</div>
      <div style="font-size:var(--text-sm); color:var(--text-muted); line-height:var(--lh-relaxed);">
        모든 학습 진도, 퀴즈 결과, 즐겨찾기가<br>영구적으로 삭제됩니다.
      </div>
    </div>
    <div style="display:flex; flex-direction:column; gap:var(--sp-3);">
      <button class="btn btn-danger btn-full" id="modal-confirm-reset">초기화</button>
      <button class="btn btn-secondary btn-full" id="modal-cancel-reset">취소</button>
    </div>
  `;
  overlay.classList.remove('hidden');
  content.querySelector('#modal-cancel-reset').addEventListener('click', () => overlay.classList.add('hidden'));
  content.querySelector('#modal-confirm-reset').addEventListener('click', () => {
    state.reset();
    overlay.classList.add('hidden');
    showToast('학습 기록이 초기화되었습니다');
    router.navigate('home');
  });
}
