/**
 * bottomNav.js - 하단 탭바 초기화
 */
import { router } from '../router.js';

export function initBottomNav() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;

  nav.addEventListener('click', e => {
    const btn = e.target.closest('[data-screen]');
    if (!btn) return;
    const screen = btn.dataset.screen;
    router.navigate(screen);
  });
}
