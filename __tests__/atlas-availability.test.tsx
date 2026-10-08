import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import AtlasPage from '@/app/atlas/page';
import GenrePage from '@/app/atlas/genre/[name]/page';
import { getAtlasOverview, getGenreAtlas } from '@/lib/atlas/queries';

vi.mock('@/lib/atlas/queries', () => ({ getAtlasOverview: vi.fn(), getGenreAtlas: vi.fn() }));
afterEach(() => { vi.restoreAllMocks(); });

describe('public catalog availability', () => {
  it('hides unknown totals and offers a useful route when the overview read fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getAtlasOverview).mockRejectedValueOnce(new Error('Controlled catalog outage'));
    const html = renderToStaticMarkup(await AtlasPage());
    expect(html).toContain('Public readings unavailable</h3>');
    expect(html).not.toContain('Analyses</dt>');
    expect(html).not.toContain('No public readings yet');
    expect(html).toContain('href="/analyze"');
    expect(html).not.toContain('supabase db reset');
  });

  it('shows zero totals only after a successful empty overview read', async () => {
    vi.mocked(getAtlasOverview).mockResolvedValueOnce({ totalAnalyses: 0, totalArtists: 0, moodDistribution: [], genreDistribution: [], topArtists: [] });
    const html = renderToStaticMarkup(await AtlasPage());
    expect(html).toContain('No public readings yet</h3>');
    expect(html).toContain('Analyses</dt>');
    expect(html).not.toContain('Public readings unavailable');
  });

  it('distinguishes a genre read failure from missing public rows', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(getGenreAtlas).mockRejectedValueOnce(new Error('Controlled catalog outage'));
    const html = renderToStaticMarkup(await GenrePage({ params: Promise.resolve({ name: 'rock' }) }));
    expect(html).toContain('Genre readings unavailable</h3>');
    expect(html).not.toContain('Analyses</dt>');
    expect(html).not.toContain('No Rock analyses yet');
  });

  it('retains the honest empty state for a canonical genre with no public rows', async () => {
    vi.mocked(getGenreAtlas).mockResolvedValueOnce(null);
    const html = renderToStaticMarkup(await GenrePage({ params: Promise.resolve({ name: 'rock' }) }));
    expect(html).toContain('No Rock analyses yet</h3>');
    expect(html).toContain('Analyses</dt>');
    expect(html).not.toContain('Genre readings unavailable');
  });
});
