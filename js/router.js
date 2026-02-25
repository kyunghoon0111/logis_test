/**
 * router.js - 해시 기반 SPA 라우터
 * 화면 전환 및 뒤로가기 지원
 */

const _handlers = {};
let _current = null;
let _history  = [];

export const router = {
  /**
   * 화면 핸들러 등록
   * @param {string} screen - 화면 이름
   * @param {function} handler - (params) => HTMLElement
   */
  on(screen, handler) {
    _handlers[screen] = handler;
  },

  /**
   * 화면 이동
   * @param {string} screen
   * @param {object} params
   * @param {boolean} back - 뒤로가기 여부
   */
  navigate(screen, params = {}, back = false) {
    if (_current === screen && JSON.stringify(params) === '{}') return;

    const container = document.getElementById('screen-container');
    if (!container) return;

    const handler = _handlers[screen];
    if (!handler) {
      console.warn(`Router: no handler for screen "${screen}"`);
      return;
    }

    // 이전 화면 제거
    const prev = container.querySelector('.screen');
    if (prev) {
      const exitClass = back ? 'screen-exit-back' : 'screen-exit';
      prev.classList.add(exitClass);
      setTimeout(() => prev.remove(), 400);
    }

    // 새 화면 생성
    const el = handler(params);
    el.classList.add('screen');
    const enterClass = back ? 'screen-enter-back' : (prev ? 'screen-enter' : 'screen-fade-in');
    el.classList.add(enterClass);
    container.appendChild(el);

    // 히스토리 관리
    if (back) {
      _history.pop();
    } else {
      if (_current) _history.push({ screen: _current, params: {} });
    }
    _current = screen;

    // 하단 탭바 활성화 업데이트
    _updateNav(screen);
  },

  back() {
    if (_history.length === 0) return;
    const prev = _history[_history.length - 1];
    this.navigate(prev.screen, prev.params, true);
  },

  current() { return _current; },
};

function _updateNav(screen) {
  document.querySelectorAll('.nav-item').forEach(btn => {
    const s = btn.dataset.screen;
    btn.classList.toggle('active', s === screen);
  });
}
