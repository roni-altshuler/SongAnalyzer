/**
 * Unit tests for the atlas query helpers.
 *
 * We mock `@/lib/supabase/admin` so the tests never touch a real DB. Each
 * test installs its own synthetic row set via `setMockRows`, runs the
 * query, and asserts the shape of the rolled-up result.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

interface MockRow {
  analysis_id: string;
  share_slug: string | null;
  title: string | null;
  artist: string | null;
  album: string | null;
  release_year: number | null;
  result: Record<string, unknown> | null;
  created_at: string;
  is_public: boolean;
  system_seed: boolean;
}

let mockRows: MockRow[] = [];
let lastError: { message: string } | null = null;

function setMockRows(rows: MockRow[]): void {
  mockRows = rows;
  lastError = null;
}

function setMockError(message: string): void {
  lastError = { message };
  mockRows = [];
}

// ---------------------------------------------------------------------------
// Mock the admin client. We need to support:
//   supabase.from(...).select(...).or(...).eq(...)
// and have `await` on either chain step return { data, error }.
// ---------------------------------------------------------------------------
vi.mock('@/lib/supabase/admin', () => {
  function buildChain(rowsRef: () => MockRow[], errorRef: () => { message: string } | null) {
    const builder: Record<string, unknown> & {
      then: (resolve: (value: { data: MockRow[]; error: { message: string } | null }) => unknown) => unknown;
    } = {} as never;

    const passthrough = () => builder;
    const filtered = (_field: string, value: string) => {
      // Allow eq('artist', 'Foo') to narrow the dataset so the artist query
      // tests work without needing a separate mock per call.
      mockRows = rowsRef().filter((row) => row.artist === value);
      return builder;
    };

    Object.assign(builder, {
      select: passthrough,
      or: passthrough,
      eq: filtered,
      ilike: passthrough,
      limit: passthrough,
      maybeSingle: () =>
        Promise.resolve({
          data: rowsRef()[0] ?? null,
          error: errorRef(),
        }),
      then: (resolve: (value: { data: MockRow[]; error: { message: string } | null }) => unknown) =>
        resolve({
          data: rowsRef(),
          error: errorRef(),
        }),
    });

    return builder;
  }

  const fakeClient = {
    from: () => buildChain(() => mockRows, () => lastError),
  };

  return {
    getAdminSupabase: () => fakeClient,
  };
});

// Important: import the SUT after mocks are registered.
import {
  getAtlasOverview,
  getArtistAtlas,
  getGenreAtlas,
} from '@/lib/atlas/queries';

const sampleRows: MockRow[] = [
  {
    analysis_id: 'a1',
    share_slug: 's1',
    title: 'Sunshine Boulevard',
    artist: 'Neon Echo',
    album: null,
    release_year: 2019,
    result: {
      mood: 'Euphoric',
      genre: 'Pop',
      confidence: 0.65,
      wordCount: 30,
      themes: ['Love & Romance', 'Celebration'],
    },
    created_at: '2024-01-01T00:00:00Z',
    is_public: true,
    system_seed: true,
  },
  {
    analysis_id: 'a2',
    share_slug: 's2',
    title: 'Velvet Hours',
    artist: 'Neon Echo',
    album: null,
    release_year: 2022,
    result: {
      mood: 'Peaceful',
      genre: 'Pop',
      confidence: 0.75,
      wordCount: 28,
      themes: ['Hope', 'Nature'],
    },
    created_at: '2024-02-01T00:00:00Z',
    is_public: true,
    system_seed: true,
  },
  {
    analysis_id: 'a3',
    share_slug: 's3',
    title: 'Iron Lungs',
    artist: 'Crimson Static',
    album: null,
    release_year: 2014,
    result: {
      mood: 'Aggressive',
      genre: 'Rock',
      confidence: 0.85,
      wordCount: 32,
      themes: ['Struggle', 'Freedom'],
    },
    created_at: '2024-03-01T00:00:00Z',
    is_public: true,
    system_seed: true,
  },
  {
    analysis_id: 'a4',
    share_slug: 's4',
    title: 'Pale Morning',
    artist: 'Glass Garden',
    album: null,
    release_year: 2020,
    result: {
      mood: 'Sorrowful',
      genre: 'Folk',
      confidence: 0.7,
      wordCount: 27,
      themes: ['Heartbreak'],
    },
    created_at: '2024-04-01T00:00:00Z',
    is_public: true,
    system_seed: true,
  },
];

describe('getAtlasOverview', () => {
  beforeEach(() => {
    setMockRows(sampleRows.slice());
  });

  afterEach(() => {
    setMockRows([]);
  });

  it('counts analyses and unique artists across the dataset', async () => {
    const overview = await getAtlasOverview();
    expect(overview.totalAnalyses).toBe(4);
    expect(overview.totalArtists).toBe(3);
  });

  it('builds a mood distribution sorted by frequency', async () => {
    const overview = await getAtlasOverview();
    // 4 unique moods, each appearing once.
    expect(overview.moodDistribution).toHaveLength(4);
    for (const slice of overview.moodDistribution) {
      expect(slice.count).toBe(1);
      // Every slice must have a color from the palette.
      expect(slice.color.from).toMatch(/^#/);
    }
  });

  it('aggregates by genre with the dominant mood as the tile tint', async () => {
    const overview = await getAtlasOverview();
    const pop = overview.genreDistribution.find((g) => g.genre === 'Pop');
    expect(pop?.count).toBe(2);
    expect(['Euphoric', 'Peaceful']).toContain(pop?.dominantMood);

    const rock = overview.genreDistribution.find((g) => g.genre === 'Rock');
    expect(rock?.count).toBe(1);
    expect(rock?.dominantMood).toBe('Aggressive');
  });

  it('ranks top artists by analysis count and slugifies their names', async () => {
    const overview = await getAtlasOverview();
    expect(overview.topArtists[0].artist).toBe('Neon Echo');
    expect(overview.topArtists[0].artistSlug).toBe('neon-echo');
    expect(overview.topArtists[0].count).toBe(2);
  });

  it('returns an empty shape when the dataset has no rows', async () => {
    setMockRows([]);
    const overview = await getAtlasOverview();
    expect(overview.totalAnalyses).toBe(0);
    expect(overview.totalArtists).toBe(0);
    expect(overview.moodDistribution).toEqual([]);
    expect(overview.genreDistribution).toEqual([]);
    expect(overview.topArtists).toEqual([]);
  });

  it('degrades to an empty overview when the view is missing', async () => {
    setMockError('relation "public.analyses_with_song" does not exist');
    const overview = await getAtlasOverview();
    expect(overview.totalAnalyses).toBe(0);
    expect(overview.moodDistribution).toEqual([]);
  });
});

describe('getArtistAtlas', () => {
  beforeEach(() => {
    setMockRows(sampleRows.slice());
  });

  afterEach(() => {
    setMockRows([]);
  });

  it('returns null when the artist is absent from the dataset', async () => {
    const atlas = await getArtistAtlas('Ghost Band That Does Not Exist');
    expect(atlas).toBeNull();
  });

  it('rolls up an artist with multiple analyses across years', async () => {
    const atlas = await getArtistAtlas('Neon Echo');
    expect(atlas).not.toBeNull();
    expect(atlas!.artist).toBe('Neon Echo');
    expect(atlas!.analyses).toHaveLength(2);
    expect(atlas!.moodOverTime.length).toBeGreaterThanOrEqual(2);
    // Mood-over-time is sorted ascending.
    const periods = atlas!.moodOverTime.map((p) => p.period);
    expect(periods).toEqual([...periods].sort((a, b) => a - b));
    expect(atlas!.avgConfidence).toBeCloseTo(0.7, 5);
  });
});

describe('getGenreAtlas', () => {
  beforeEach(() => {
    setMockRows(sampleRows.slice());
  });

  afterEach(() => {
    setMockRows([]);
  });

  it('returns null when no analyses match the genre', async () => {
    const atlas = await getGenreAtlas('Jazz');
    expect(atlas).toBeNull();
  });

  it('lists artists, moods, and theme frequencies for a populated genre', async () => {
    const atlas = await getGenreAtlas('Pop');
    expect(atlas).not.toBeNull();
    expect(atlas!.genre).toBe('Pop');
    expect(atlas!.analyses).toHaveLength(2);
    // 2 pop rows, both Neon Echo.
    expect(atlas!.topArtists[0].artist).toBe('Neon Echo');
    expect(atlas!.topArtists[0].count).toBe(2);
    // Themes are de-duplicated and counted.
    const themeNames = atlas!.themeFrequency.map((slice) => slice.theme);
    expect(themeNames).toEqual(expect.arrayContaining(['Love & Romance', 'Hope']));
  });
});
