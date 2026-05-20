/**
 * Mood → HSL color palette mapping.
 *
 * Given an app-vocabulary mood label (e.g., 'Euphoric', 'Melancholic'), return
 * a gradient (`from` → `to`) plus a `glow` color suitable for box-shadow.
 *
 * The palette is intentionally desaturated / luminous to fit the
 * music-streaming dark aesthetic spec'd in the v2 plan. All values are hex
 * strings so they can be written into CSS custom properties (`--accent-from`,
 * `--accent-to`, `--accent-glow`) by the mood-theme provider.
 *
 * Safe to import in any context (server, client, type-only).
 */

export interface MoodColor {
  from: string;
  to: string;
  glow: string;
}

/**
 * Canonical palettes keyed by the app's mood vocabulary. Values not in this
 * table fall back to the neutral steel palette via `moodToColor`.
 */
const MOOD_PALETTES: Record<string, MoodColor> = {
  // Joy / euphoric: warm yellow → orange.
  Euphoric:     { from: '#FFD166', to: '#F77F00', glow: '#FFB347' },
  Uplifting:    { from: '#FCD34D', to: '#F59E0B', glow: '#FBBF24' },
  Hopeful:      { from: '#FDE68A', to: '#FB923C', glow: '#FCD34D' },

  // Sadness: cool blue → indigo.
  Melancholic:  { from: '#60A5FA', to: '#4338CA', glow: '#6366F1' },
  Sorrowful:    { from: '#3B82F6', to: '#312E81', glow: '#4F46E5' },
  Somber:       { from: '#64748B', to: '#1E3A8A', glow: '#475569' },

  // Anger: red → crimson.
  Aggressive:   { from: '#EF4444', to: '#7F1D1D', glow: '#DC2626' },

  // Fear / anxiety: purple → violet.
  Anxious:      { from: '#A855F7', to: '#581C87', glow: '#9333EA' },

  // Love / romance: pink → rose.
  Romantic:     { from: '#F472B6', to: '#BE185D', glow: '#EC4899' },
  Bittersweet:  { from: '#FB7185', to: '#9D174D', glow: '#F43F5E' },

  // Nostalgia: warm sepia.
  Nostalgic:    { from: '#FBBF24', to: '#92400E', glow: '#D97706' },

  // Peace / calm: teal → emerald.
  Peaceful:     { from: '#5EEAD4', to: '#0F766E', glow: '#14B8A6' },

  // Contemplative / neutral: steel.
  Contemplative:{ from: '#94A3B8', to: '#334155', glow: '#64748B' },
};

const NEUTRAL_PALETTE: MoodColor = MOOD_PALETTES.Contemplative;

/**
 * Map a mood label to its gradient palette.
 *
 * Match is case-insensitive and tolerant of suffixes / extra words so labels
 * like `"Very Melancholic"` or `"Melancholic Reflection"` still resolve.
 * Falls back to a neutral steel palette for unknown moods.
 */
export function moodToColor(mood: string): MoodColor {
  if (!mood) return NEUTRAL_PALETTE;

  // Exact match wins.
  if (MOOD_PALETTES[mood]) return MOOD_PALETTES[mood];

  // Fuzzy match — find a known key contained in the mood string (case-insens).
  const lower = mood.toLowerCase();
  for (const key of Object.keys(MOOD_PALETTES)) {
    if (lower.includes(key.toLowerCase())) return MOOD_PALETTES[key];
  }

  return NEUTRAL_PALETTE;
}
