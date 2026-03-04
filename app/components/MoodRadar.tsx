'use client';

/**
 * SVG radar / spider chart that visualizes mood dimensions.
 * Dimensions: Energy, Positivity, Intensity, Complexity, Emotionality
 */

interface MoodRadarProps {
  energy: string;
  sentiment: string;
  mood: string;
  vibe: string;
  themes: string[];
}

// Map textual values to 0-1 scores
function energyScore(energy: string): number {
  const map: Record<string, number> = {
    'Very High': 1,
    High: 0.8,
    Moderate: 0.55,
    Low: 0.3,
    'Very Low': 0.1,
  };
  return map[energy] ?? 0.5;
}

function sentimentScore(sentiment: string): number {
  const map: Record<string, number> = {
    'Very Positive': 1,
    Positive: 0.75,
    'Neutral/Mixed': 0.5,
    Negative: 0.25,
    'Very Negative': 0.05,
  };
  return map[sentiment] ?? 0.5;
}

function intensityScore(vibe: string): number {
  const intense = ['High-Energy', 'Intense', 'Edgy', 'Empowering'];
  const calm = ['Mellow', 'Laid-back', 'Tranquil', 'Dreamy'];
  if (intense.includes(vibe)) return 0.85;
  if (calm.includes(vibe)) return 0.2;
  return 0.5;
}

function complexityScore(themes: string[]): number {
  return Math.min(themes.length / 5, 1);
}

function emotionalityScore(mood: string): number {
  const highEmo = ['Euphoric', 'Sorrowful', 'Aggressive', 'Romantic', 'Melancholic'];
  const lowEmo = ['Contemplative', 'Peaceful', 'Uplifting'];
  if (highEmo.includes(mood)) return 0.9;
  if (lowEmo.includes(mood)) return 0.35;
  return 0.55;
}

const LABELS = ['Energy', 'Positivity', 'Intensity', 'Complexity', 'Emotion'];
const AXIS_COUNT = LABELS.length;

function polarToXY(angle: number, radius: number, cx: number, cy: number) {
  const a = angle - Math.PI / 2; // rotate so first axis is top
  return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
}

export default function MoodRadar({ energy, sentiment, mood, vibe, themes }: MoodRadarProps) {
  const scores = [
    energyScore(energy),
    sentimentScore(sentiment),
    intensityScore(vibe),
    complexityScore(themes),
    emotionalityScore(mood),
  ];

  const cx = 100;
  const cy = 100;
  const maxR = 75;
  const step = (2 * Math.PI) / AXIS_COUNT;

  // Build polygon points for the data shape
  const points = scores
    .map((s, i) => {
      const { x, y } = polarToXY(i * step, s * maxR, cx, cy);
      return `${x},${y}`;
    })
    .join(' ');

  // Grid rings
  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-slate-700">
      <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">
        Mood Dimensions
      </h3>
      <svg viewBox="0 0 200 200" className="w-full max-w-[260px] mx-auto">
        {/* Grid rings */}
        {rings.map((r) => (
          <polygon
            key={r}
            points={Array.from({ length: AXIS_COUNT })
              .map((_, i) => {
                const { x, y } = polarToXY(i * step, r * maxR, cx, cy);
                return `${x},${y}`;
              })
              .join(' ')}
            fill="none"
            stroke="currentColor"
            className="text-gray-200 dark:text-slate-700"
            strokeWidth="0.5"
          />
        ))}

        {/* Axis lines */}
        {LABELS.map((_, i) => {
          const { x, y } = polarToXY(i * step, maxR, cx, cy);
          return (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={x}
              y2={y}
              stroke="currentColor"
              className="text-gray-200 dark:text-slate-700"
              strokeWidth="0.5"
            />
          );
        })}

        {/* Data polygon */}
        <polygon
          points={points}
          className="fill-blue-500/20 stroke-blue-500 dark:fill-blue-400/20 dark:stroke-blue-400"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />

        {/* Data dots */}
        {scores.map((s, i) => {
          const { x, y } = polarToXY(i * step, s * maxR, cx, cy);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="3"
              className="fill-blue-600 dark:fill-blue-400"
            />
          );
        })}

        {/* Labels */}
        {LABELS.map((label, i) => {
          const { x, y } = polarToXY(i * step, maxR + 16, cx, cy);
          return (
            <text
              key={i}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-gray-500 dark:fill-gray-400 text-[7px] font-medium"
            >
              {label}
            </text>
          );
        })}
      </svg>
    </div>
  );
}
