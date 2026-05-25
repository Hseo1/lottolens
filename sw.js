// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  LottoLens Service Worker
//  버전이 바뀔 때마다 CACHE_NAME을 올려서
//  새 캐시로 교체 → 앱에 업데이트 알림
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CACHE_NAME = 'lottolens-v1';

// 캐시할 파일 목록
const ASSETS = [
  './',
  './index.html',
  './icon-512.png',
  'https://fonts.googleapis.com/css2?family=Pretendard:wght@400;500;600;700;800;900&display=swap',
];

// ── 설치: 캐시 생성 ────────────────────────
self.addEventListener('install', event => {
  // 이전 SW를 기다리지 않고 즉시 활성화
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return Promise.allSettled(
        ASSETS.map(url => cache.add(url).catch(() => {})) // 실패해도 무시
      );
    })
  );
});

// ── 활성화: 낡은 캐시 삭제 ─────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // 열려있는 탭에 즉시 적용
  );
});

// ── 메시지: applyUpdate() 에서 SKIP_WAITING 수신 ──
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── fetch: 네트워크 우선, 실패 시 캐시 ──────
// index.html은 항상 네트워크에서 최신 버전을 시도
// 나머지는 캐시 우선
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // 외부 API(GitHub, Google Fonts 등)는 그냥 통과
  if (!url.origin.includes('github.io') && !url.origin.includes('localhost')) {
    return;
  }

  // index.html: 네트워크 우선 → 실패 시 캐시
  if (url.pathname.endsWith('/') || url.pathname.endsWith('index.html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          // 새 버전 캐시에 저장
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 나머지 자산: 캐시 우선 → 없으면 네트워크
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    })
  );
});
