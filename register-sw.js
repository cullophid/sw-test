/**
 * Registers the service worker and handles lifecycle events
 */
export async function registerSW() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('./sw.js', {
        scope: './',
      });

      if (registration.installing) {
        console.log('[SW Registration] Service worker installing');
      } else if (registration.waiting) {
        console.log('[SW Registration] Service worker installed / waiting');
      } else if (registration.active) {
        console.log('[SW Registration] Service worker active');
      }

      // Handle updates
      registration.onupdatefound = () => {
        const newWorker = registration.installing;
        newWorker.onstatechange = () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[SW Registration] New content available; please refresh.');
          }
        };
      };

    } catch (error) {
      console.error(`[SW Registration] Registration failed: ${error}`);
    }
  } else {
    console.warn('[SW Registration] Service workers are not supported in this browser.');
  }
}

// Automatically attempt registration if this script is loaded directly
registerSW();
