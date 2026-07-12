import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

/** Generated favicon — SnapVidly play mark. Uses a real <svg> path (Satori doesn't
 *  support the CSS border-triangle trick), so it renders correctly at any size. */
export default function Icon() {
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
          borderRadius: 8,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24">
          <path d="M8 5.5v13l11-6.5-11-6.5z" fill="#fff" />
        </svg>
      </div>
    ),
    size,
  );
}
