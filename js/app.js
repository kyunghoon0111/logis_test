/**
 * app.js - 앱 진입점 및 초기화
 */
import { loadAll } from './data.js';
import { state }   from './state.js';
import { router }  from './router.js';
import { initBottomNav } from './components/bottomNav.js';
import { initSearch }    from './components/search.js';
import { renderHome }     from './screens/home.js';
import { renderStudy }    from './screens/study.js';
import { renderQuiz }     from './screens/quiz.js';
import { renderProgress } from './screens/progress.js';
import { renderBookmarks} from './screens/bookmarks.js';

/* ===================================================
   다크모드 초기 적용 (렌더 전)
   =================================================== */
function applyTheme(mode) {
  const root = document.documentElement;
  root.classList.remove('dark', 'light');
  if (mode === 'dark')  root.classList.add('dark');
  if (mode === 'light') root.classList.add('light');
  // 'auto' = prefers-color-scheme CSS에 맡김

  // 아이콘 전환
  const icon = document.getElementById('dark-icon');
  if (!icon) return;
  const isDark = mode === 'dark' || (mode === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  icon.innerHTML = isDark
    ? '<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>'
    : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>';
}

/* ===================================================
   라우터 등록
   =================================================== */
function registerScreens() {
  router.on('home',      p => renderHome(p));
  router.on('study',     p => renderStudy(p));
  router.on('quiz',      p => renderQuiz(p));
  router.on('progress',  p => renderProgress(p));
  router.on('bookmarks', p => renderBookmarks(p));
}

/* ===================================================
   Service Worker 등록
   =================================================== */
function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => {
      console.warn('SW 등록 실패:', err);
    });
  }
}

/* ===================================================
   다크모드 토글 버튼
   =================================================== */
function initDarkToggle() {
  const btn = document.getElementById('btn-dark');
  btn?.addEventListener('click', () => {
    const current = state.get('darkMode') || 'auto';
    // auto → light → dark → auto 순환
    const next = current === 'auto' ? 'light' : current === 'light' ? 'dark' : 'auto';
    state.set('darkMode', next);
    applyTheme(next);
  });

  // 시스템 테마 변경 감지
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (state.get('darkMode') === 'auto') applyTheme('auto');
  });
}

/* ===================================================
   메인 초기화
   =================================================== */
async function init() {
  // 1. 상태 초기화
  state.init();

  // 2. 테마 즉시 적용
  applyTheme(state.get('darkMode') || 'auto');

  // 3. Service Worker
  registerSW();

  // 4. 라우터 등록
  registerScreens();

  // 5. 다크모드 토글 초기화
  initDarkToggle();

  // 6. 데이터 로드
  try {
    await loadAll();
  } catch (err) {
    console.error('데이터 로드 실패:', err);
    document.getElementById('screen-container').innerHTML = `
      <div class="empty-state" style="height:100%;">
        <div class="empty-icon">⚠️</div>
        <div class="empty-title">데이터를 불러올 수 없습니다</div>
        <div class="empty-desc">
          앱을 로컬 서버에서 열어주세요<br>
          (file:// 프로토콜은 CORS 오류 발생)<br><br>
          터미널에서: <code>python -m http.server 8080</code>
        </div>
      </div>`;
    return;
  }

  // 7. 컴포넌트 초기화
  initBottomNav();
  initSearch();

  // 8. 첫 화면 이동
  const lastScreen = state.get('lastScreen') || 'home';
  router.navigate(lastScreen);

  // 9. 화면 이동 시 lastScreen 저장
  const origNavigate = router.navigate.bind(router);
  router.navigate = function(screen, params, back) {
    state.set('lastScreen', screen);
    return origNavigate(screen, params, back);
  };
}

init();
