import { ImageResponse } from 'next/og';
import { site } from '@/lib/site';

export const runtime = 'edge';

const HEX_COLOR = /^[0-9a-fA-F]{6}$/;

/** Dynamic 1200×630 social share image — no static asset to maintain. */
export function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title = (searchParams.get('title') ?? site.name).slice(0, 110);
  // Strictly validated — this is interpolated into inline styles on the edge runtime, which has no CSP backstop.
  const rawColor = searchParams.get('color');
  const accent = rawColor && HEX_COLOR.test(rawColor) ? `#${rawColor}` : '#2563EB';

  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
          padding: '72px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: accent,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderTop: '11px solid transparent',
                borderBottom: '11px solid transparent',
                borderLeft: '18px solid #fff',
                marginLeft: 4,
              }}
            />
          </div>
          <div style={{ color: '#fff', fontSize: 30, fontWeight: 700 }}>SnapVidly</div>
        </div>
        <div style={{ color: '#fff', fontSize: 62, fontWeight: 800, lineHeight: 1.1, maxWidth: 980 }}>
          {title}
        </div>
        <div style={{ color: '#93C5FD', fontSize: 26, fontWeight: 500 }}>
          Free · Fast · No watermark · Mobile &amp; PC
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
