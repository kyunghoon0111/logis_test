/**
 * study.js - 개념 학습 화면 (카드 모드 / 리스트 모드)
 */
import { store, getSectionsByChapter } from '../data.js';
import { state, touchStreak } from '../state.js';
import { router } from '../router.js';
import { renderSectionContent } from '../components/conceptCard.js';
import { showToast } from '../components/toast.js';

export function renderStudy(params = {}) {
  touchStreak();

  let chapterId = params.chapterId || state.get('lastStudyChapter') || 's1-p01';

  // 검색에서 특정 섹션 클릭 시 해당 챕터/인덱스로 이동
  if (params.sectionId) {
    const sec = store.sections[params.sectionId];
    if (sec) {
      chapterId = sec.chapterId;
      const secList = getSectionsByChapter(chapterId);
      const idx = secList.findIndex(s => s.id === params.sectionId);
      state.set('lastStudyChapter', chapterId);
      state.set('lastSectionIndex', idx >= 0 ? idx : 0);
    }
  }

  // 현재 과목 ID 추출
  let currentSubjectId = chapterId.split('-')[0];
  const viewMode = state.get('studyViewMode') || 'card';

  const el = document.createElement('div');
  el.style.cssText = 'display:flex; flex-direction:column; height:100%;';

  const subjects = Object.entries(store.subjects);

  el.innerHTML = `
    <div class="subject-tabs" id="subject-tabs">
      ${subjects.map(([sid, meta]) => `
        <button class="subject-tab${sid === currentSubjectId ? ' active' : ''}" data-subject="${sid}">
          ${meta.fullLabel}
        </button>
      `).join('')}
    </div>
    <div class="chapter-tabs" id="chapter-tabs"></div>
    <div class="view-toggle">
      <button class="view-toggle-btn${viewMode === 'card' ? ' active' : ''}" data-view="card">카드</button>
      <button class="view-toggle-btn${viewMode === 'list' ? ' active' : ''}" data-view="list">목록</button>
    </div>
    <div id="study-body" style="flex:1; overflow:hidden; position:relative;"></div>
  `;

  let currentChapter = chapterId;
  let currentView    = viewMode;

  function renderPartTabs() {
    const partTabsEl = el.querySelector('#chapter-tabs');
    const parts = store.subjects[currentSubjectId].chapters;
    partTabsEl.innerHTML = parts.map(pId => `
      <button class="chapter-tab${pId === currentChapter ? ' active' : ''}" data-chapter="${pId}">
        ${store.chapters[pId]?.label || pId}
      </button>
    `).join('');
  }

  function render() {
    const sections = getSectionsByChapter(currentChapter);
    const body = el.querySelector('#study-body');
    body.innerHTML = '';

    if (sections.length === 0) {
      body.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><div class="empty-title">아직 내용이 없습니다</div></div>`;
      return;
    }

    if (currentView === 'card') {
      renderCardMode(body, sections, currentChapter, state.get('lastSectionIndex') || 0);
    } else {
      renderListMode(body, sections);
    }
  }

  // 과목 탭 클릭
  el.querySelector('#subject-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-subject]');
    if (!btn) return;
    currentSubjectId = btn.dataset.subject;
    const firstPart = store.subjects[currentSubjectId].chapters[0];
    currentChapter = firstPart;
    state.set('lastStudyChapter', currentChapter);
    state.set('lastSectionIndex', 0);
    el.querySelectorAll('.subject-tab').forEach(b => b.classList.toggle('active', b.dataset.subject === currentSubjectId));
    renderPartTabs();
    render();
  });

  // 파트 탭 클릭 (동적 재렌더링되므로 위임)
  el.querySelector('#chapter-tabs').addEventListener('click', e => {
    const btn = e.target.closest('[data-chapter]');
    if (!btn) return;
    currentChapter = btn.dataset.chapter;
    state.set('lastStudyChapter', currentChapter);
    state.set('lastSectionIndex', 0);
    el.querySelectorAll('.chapter-tab').forEach(b => b.classList.toggle('active', b.dataset.chapter === currentChapter));
    render();
  });

  // 뷰 토글
  el.querySelectorAll('.view-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentView = btn.dataset.view;
      state.set('studyViewMode', currentView);
      el.querySelectorAll('.view-toggle-btn').forEach(b => b.classList.toggle('active', b.dataset.view === currentView));
      render();
    });
  });

  renderPartTabs();
  render();
  return el;
}

/* ===================================================
   카드 모드
   =================================================== */
function renderCardMode(container, sections, chapterId, startIdx) {
  let idx = Math.min(startIdx, sections.length - 1);
  let isAnimating = false;

  function buildCard() {
    const sec = sections[idx];
    const studied = state.isStudied(sec.id);
    const bookmarked = state.isBookmarkedSection(sec.id);

    const wrap = document.createElement('div');
    wrap.className = 'concept-card-view';
    wrap.innerHTML = `
      <div class="concept-card-body" id="card-scroll">
        <div class="concept-card-counter">
          <span class="concept-card-num">${idx + 1} / ${sections.length}</span>
          <div style="display:flex; gap:var(--sp-2);">
            ${studied ? '<span class="chip chip-green">✅ 완료</span>' : ''}
            <button class="bookmark-btn${bookmarked ? ' active' : ''}" id="card-bookmark" aria-label="북마크">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="${bookmarked ? '#F59E0B' : 'none'}" stroke="${bookmarked ? '#F59E0B' : 'currentColor'}" stroke-width="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="card" style="margin-bottom:var(--sp-4);">
          <div class="card-body-lg">
            <div style="font-size:var(--text-xl); font-weight:800; color:var(--text-primary); margin-bottom:var(--sp-4); line-height:var(--lh-tight);">${sec.title}</div>
            ${renderSectionContent(sec)}
          </div>
        </div>
      </div>
      <div class="concept-card-actions">
        <button class="done-btn${studied ? ' completed' : ''}" id="card-done">
          ${studied ? '✅ 완료됨' : '완료 표시'}
        </button>
        <div class="concept-card-nav">
          <button class="concept-nav-btn" id="card-prev" ${idx === 0 ? 'disabled' : ''}>←</button>
          <span style="font-size:var(--text-xs); color:var(--text-muted); padding:0 var(--sp-2);">${idx+1}/${sections.length}</span>
          <button class="concept-nav-btn primary" id="card-next" ${idx === sections.length - 1 ? 'disabled' : ''}>→</button>
        </div>
      </div>
    `;

    // 북마크
    wrap.querySelector('#card-bookmark').addEventListener('click', () => {
      const isNow = state.toggleBookmarkSection(sec.id);
      showToast(isNow ? '⭐ 즐겨찾기 추가' : '즐겨찾기 해제');
      buildAndReplace(wrap, 'none');
    });

    // 완료 표시
    wrap.querySelector('#card-done').addEventListener('click', () => {
      if (state.isStudied(sec.id)) {
        state.unmarkStudied(sec.id);
        showToast('학습 완료 취소');
        buildAndReplace(wrap, 'none');
      } else {
        state.markStudied(sec.id);
        showToast('✅ 학습 완료!', 'success');
        touchStreak();
        if (idx < sections.length - 1) {
          navigate(1, wrap);
        } else {
          buildAndReplace(wrap, 'none');
        }
      }
    });

    // 이전/다음
    wrap.querySelector('#card-prev')?.addEventListener('click', () => {
      if (idx > 0 && !isAnimating) {
        navigate(-1, wrap);
      }
    });
    wrap.querySelector('#card-next')?.addEventListener('click', () => {
      if (idx < sections.length - 1 && !isAnimating) {
        navigate(1, wrap);
      }
    });

    // 스와이프
    addSwipe(wrap.querySelector('#card-scroll'), {
      onSwipeLeft:  () => { if (idx < sections.length - 1 && !isAnimating) navigate(1, wrap); },
      onSwipeRight: () => { if (idx > 0 && !isAnimating) navigate(-1, wrap); },
    });

    return wrap;
  }

  function navigate(dir, oldWrap) {
    isAnimating = true;
    idx += dir;
    state.set('lastSectionIndex', idx);

    const exitClass = dir > 0 ? 'swipe-card-exit-left' : 'swipe-card-exit-right';
    const enterClass = dir > 0 ? 'swipe-card-enter-right' : 'swipe-card-enter-left';

    oldWrap.classList.add(exitClass);

    setTimeout(() => {
      const newWrap = buildCard();
      newWrap.classList.add(enterClass);
      container.innerHTML = '';
      container.appendChild(newWrap);
      isAnimating = false;
    }, 200);
  }

  function buildAndReplace(oldWrap, dir) {
    const newWrap = buildCard();
    oldWrap.replaceWith(newWrap);
  }

  const card = buildCard();
  container.appendChild(card);
}

/* ===================================================
   리스트 모드
   =================================================== */
function renderListMode(container, sections) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'height:100%; overflow-y:auto; -webkit-overflow-scrolling:touch; padding:var(--sp-4);';

  wrap.innerHTML = sections.map((sec, i) => {
    const studied = state.isStudied(sec.id);
    return `
      <div class="concept-list-item" data-idx="${i}" data-id="${sec.id}">
        <div class="concept-list-header">
          <div class="concept-list-check${studied ? ' done' : ''}">${studied ? '✓' : ''}</div>
          <div class="concept-list-title">${sec.title}</div>
          <span class="concept-list-chevron">›</span>
        </div>
        <div class="concept-list-body">
          ${renderSectionContent(sec)}
          <div style="display:flex; gap:var(--sp-3); margin-top:var(--sp-4);">
            <button class="btn btn-secondary" style="font-size:var(--text-sm); height:40px;" data-mark="${sec.id}">
              ${studied ? '✅ 완료됨' : '완료 표시'}
            </button>
            <button class="btn btn-ghost" style="font-size:var(--text-sm); height:40px;" data-bookmark="${sec.id}">
              ${state.isBookmarkedSection(sec.id) ? '⭐ 저장됨' : '⭐ 저장'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  // 아이템 클릭 (펼치기/접기)
  wrap.addEventListener('click', e => {
    const header = e.target.closest('.concept-list-header');
    const markBtn = e.target.closest('[data-mark]');
    const bmBtn   = e.target.closest('[data-bookmark]');

    if (markBtn) {
      const sid = markBtn.dataset.mark;
      if (state.isStudied(sid)) {
        state.unmarkStudied(sid);
        markBtn.textContent = '완료 표시';
      } else {
        state.markStudied(sid);
        markBtn.textContent = '✅ 완료됨';
        touchStreak();
        showToast('✅ 학습 완료!', 'success');
      }
      const check = markBtn.closest('.concept-list-item').querySelector('.concept-list-check');
      check.classList.toggle('done', state.isStudied(sid));
      check.textContent = state.isStudied(sid) ? '✓' : '';
      return;
    }

    if (bmBtn) {
      const sid = bmBtn.dataset.bookmark;
      const isNow = state.toggleBookmarkSection(sid);
      bmBtn.textContent = isNow ? '⭐ 저장됨' : '⭐ 저장';
      showToast(isNow ? '⭐ 즐겨찾기 추가' : '즐겨찾기 해제');
      return;
    }

    if (header) {
      const item = header.closest('.concept-list-item');
      item.classList.toggle('expanded');
    }
  });

  container.appendChild(wrap);
}

/* ===================================================
   스와이프 헬퍼
   =================================================== */
function addSwipe(el, { onSwipeLeft, onSwipeRight, threshold = 50 }) {
  if (!el) return;
  let startX = 0, startY = 0;

  el.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  el.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > threshold && Math.abs(dx) > Math.abs(dy) * 1.5) {
      if (dx < 0) onSwipeLeft?.();
      else onSwipeRight?.();
    }
  }, { passive: true });
}
