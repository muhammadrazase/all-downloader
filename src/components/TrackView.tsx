'use client';

import { useEffect } from 'react';

/**
 * Fires one fire-and-forget beacon per page view. No cookies, no localStorage,
 * no visible UI — this exists only so /admin/analytics can show which tools
 * are actually used, since the pages themselves are force-static and no
 * server code runs per visitor request (see CLAUDE.md — "Scale & caching").
 */
export function TrackView({ tool }: { tool: string }) {
  useEffect(() => {
    const body = JSON.stringify({ tool });
    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([body], { type: 'application/json' }));
    } else {
      fetch('/api/track', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'application/json' } }).catch(
        () => {},
      );
    }
  }, [tool]);

  return null;
}
