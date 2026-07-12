'use client';

import { useEffect } from 'react';

/** Registers the service worker so SnapVidly is installable and works offline. */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (!('serviceWorker' in navigator)) return;
    const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
    // If the page already finished loading (common after hydration), register now;
    // otherwise wait for the load event. This is what makes the SW register reliably.
    if (document.readyState === 'complete') {
      register();
    } else {
      window.addEventListener('load', register, { once: true });
      return () => window.removeEventListener('load', register);
    }
  }, []);
  return null;
}
