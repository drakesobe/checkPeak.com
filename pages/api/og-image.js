import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

export default function handler(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || 'PEAK — Supplement Label Scanner';

  return new ImageResponse(
    (
      <div
        style={{
          background: 'linear-gradient(135deg, #46769B 0%, #1D2433 100%)',
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: 'white',
          fontFamily: 'sans-serif',
          padding: '40px',
        }}
      >
        <h1 style={{ fontSize: 64, fontWeight: 700, textAlign: 'center' }}>
          {query}
        </h1>
        <p style={{ fontSize: 32, marginTop: 24, textAlign: 'center' }}>
          Scan supplements & detect banned substances
        </p>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
