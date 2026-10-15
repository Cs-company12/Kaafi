/* =====================================================================
   Kaafi Hospital — Service Worker
   - Makes the app installable on every device (Android, Samsung, iPhone, desktop)
   - Works offline for the app shell (page, icons, font, libraries — all on this website)
   - NEVER caches Supabase data or the EVC/USSD payment step (always live)
   ===================================================================== */
const VERSION = 'kaafi-v9';
const SHELL_CACHE = `${VERSION}-shell`;
const RUNTIME_CACHE = `${VERSION}-runtime`;

/* Own files (relative to this sw.js). Each one is cached on its own,
   so a missing file never stops the app from installing. */
const SHELL_FILES = [
  './',
  'index.html',
  'manifest.json',
  'libs.js',
  'jakarta.woff2'
];

/* Libraries, font and icons all live on this website (no CDN needed) */
const CDN_FILES = [];

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
    await Promise.all(SHELL_FILES.map(async path => {
      try {
        const req = new Request(path, {cache: 'reload'});
        const res = await fetch(req);
        if (res.ok) await shell.put(req, await clean(res));
      } catch (e) {}
    }));
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
/* Some hosts (Cloudflare Pages) redirect /index.html -> / . A page must never be answered with a
   redirected copy (the browser refuses it), so the service worker always keeps a clean copy. */
async function clean(res) {
  if (!res || !res.redirected) return res;
  return new Response(await res.blob(), {status: res.status, statusText: res.statusText, headers: res.headers});
}
async function putSafe(cacheName, request, response) {
  if (!response || !(response.ok || response.type === 'opaque')) return;
  try { const c = await caches.open(cacheName); await c.put(request, await clean(response)); } catch (e) {}
}

/* Pages: newest version from the network — but on a slow or stuck line, never wait more than
   3 seconds when a saved copy exists: the saved copy opens at once and is updated in the background */
const NAV_TIMEOUT = 3000;
async function savedPage(req) {
  const hit = await caches.match(req, {ignoreSearch: true});
  if (hit) return clean(hit);
  const path = new URL(req.url).pathname;
  if (path.endsWith('/') || path.endsWith('/index.html'))
    return clean((await caches.match('./')) || (await caches.match('index.html')));
  if (path.endsWith('/admin'))
    return clean(await caches.match('admin.html'));
  if (path.endsWith('/admin.html'))
    return clean(await caches.match('admin'));
  return null;
}
function offlinePage() {
  return new Response('<h1 style="font-family:sans-serif">Internet ma jiro</h1><p style="font-family:sans-serif">Fadlan hubi internetkaaga oo isku day mar kale.</p>',
                      {status: 503, headers: {'Content-Type': 'text/html; charset=utf-8'}});
}
async function handleNavigation(event) {
  const req = event.request;
  const network = (async () => {
    const res = (await event.preloadResponse) || await fetch(req);
    putSafe(SHELL_CACHE, req, res.clone());
    return res;
  })();
  event.waitUntil(network.then(() => {}, () => {}));
  const saved = await savedPage(req);
  if (!saved) {
    try { return await network; } catch (e) { return offlinePage(); }
  }
  const slow = new Promise(resolve => setTimeout(() => resolve(null), NAV_TIMEOUT));
  try { return (await Promise.race([network, slow])) || saved; }
  catch (e) { return saved; }
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
