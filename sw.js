const VERSION = '1.0.0';
const CACHE_NAME = `sw-cache-${VERSION}`;
const MAX_AGE = 10 * 60 * 1000; // 10 minutes in milliseconds

/**
 * Main request handler implementing the 10-minute SWR logic
 */
async function handleRequest(request) {
  const cache = await caches.open(CACHE_NAME);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    const fetchedOn = cachedResponse.headers.get('X-SW-Fetched-On');
    const age = fetchedOn ? Date.now() - new Date(fetchedOn).getTime() : Infinity;

    // If less than 10 minutes old, serve from cache and update in background
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

  // If not in cache or older than 10 minutes (cache time 0), fetch from network
  // and update the cache for the next request.
  return revalidate(cache, request);
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

      // If it's HTML, scan for links to prefetch
      const contentType = networkResponse.headers.get('Content-Type');
      if (contentType && contentType.includes('text/html')) {
        scanAndPrefetch(networkResponse.clone(), cache).catch(() => {});
      }
    }

    return networkResponse;
  } catch (error) {
    // Fallback to cache if network fails, even if stale
    const fallback = await cache.match(request);
    if (fallback) return fallback;
    throw error;
  }
}

/**
 * Scans HTML content for links starting with "/" and triggers a background fetch for them
 */
async function scanAndPrefetch(response, cache) {
  const html = await response.text();
  // Regex to find href="/..." or href='/...'
  const linkRegexp = /href=['"](\/[^'"]+)['"]/g;
  let match;
  const seen = new Set();

  while ((match = linkRegexp.exec(html)) !== null) {
    const path = match[1];
    if (!seen.has(path)) {
      seen.add(path);
      const url = new URL(path, self.location.origin).href;
      
      // Check if already in cache and fresh before prefetching
      const cached = await cache.match(url);
      if (cached) {
        const fetchedOn = cached.headers.get('X-SW-Fetched-On');
        const age = fetchedOn ? Date.now() - new Date(fetchedOn).getTime() : Infinity;
        if (age < MAX_AGE) continue;
      }

      console.log(`[SW] Prefetching local link: ${url}`);
      // Use the existing logic to fetch and cache
      revalidate(cache, new Request(url)).catch(() => {});
    }
  }
}
