const CACHE_NAME = 'sw-cache-v1';
const MAX_AGE = 60 * 1000; // 1 minute in milliseconds

self.addEventListener('install', (event) => {
  // Activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Take control of all pages immediately
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') return;

  // Check if it's a page (navigation), CSS, or JS file
  const isHtml = request.mode === 'navigate' || request.headers.get('Accept')?.includes('text/html');
  const isCss = url.pathname.endsWith('.css') || request.destination === 'style';
  const isJs = url.pathname.endsWith('.js') || request.destination === 'script';

  if (isHtml || isCss || isJs) {
    event.respondWith(handleRequest(request));
  }
});

/**
 * Main request handler implementing the 1-minute SWR logic
 */
async function handleRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    const fetchedOn = cachedResponse.headers.get('X-SW-Fetched-On');
    const age = fetchedOn ? Date.now() - new Date(fetchedOn).getTime() : Infinity;

    // If less than 1 minute old, serve from cache and update in background
    if (age < MAX_AGE) {
      console.log(`[SW] Cache Hit (Fresh): ${request.url}`);
      // Trigger background update
      revalidate(cache, request).catch(() => {}); 
      return cachedResponse;
    }
    console.log(`[SW] Cache Hit (Stale - Revalidating): ${request.url}`);
  } else {
    console.log(`[SW] Cache Miss: ${request.url}`);
  }

  // If not in cache or older than 1 minute (cache time 0), fetch from network
  // and update the cache for the next request.
  return revalidate(cache, request);
}

/**
 * Fetches from network, updates the cache with a timestamp, and returns the response
 */
async function revalidate(cache, request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      // We must clone the response to modify headers and store it
      const headers = new Headers(networkResponse.headers);
      headers.set('X-SW-Fetched-On', new Date().toUTCString());

      const responseToCache = new Response(networkResponse.clone().body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: headers
      });

      await cache.put(request, responseToCache);
    }

    return networkResponse;
  } catch (error) {
    // Fallback to cache if network fails, even if stale
    const fallback = await cache.match(request);
    if (fallback) return fallback;
    throw error;
  }
}
