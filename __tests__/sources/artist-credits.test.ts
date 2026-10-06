import { afterEach, describe, expect, it, vi } from 'vitest';
import { getGeniusSong, searchGenius } from '@/lib/sources/genius';
import { __resetMusicBrainzRateLimit, searchMusicBrainz } from '@/lib/sources/musicbrainz';

afterEach(() => { vi.restoreAllMocks(); delete process.env.GENIUS_ACCESS_TOKEN; __resetMusicBrainzRateLimit(); });
const json = (value: unknown) => new Response(JSON.stringify(value));

describe('artist credits from existing provider responses', () => {
  it('retains Genius primary and featured IDs/names/links without assuming artist type', async () => {
    process.env.GENIUS_ACCESS_TOKEN = 'test';
    const result = { id: 7, title: 'Original fixture', primary_artist: { id: 42, name: 'Nora, Vale', url: 'https://genius.com/artists/Nora-vale' },
      featured_artists: [{ id: 43, name: 'The Harbour Quartet', url: 'https://genius.com/artists/Harbour-quartet' }] };
    const fetcher = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url) => String(url).includes('/search')
      ? json({ response: { hits: [{ type: 'song', result }] } }) : json({ response: { song: result } }));
    for (const song of [(await searchGenius('fixture'))[0].song, await getGeniusSong(7)]) {
      expect(song.artistCredits?.map((credit) => [credit.id, credit.name, credit.entityType])).toEqual([
        ['42', 'Nora, Vale', 'Unknown'], ['43', 'The Harbour Quartet', 'Unknown'],
      ]);
      expect(song.artistCredits?.[0].url).toBe(result.primary_artist.url);
    }
    expect(fetcher).toHaveBeenCalledTimes(2); expect(fetcher.mock.calls.some(([url]) => String(url).includes('/artists/'))).toBe(false);
  });

  it('keeps explicit MusicBrainz type evidence and credited aliases in source order', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json({ recordings: [{ id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', score: 100,
      'artist-credit': [
        { name: 'N. Vale', artist: { id: 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'Nora, Vale', type: 'Person' } },
        { name: 'The Harbour Quartet', artist: { id: 'cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'The Harbour Quartet', type: 'Group' } },
      ] }] }));
    const hit = (await searchMusicBrainz('fixture'))[0];
    expect(hit.artistCredits?.map((credit) => [credit.id, credit.name, credit.creditedName, credit.entityType])).toEqual([
      ['bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee', 'Nora, Vale', 'N. Vale', 'Person'],
      ['cccccccc-bbbb-cccc-dddd-eeeeeeeeeeee', 'The Harbour Quartet', 'The Harbour Quartet', 'Group'],
    ]);
    expect(hit.artistCredits?.[0].typeEvidence).toBe('musicbrainz:artist.type');
    expect(fetch).toHaveBeenCalledOnce();
  });
});
