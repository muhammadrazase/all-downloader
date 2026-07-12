import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Apple touch icon (iOS home-screen) — SnapVidly play mark via real <svg> path. */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#2563EB',
        }}
      >
        <svg width="96" height="96" viewBox="0 0 24 24">
          <path d="M8 5.5v13l11-6.5-11-6.5z" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
