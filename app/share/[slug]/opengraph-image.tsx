import { ImageResponse } from 'next/og';
import { getAnalysisBySlug } from '@/lib/db/analyses';
import { getSongById } from '@/lib/db/songs';
import { moodToColor } from '@/lib/analysis/palette';
import { extractOgPayload } from './og-data';

export const runtime = 'edge';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = 'Song Analyzer — shared analysis';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

/**
 * Tiny inline radar miniature, sized to fit in the OG layout's right column.
 *
 * Hand-rolled SVG (no Framer / no CSS vars) — `next/og` evaluates a small
 * subset of CSS so we keep this purely visual with explicit hex colors.
 */
function MiniRadar({
  scores,
  color,
  size: dim = 220,
}: {
  scores: number[];
  color: string;
  size?: number;
}) {
  const cx = dim / 2;
  const cy = dim / 2;
  const r = dim * 0.4;
  const step = (2 * Math.PI) / scores.length;

  const pt = (i: number, s: number) => {
    const a = i * step - Math.PI / 2;
    return { x: cx + Math.cos(a) * r * s, y: cy + Math.sin(a) * r * s };
  };

  const points = scores
    .map((s, i) => {
      const { x, y } = pt(i, s);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');

  const rings = [0.25, 0.5, 0.75, 1].map((ringR) =>
    scores
      .map((_, i) => {
        const { x, y } = pt(i, ringR);
        return `${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' '),
  );

  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`}>
      {rings.map((p, idx) => (
        <polygon key={idx} points={p} fill="none" stroke="#2E2E38" strokeWidth="1" />
      ))}
      <polygon
        points={points}
        fill={color}
        fillOpacity="0.35"
        stroke={color}
        strokeWidth="2"
      />
    </svg>
  );
}

// Plausible mock radar scores derived from the textual mood/energy labels.
// Mirrors lib/components/MoodRadar logic but inlined to avoid importing React
// client components from an edge route.
const ENERGY_SCORES: Record<string, number> = {
  'Very High': 1,
  High: 0.8,
  Moderate: 0.55,
  Low: 0.3,
  'Very Low': 0.1,
};
const SENTIMENT_SCORES: Record<string, number> = {
  'Very Positive': 1,
  Positive: 0.75,
  'Neutral/Mixed': 0.5,
  Negative: 0.25,
  'Very Negative': 0.05,
};

function deriveScores(p: {
  energy: string;
  sentiment: string;
  mood: string;
  vibe: string;
  themes: string[];
}): number[] {
  const intense = ['High-Energy', 'Intense', 'Edgy', 'Empowering'];
  const calm = ['Mellow', 'Laid-back', 'Tranquil', 'Dreamy'];
  const highEmo = ['Euphoric', 'Sorrowful', 'Aggressive', 'Romantic', 'Melancholic'];
  const lowEmo = ['Contemplative', 'Peaceful', 'Uplifting'];
  return [
    ENERGY_SCORES[p.energy] ?? 0.5,
    SENTIMENT_SCORES[p.sentiment] ?? 0.5,
    intense.includes(p.vibe) ? 0.85 : calm.includes(p.vibe) ? 0.2 : 0.5,
    Math.min(p.themes.length / 5, 1),
    highEmo.includes(p.mood) ? 0.9 : lowEmo.includes(p.mood) ? 0.35 : 0.55,
  ];
}

export default async function Image({ params }: RouteContext) {
  const { slug } = await params;
  const analysis = await getAnalysisBySlug(slug);

  // If the slug isn't valid, still render a generic fallback image — Next
  // expects a 200 from this route, not a 404.
  if (!analysis || !analysis.is_public) {
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: '#07070A',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#B4B4BD',
            fontSize: 48,
          }}
        >
          Song Analyzer
        </div>
      ),
      { ...size },
    );
  }

  const song = analysis.song_id ? await getSongById(analysis.song_id) : null;
  const payload = extractOgPayload(analysis, song);
  const palette = payload.moodColor ?? moodToColor(payload.mood);
  const scores = deriveScores(payload);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: '#07070A',
          color: '#F5F5F7',
          position: 'relative',
        }}
      >
        {/* Radial gradient backdrop using the mood color */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(ellipse 80% 70% at 20% 50%, ${palette.from}55, transparent 60%), radial-gradient(ellipse 70% 60% at 90% 30%, ${palette.to}44, transparent 70%)`,
            display: 'flex',
          }}
        />

        {/* Left column — blurred + sharp cover stack */}
        <div
          style={{
            width: 380,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            padding: 40,
          }}
        >
          {payload.coverUrl ? (
            <>
              {/* Blurred backdrop layer */}
              <img
                src={payload.coverUrl}
                alt=""
                width={420}
                height={420}
                style={{
                  position: 'absolute',
                  top: 105,
                  left: 30,
                  width: 420,
                  height: 420,
                  objectFit: 'cover',
                  filter: 'blur(40px)',
                  opacity: 0.6,
                  borderRadius: 24,
                }}
              />
              {/* Sharp tile */}
              <img
                src={payload.coverUrl}
                alt=""
                width={300}
                height={300}
                style={{
                  width: 300,
                  height: 300,
                  objectFit: 'cover',
                  borderRadius: 24,
                  border: '1px solid #2E2E38',
                  boxShadow: `0 0 60px ${palette.from}88`,
                }}
              />
            </>
          ) : (
            <div
              style={{
                width: 300,
                height: 300,
                borderRadius: 24,
                background: `linear-gradient(135deg, ${palette.from}, ${palette.to})`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 140,
                color: '#F5F5F7',
              }}
            >
              ♪
            </div>
          )}
        </div>

        {/* Right column — text + mini radar */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '60px 60px 60px 20px',
            gap: 18,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 18,
              letterSpacing: 8,
              textTransform: 'uppercase',
              color: '#B4B4BD',
            }}
          >
            Song Analyzer
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 64,
              fontWeight: 600,
              lineHeight: 1.05,
              maxWidth: 660,
              color: '#F5F5F7',
            }}
          >
            {payload.title}
          </div>
          {payload.artist && (
            <div
              style={{
                display: 'flex',
                fontSize: 24,
                letterSpacing: 4,
                textTransform: 'uppercase',
                color: '#B4B4BD',
              }}
            >
              {payload.album ? `${payload.artist} · ${payload.album}` : payload.artist}
            </div>
          )}

          {/* Mood + vibe badges */}
          <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 18px',
                borderRadius: 999,
                background: `${palette.from}22`,
                border: `1px solid ${palette.from}66`,
                color: palette.from,
                fontSize: 22,
              }}
            >
              {payload.mood}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 18px',
                borderRadius: 999,
                background: '#17171E',
                border: '1px solid #2E2E38',
                color: '#B4B4BD',
                fontSize: 22,
              }}
            >
              {payload.vibe}
            </div>
          </div>

          {/* Inline mini radar */}
          <div style={{ display: 'flex', marginTop: 12 }}>
            <MiniRadar scores={scores} color={palette.from} />
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}
