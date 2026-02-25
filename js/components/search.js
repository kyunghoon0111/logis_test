/**
 * search.js - 검색 오버레이
 */
import { search } from '../data.js';
import { router } from '../router.js';

let _debounceTimer = null;

export function initSearch() {
  const overlay   = document.getElementById('search-overlay');
  const input     = document.getElementById('search-input');
  const results   = document.getElementById('search-results');
  const btnSearch = document.getElementById('btn-search');
  const btnClose  = document.getElementById('search-close');

  if (!overlay) return;

  btnSearch?.addEventListener('click', openSearch);
  btnClose?.addEventListener('click', closeSearch);

  input?.addEventListener('input', () => {
    clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => renderResults(input.value, results), 280);
  });

  // 검색 결과 클릭
  results?.addEventListener('click', e => {
    const sectionBtn = e.target.closest('[data-section]');
    const quizBtn    = e.target.closest('[data-quiz]');
    if (sectionBtn) {
      closeSearch();
      router.navigate('study', { sectionId: sectionBtn.dataset.section });
    }
    if (quizBtn) {
      closeSearch();
      router.navigate('quiz', { quizId: quizBtn.dataset.quiz });
    }
  });
}

function openSearch() {
  const overlay = document.getElementById('search-overlay');
  const input   = document.getElementById('search-input');
  overlay.classList.remove('hidden');
  setTimeout(() => input?.focus(), 100);
}

function closeSearch() {
  const overlay = document.getElementById('search-overlay');
  const input   = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  overlay.classList.add('hidden');
  if (input) input.value = '';
  if (results) results.innerHTML = '<p class="search-placeholder">검색어를 입력하세요</p>';
}

function renderResults(query, container) {
  if (!query.trim()) {
    container.innerHTML = '<p class="search-placeholder">검색어를 입력하세요</p>';
    return;
  }

  const { sections, quizzes } = search(query, 8);

  if (sections.length === 0 && quizzes.length === 0) {
    container.innerHTML = `<p class="search-placeholder">"${query}"에 대한 결과가 없습니다</p>`;
    return;
  }

  let html = '';

  if (sections.length > 0) {
    html += `<div class="search-group-title">개념 (${sections.length})</div>`;
    html += sections.map(sec => `
      <div class="search-result-item" data-section="${sec.id}" role="button">
        <div class="search-result-icon concept">📖</div>
        <div class="search-result-text">
          <div class="search-result-title">${highlight(sec.title, query)}</div>
          <div class="search-result-sub">${sec.chapterId}</div>
        </div>
      </div>
    `).join('');
  }

  if (quizzes.length > 0) {
    html += `<div class="search-group-title">문제 (${quizzes.length})</div>`;
    html += quizzes.map(q => `
      <div class="search-result-item" data-quiz="${q.id}" role="button">
        <div class="search-result-icon quiz">✏️</div>
        <div class="search-result-text">
          <div class="search-result-title">${highlight(q.question.slice(0, 60), query)}${q.question.length > 60 ? '...' : ''}</div>
          <div class="search-result-sub">${q.topic || q.chapterId}</div>
        </div>
      </div>
    `).join('');
  }

  container.innerHTML = html;
}

function highlight(text, query) {
  const safe = escHtml(text);
  const re = new RegExp(`(${escRe(query)})`, 'gi');
  return safe.replace(re, '<mark style="background:rgba(59,130,246,0.2); color:var(--color-primary); border-radius:2px; padding:0 2px;">$1</mark>');
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escRe(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
