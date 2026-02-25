/**
 * bookmarks.js - 즐겨찾기 화면
 */
import { store } from '../data.js';
import { state } from '../state.js';
import { router } from '../router.js';
import { renderSectionContent } from '../components/conceptCard.js';
import { renderQuizCard } from '../components/quizCard.js';
import { showToast } from '../components/toast.js';

export function renderBookmarks() {
  const sectionIds = state.getBookmarkedSectionIds();
  const quizIds    = state.getBookmarkedQuizIds();

  const el = document.createElement('div');
  el.style.cssText = 'display:flex; flex-direction:column; height:100%;';

  let activeTab = 'sections';

  el.innerHTML = `
    <div class="bookmark-tabs">
      <button class="bookmark-tab active" data-tab="sections">개념 (${sectionIds.length})</button>
      <button class="bookmark-tab" data-tab="quizzes">문제 (${quizIds.length})</button>
    </div>
    <div id="bm-body" style="flex:1; overflow-y:auto; -webkit-overflow-scrolling:touch;"></div>
  `;

  function renderTab() {
    const body = el.querySelector('#bm-body');
    body.innerHTML = '';

    if (activeTab === 'sections') {
      renderSectionTab(body, sectionIds);
    } else {
      renderQuizTab(body, quizIds);
    }
  }

  el.querySelector('.bookmark-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    el.querySelectorAll('.bookmark-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
    renderTab();
  });

  renderTab();
  return el;
}

function renderSectionTab(container, sectionIds) {
  if (sectionIds.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⭐</div>
        <div class="empty-title">즐겨찾기한 개념이 없습니다</div>
        <div class="empty-desc">개념 학습 중 ⭐ 버튼을 눌러 저장하세요</div>
      </div>`;
    return;
  }

  const wrap = document.createElement('div');
  wrap.style.padding = 'var(--sp-4)';

  sectionIds.forEach(sid => {
    const sec = store.sections[sid];
    if (!sec) return;

    const item = document.createElement('div');
    item.className = 'concept-list-item';
    item.style.marginBottom = 'var(--sp-2)';
    item.innerHTML = `
      <div class="concept-list-header" data-expand="${sid}">
        <div class="concept-list-title">${sec.title}</div>
        <div style="display:flex; align-items:center; gap:var(--sp-2);">
          <button class="bookmark-btn active" data-unbookmark="${sid}" style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(245,158,11,0.1);" aria-label="즐겨찾기 해제">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </button>
          <span class="concept-list-chevron">›</span>
        </div>
      </div>
      <div class="concept-list-body">
        ${renderSectionContent(sec)}
        <button class="btn btn-ghost" style="margin-top:var(--sp-3); font-size:var(--text-sm);" data-go-study="${sec.chapterId}">→ 해당 챕터로 이동</button>
      </div>
    `;

    // 펼치기
    item.querySelector(`[data-expand]`).addEventListener('click', e => {
      if (e.target.closest('[data-unbookmark]') || e.target.closest('[data-go-study]')) return;
      item.classList.toggle('expanded');
    });

    // 즐겨찾기 해제
    item.querySelector(`[data-unbookmark]`).addEventListener('click', () => {
      state.toggleBookmarkSection(sid);
      item.remove();
      showToast('즐겨찾기 해제');
    });

    // 챕터 이동
    item.querySelector('[data-go-study]')?.addEventListener('click', () => {
      router.navigate('study', { chapterId: sec.chapterId });
    });

    wrap.appendChild(item);
  });

  container.appendChild(wrap);
}

function renderQuizTab(container, quizIds) {
  if (quizIds.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⭐</div>
        <div class="empty-title">즐겨찾기한 문제가 없습니다</div>
        <div class="empty-desc">퀴즈 풀기 중 ⭐ 버튼을 눌러 저장하세요</div>
      </div>`;
    return;
  }

  const wrap = document.createElement('div');
  wrap.style.padding = 'var(--sp-4)';

  quizIds.forEach(qid => {
    const quiz = store.quizzes[qid];
    if (!quiz) return;

    const item = document.createElement('div');
    item.className = 'card';
    item.style.marginBottom = 'var(--sp-3)';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:var(--sp-3) var(--sp-4); cursor:pointer; min-height:var(--tap-min);';
    header.innerHTML = `
      <div style="flex:1; font-size:var(--text-sm); font-weight:600; color:var(--text-primary); line-height:var(--lh-tight); padding-right:var(--sp-3);">
        ${quiz.question.slice(0, 60)}${quiz.question.length > 60 ? '...' : ''}
      </div>
      <div style="display:flex; align-items:center; gap:var(--sp-2);">
        <button style="width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(245,158,11,0.1);" data-unbookmark="${qid}" aria-label="즐겨찾기 해제">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#F59E0B" stroke="#F59E0B" stroke-width="2">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
        </button>
        <span style="color:var(--text-muted); font-size:18px;">›</span>
      </div>
    `;

    const body = document.createElement('div');
    body.style.cssText = 'display:none; padding:0 var(--sp-4) var(--sp-4); border-top:1px solid var(--border-color);';

    let expanded = false;
    header.addEventListener('click', e => {
      if (e.target.closest('[data-unbookmark]')) return;
      expanded = !expanded;
      body.style.display = expanded ? 'block' : 'none';
      if (expanded && !body.firstChild) {
        // 이미 답을 시도한 경우 정답 표시
        const result = state.getQuizResult(qid);
        const cardEl = renderQuizCard(quiz,
          (qid, answer, correct) => { state.recordQuiz(qid, correct); },
          !!result,
          result?.correct ? quiz.answer : null
        );
        body.appendChild(cardEl);
      }
    });

    header.querySelector('[data-unbookmark]').addEventListener('click', () => {
      state.toggleBookmarkQuiz(qid);
      item.remove();
      showToast('즐겨찾기 해제');
    });

    item.appendChild(header);
    item.appendChild(body);
    wrap.appendChild(item);
  });

  container.appendChild(wrap);
}
