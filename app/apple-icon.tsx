import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

// Home-screen icon: same mark as app/icon.svg, on a full-bleed square (iOS rounds the corners)
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
          background: 'linear-gradient(135deg, #10b981 0%, #047857 100%)',
        }}
      >
        <svg width="120" height="120" viewBox="4 4 24 24">
          <path d="M9 10.5h14M9 16h10M9 21.5h6" fill="none" stroke="#fff" strokeWidth="2.75" strokeLinecap="round" />
          <circle cx="22" cy="21.5" r="2.25" fill="#a7f3d0" />
        </svg>
      </div>
    ),
    { ...size }
  );
}
