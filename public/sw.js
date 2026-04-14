// Service Worker — offline support without breaking updates
// Strategy:
// - HTML: network-first (always try fresh, fallback to cache)
// - Assets (JS/CSS/images): cache-first (fast, hashed filenames = auto-invalidation)
// - Auto-skip-waiting for instant updates

const CACHE_NAME = 'tracking-v2'
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './favicon.svg',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  )
  self.skipWaiting() // activate new SW immediately
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Delete old caches
      caches.keys().then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )),
      // Take control of all clients immediately
      self.clients.claim(),
    ])
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  // Don't cache API calls (GitHub, Puter.js, fonts)
  if (url.hostname !== location.hostname) return

  // HTML: network-first (always try fresh, fallback to cache when offline)
  const isHTML = req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html')
  if (isHTML) {
    event.respondWith(
      fetch(req)
        .then(res => {
          const clone = res.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(req, clone))
          return res
        })
        .catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    )
    return
  }

  // Assets: cache-first (hashed filenames = safe to cache aggressively)
  event.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      if (res.ok) {
        const clone = res.clone()
        caches.open(CACHE_NAME).then(cache => cache.put(req, clone))
      }
      return res
    }))
  )
})
