import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

const FEATURES = ['Film', 'Nutrition', 'Workouts', 'Attendance', 'Check-ins'];

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q') || 'Programmatic athlete accountability.';

  // First sentence = headline, strip trailing punctuation
  const dotIdx  = query.search(/[.!?]/);
  const headline = (dotIdx > 0 ? query.slice(0, dotIdx) : query).trim();

  // Scale headline down for longer strings so it wraps to ~2 lines
  const hl = headline.length;
  const headlinePx = hl > 42 ? 74 : hl > 30 ? 88 : 100;

  // ── Load Barlow Condensed Black Italic ────────────────────────────────────
  let barlowData = null;
  try {
    const css = await fetch(
      'https://fonts.googleapis.com/css2?family=Barlow+Condensed:ital,wght@1,900&display=swap',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' } }
    ).then(r => r.text());

    const fontUrl = css.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
    if (fontUrl) barlowData = await fetch(fontUrl).then(r => r.arrayBuffer());
  } catch {
    // graceful fallback
  }

  const bc = barlowData ? 'Barlow Condensed' : 'sans-serif';

  return new ImageResponse(
    (
      <div
        style={{
          position:   'relative',
          background: '#08090F',
          width:      '1200px',
          height:     '630px',
          display:    'flex',
          overflow:   'hidden',
        }}
      >
        {/* ── Blue atmospheric bloom — top-right, away from text ── */}
        <div style={{
          position:     'absolute',
          right:        -240,
          top:          -240,
          width:        720,
          height:       720,
          borderRadius: '50%',
          background:   'radial-gradient(circle, rgba(79,171,255,0.13) 0%, rgba(79,171,255,0.03) 50%, transparent 72%)',
          display:      'flex',
        }} />

        {/* ── Ghost CP monogram — lower-right anchor ── */}
        <div style={{
          position:      'absolute',
          right:         -110,
          bottom:        -80,
          fontSize:      '560px',
          fontWeight:    900,
          fontStyle:     'italic',
          color:         'rgba(255,255,255,0.035)',
          fontFamily:    bc,
          lineHeight:    1,
          letterSpacing: '-0.06em',
          textTransform: 'uppercase',
          display:       'flex',
        }}>
          CP
        </div>

        {/* ── Left vertical bar ── */}
        <div style={{
          position:   'absolute',
          left:       0,
          top:        0,
          bottom:     0,
          width:      '5px',
          background: '#4FABFF',
          display:    'flex',
        }} />

        {/* ── Main content ── */}
        <div style={{
          position:       'relative',
          zIndex:         2,
          display:        'flex',
          flexDirection:  'column',
          justifyContent: 'space-between',
          flex:           1,
          padding:        '52px 80px 48px 90px',
        }}>

          {/* Upper block */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>

            {/* Eyebrow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 30 }}>
              <div style={{ width: 24, height: 3, background: '#4FABFF', display: 'flex', flexShrink: 0 }} />
              <span style={{
                fontSize:      '13px',
                fontWeight:    900,
                letterSpacing: '0.26em',
                textTransform: 'uppercase',
                color:         '#4FABFF',
                fontFamily:    bc,
                display:       'flex',
              }}>
                CheckPeak
              </span>
              <span style={{
                fontSize:      '13px',
                color:         'rgba(255,255,255,0.2)',
                fontFamily:    bc,
                display:       'flex',
              }}>
                /
              </span>
              <span style={{
                fontSize:      '12px',
                fontWeight:    700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                color:         'rgba(255,255,255,0.35)',
                fontFamily:    bc,
                display:       'flex',
              }}>
                Performance Intelligence
              </span>
            </div>

            {/* Headline */}
            <div style={{
              fontSize:      `${headlinePx}px`,
              fontWeight:    900,
              fontStyle:     'italic',
              color:         '#FFFFFF',
              fontFamily:    bc,
              lineHeight:    0.88,
              letterSpacing: '-0.02em',
              textTransform: 'uppercase',
              width:         '830px',
              display:       'flex',
              flexWrap:      'wrap',
            }}>
              {headline}
            </div>

            {/* Feature pills */}
            <div style={{ display: 'flex', gap: '10px', marginTop: '30px', flexWrap: 'wrap' }}>
              {FEATURES.map(f => (
                <div
                  key={f}
                  style={{
                    padding:       '7px 16px',
                    border:        '1px solid rgba(79,171,255,0.32)',
                    borderRadius:  '3px',
                    fontSize:      '14px',
                    fontWeight:    800,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color:         'rgba(255,255,255,0.82)',
                    fontFamily:    bc,
                    background:    'rgba(79,171,255,0.08)',
                    display:       'flex',
                  }}
                >
                  {f}
                </div>
              ))}
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Blue fade rule */}
            <div style={{
              width:      '100%',
              height:     '1px',
              background: 'linear-gradient(90deg, #4FABFF 0%, rgba(79,171,255,0.3) 40%, transparent 78%)',
              display:    'flex',
            }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{
                fontSize:      '15px',
                color:         'rgba(255,255,255,0.45)',
                letterSpacing: '0.1em',
                fontWeight:    800,
                fontFamily:    bc,
                textTransform: 'lowercase',
                display:       'flex',
              }}>
                checkpeak.com
              </span>
              <span style={{
                fontSize:      '12px',
                color:         'rgba(255,255,255,0.22)',
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                fontWeight:    700,
                fontFamily:    bc,
                display:       'flex',
              }}>
                Built for College Programs
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width:  1200,
      height: 630,
      fonts:  barlowData
        ? [{ name: 'Barlow Condensed', data: barlowData, style: 'italic', weight: 900 }]
        : [],
    }
  );
}
