/**
 * sw.js - Service Worker (오프라인 지원)
 * 전략: App Shell + 데이터 파일 모두 CacheFirst
 */

const CACHE_VER  = 'logis-v1';
const DATA_CACHE = 'logis-data-v1';

const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/base.css',
  './css/layout.css',
  './css/components.css',
  './css/screens.css',
  './css/animations.css',
  './js/app.js',
  './js/data.js',
  './js/state.js',
  './js/router.js',
  './js/screens/home.js',
  './js/screens/study.js',
  './js/screens/quiz.js',
  './js/screens/progress.js',
  './js/screens/bookmarks.js',
  './js/components/bottomNav.js',
  './js/components/conceptCard.js',
  './js/components/quizCard.js',
  './js/components/progressRing.js',
  './js/components/toast.js',
  './js/components/search.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

// 70개 데이터 파일 동적 생성
const DATA_FILES = (() => {
  const subjects = [
    { folder: '1. 물류관리론', parts: 8 },
    { folder: '2. 화물운송론', parts: 8 },
    { folder: '3. 국제물류론', parts: 4 },
    { folder: '4. 보관하역론', parts: 8 },
    { folder: '5. 물류관련법규', parts: 7 },
  ];
  const files = [];
  for (const s of subjects) {
    for (let p = 1; p <= s.parts; p++) {
      const pp = String(p).padStart(2, '0');
      files.push(encodeURI(`./물관_데이터/${s.folder}/part${pp}_concepts.json`));
      files.push(encodeURI(`./물관_데이터/${s.folder}/part${pp}_quizzes.json`));
    }
  }
  return files;
})();

// 설치: 앱셸 + 데이터 모두 캐시
self.addEventListener('install', event => {
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_VER).then(cache => cache.addAll(APP_SHELL)),
      caches.open(DATA_CACHE).then(cache => cache.addAll(DATA_FILES)),
    ]).then(() => self.skipWaiting())
  );
});

// 활성화: 오래된 캐시 삭제
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VER && k !== DATA_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// 요청 처리: CacheFirst
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 데이터 파일: CacheFirst
  if (url.pathname.includes('/물관_데이터/') || url.pathname.includes('/%EB%AC%BC%EA%B4%80_')) {
    event.respondWith(cacheFirst(DATA_CACHE, event.request));
    return;
  }

  // 앱셸: CacheFirst
  event.respondWith(cacheFirst(CACHE_VER, event.request));
});

async function cacheFirst(cacheName, request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // 오프라인이고 캐시 없음 → index.html 폴백
    const fallback = await caches.match('./index.html');
    return fallback || new Response('오프라인 상태입니다.', { status: 503 });
  }
}
