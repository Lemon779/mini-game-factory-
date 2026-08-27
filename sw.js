const CACHE_NAME = 'game-001-shell-v2';
const APP_SHELL = [
	'./',
	'./manifest.json',
	'./assets/icons/icon-192.png',
	'./assets/icons/icon-512.png',
	'./assets/screenshots/desktop.png',
	'./assets/screenshots/mobile.png'
];

self.addEventListener('install', (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
	);
	self.skipWaiting();
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		caches.keys().then((cacheNames) => Promise.all(
			cacheNames
				.filter((cacheName) => cacheName !== CACHE_NAME)
				.map((cacheName) => caches.delete(cacheName))
		))
	);
	self.clients.claim();
});

self.addEventListener('fetch', (event) => {
	if (event.request.method !== 'GET') {
		return;
	}
	const requestUrl = new URL(event.request.url);
	if (!['http:', 'https:'].includes(requestUrl.protocol) || requestUrl.origin !== self.location.origin) {
		return;
	}

	event.respondWith(
		(async () => {
			const cachedResponse = await caches.match(event.request);
			if (cachedResponse) {
				return cachedResponse;
			}
			const response = await fetch(event.request);
			if (!response || response.status !== 200 || response.type === 'opaque') {
				return response;
			}
			try {
				const cache = await caches.open(CACHE_NAME);
				await cache.put(event.request, response.clone());
			} catch (_) {}
			return response;
		})()
	);
});
