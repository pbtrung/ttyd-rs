// ttyd-rs service worker: makes the app installable and lets the shell
// load instantly / offline. It never touches /api or /ws — terminal
// traffic and file transfers always go straight to the network.
const CACHE = 'ttyd-rs-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
    event.waitUntil(
        (async () => {
            const keys = await caches.keys();
            await Promise.all(
                keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
            );
            await self.clients.claim();
        })(),
    );
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);
    if (url.origin !== self.location.origin) return;
    if (url.pathname.startsWith('/api/') || url.pathname === '/ws') return;

    // Hashed build output never changes: cache first.
    if (url.pathname.startsWith('/assets/')) {
        event.respondWith(
            (async () => {
                const cache = await caches.open(CACHE);
                const hit = await cache.match(req);
                if (hit) return hit;
                const resp = await fetch(req);
                if (resp.ok) cache.put(req, resp.clone());
                return resp;
            })(),
        );
        return;
    }

    // Everything else (index.html, icons, manifest): network first so an
    // upgraded server is picked up immediately; fall back to the cache.
    event.respondWith(
        (async () => {
            const cache = await caches.open(CACHE);
            try {
                const resp = await fetch(req);
                if (resp.ok) cache.put(req, resp.clone());
                return resp;
            } catch (err) {
                const hit = await cache.match(req, {
                    ignoreSearch: req.mode === 'navigate',
                });
                if (hit) return hit;
                throw err;
            }
        })(),
    );
});
