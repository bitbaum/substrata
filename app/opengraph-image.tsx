import { ImageResponse } from 'next/og';
import { SITE } from '@/lib/site';

export const alt = `${SITE.name} — Physical bottlenecks to transformative technology`;
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const DOMAINS = [
  'Compute',
  'Energy',
  'Materials',
  'Actuation',
  'Talent',
  'Capital',
  'Permission',
] as const;

export default function OpengraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        background: 'radial-gradient(ellipse at 80% 20%, #172033 0%, #0b0f19 70%)',
        color: '#f8fafc',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      {/* Brand header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <svg width="48" height="48" viewBox="0 0 32 32">
          <rect x="3" y="4" width="26" height="5" rx="1.5" fill="#f8fafc" opacity="0.35" />
          <rect x="5" y="11" width="22" height="5" rx="1.5" fill="#f8fafc" opacity="0.55" />
          <rect x="7" y="18" width="18" height="5" rx="1.5" fill="#f8fafc" opacity="0.75" />
          <rect x="9" y="25" width="14" height="5" rx="1.5" fill="#f8fafc" />
        </svg>
        <div
          style={{
            fontSize: 34,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#f8fafc',
          }}
        >
          {SITE.name}
        </div>
      </div>

      {/* Hero headline and explanation */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1020px' }}>
        <div
          style={{
            fontSize: 54,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: '-0.025em',
            color: '#ffffff',
          }}
        >
          Physical bottlenecks on the path to transformative technology
        </div>
        <div
          style={{
            fontSize: 22,
            lineHeight: 1.45,
            color: '#94a3b8',
          }}
        >
          Open-source research tracking critical dependencies, chokepoints, supply chains, and lead
          times.
        </div>
      </div>

      {/* Domain tags */}
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        {DOMAINS.map((domain) => (
          <div
            key={domain}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 20px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.07)',
              border: '1px solid rgba(255, 255, 255, 0.14)',
              fontSize: 18,
              fontWeight: 600,
              color: '#e2e8f0',
              letterSpacing: '-0.01em',
            }}
          >
            {domain}
          </div>
        ))}
      </div>
    </div>,
    { ...size },
  );
}
