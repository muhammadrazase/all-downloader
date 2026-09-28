import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

/** Apple touch icon (iOS home-screen) — a 2x2 tile grid (a tools hub, not a play mark). */
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
          <rect x="5.1" y="5.1" width="6" height="6" rx="1.7" fill="#fff" />
          <rect x="12.9" y="5.1" width="6" height="6" rx="1.7" fill="#fff" />
          <rect x="5.1" y="12.9" width="6" height="6" rx="1.7" fill="#fff" />
          <rect x="12.9" y="12.9" width="6" height="6" rx="1.7" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
