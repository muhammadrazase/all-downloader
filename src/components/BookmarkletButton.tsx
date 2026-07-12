'use client';

import { useState } from 'react';

/** One-click bookmarklet — copies a link users drag/save to their bookmarks bar. */
export function BookmarkletButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Draggable bookmarklet link (works in desktop browsers). */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href={code} onClick={(e) => e.preventDefault()} className="btn-ghost cursor-move select-none" draggable>
        ⬇ Save to SnapVidly
      </a>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          } catch {
            /* clipboard blocked */
          }
        }}
        className="text-sm font-medium text-accent hover:text-accent-hover"
      >
        {copied ? '✓ Copied!' : 'Copy bookmarklet code'}
      </button>
      <p className="max-w-sm text-center text-xs text-ink-muted">
        Drag the button to your bookmarks bar. On any video page, click it to open SnapVidly with that link ready.
      </p>
    </div>
  );
}
