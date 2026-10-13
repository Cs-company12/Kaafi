/* =====================================================================
   Kaafi Hospital — Service Worker
   - Makes the app installable on every device (Android, Samsung, iPhone, desktop)
   - Works offline for the app shell (pages, icons, libraries)
   - NEVER caches Supabase data or the EVC/USSD payment step (always live)
   ===================================================================== */
const VERSION = 'kaafi-v5';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

/* Own files (relative to this sw.js). Each one is cached on its own,
   so a missing file never stops the app from installing. */
const SHELL_FILES = [
  './',
  'index.html',
  'manifest.json',
  /* optional — cached only if they exist on the website */
  'admin.html',
  'admin-manifest.json',
  'apple-touch-icon.png',
  'favicon.ico',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

/* Libraries the pages load from CDNs (cached so the app opens offline) */
const CDN_FILES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11',
  'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css'
];

/* Hosts whose files may be cached at runtime */
const CACHEABLE_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'];

/* Never touched by the service worker (live data, auth, realtime, storage uploads) */
const isLiveData = url =>
  url.hostname.endsWith('supabase.co') || url.hostname.endsWith('supabase.in') ||
  url.protocol === 'ws:' || url.protocol === 'wss:';

/* ---------- install: cache the app shell ---------- */
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const shell = await caches.open(SHELL_CACHE);
    await Promise.all(SHELL_FILES.map(path =>
      shell.add(new Request(path, {cache: 'reload'})).catch(() => {})
    ));
    const runtime = await caches.open(RUNTIME_CACHE);
    await Promise.all(CDN_FILES.map(url =>
      runtime.add(new Request(url, {mode: 'cors', credentials: 'omit'})).catch(() => {})
    ));
    await self.skipWaiting();
  })());
});

/* ---------- activate: remove old caches, take control ---------- */
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys
      .filter(k => k.startsWith('kaafi-') && k !== SHELL_CACHE && k !== RUNTIME_CACHE)
      .map(k => caches.delete(k)));
    if (self.registration.navigationPreload) {
      try { await self.registration.navigationPreload.enable(); } catch (e) {}
    }
    await self.clients.claim();
  })());
});

/* ---------- allow the page to activate a new version immediately ---------- */
self.addEventListener('message', event => {
  if (event.data === 'SKIP_WAITING' || (event.data && event.data.type === 'SKIP_WAITING')) self.skipWaiting();
});

/* ---------- helpers ---------- */
async function putSafe(cacheName, request, response) {
  if (!response || !(response.ok || response.type === 'opaque')) return;
  try { const c = await caches.open(cacheName); await c.put(request, response); } catch (e) {}
}

/* Pages: always try the network first (newest version), fall back to cache when offline */
async function handleNavigation(event) {
  const req = event.request;
  try {
    const preload = await event.preloadResponse;
    const res = preload || await fetch(req);
    putSafe(SHELL_CACHE, req, res.clone());
    return res;
  } catch (e) {
    const cached = await caches.match(req, {ignoreSearch: true});
    if (cached) return cached;
    const isAdmin = new URL(req.url).pathname.endsWith('admin.html');
    return (await caches.match(isAdmin ? 'admin.html' : 'index.html'))
        || (await caches.match('./'))
        || new Response('<h1 style="font-family:sans-serif">Internet ma jiro</h1><p style="font-family:sans-serif">Fadlan hubi internetkaaga oo isku day mar kale.</p>',
                        {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8'}});
  }
}

/* Files: answer from cache at once, refresh in the background (stale-while-revalidate) */
async function staleWhileRevalidate(event, cacheName) {
  const req = event.request;
  const cached = await caches.match(req);
  const network = fetch(req).then(res => { putSafe(cacheName, req, res.clone()); return res; }).catch(() => null);
  if (cached) { event.waitUntil(network); return cached; }
  const res = await network;
  return res || new Response('', {status: 504});
}

/* ---------- fetch ---------- */
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;                       // bookings, payments, uploads: never intercepted

  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;   // tel:, data:, etc.
  if (isLiveData(url)) return;                            // Supabase: always live from the network

  if (req.mode === 'navigate') { event.respondWith(handleNavigation(event)); return; }

  if (url.origin === self.location.origin) { event.respondWith(staleWhileRevalidate(event, SHELL_CACHE)); return; }

  if (CACHEABLE_HOSTS.includes(url.hostname)) { event.respondWith(staleWhileRevalidate(event, RUNTIME_CACHE)); return; }
  /* anything else: browser default */
});
