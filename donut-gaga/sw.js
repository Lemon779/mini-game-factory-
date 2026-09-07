// Donut Gaga service worker — runtime cache-as-you-go (works with hashed
// Vite build filenames and the large audio assets without enumerating them).
const CACHE = "donut-gaga-v1";
const CORE = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  if (req.mode === "navigate") { e.respondWith(fetch(req).catch(() => caches.match("./index.html"))); return; }
  // Audio files: cache-first (large, static, no need to re-fetch once cached).
  if (req.url.includes("/audio/")) {
    e.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; })));
    return;
  }
  e.respondWith(caches.match(req).then((cached) => {
    const network = fetch(req).then((res) => { if (res.ok) caches.open(CACHE).then((c) => c.put(req, res.clone())); return res; }).catch(() => cached);
    return cached || network;
  }));
});
