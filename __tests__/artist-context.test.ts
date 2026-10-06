// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ARTIST_CONTEXT_KEY, loadArtistContext, rememberArtistContext } from '@/lib/artists/context';
import { artistCredit } from '@/lib/artists/identity';
import type { Song } from '@/lib/sources/types';

afterEach(() => { sessionStorage.clear(); vi.restoreAllMocks(); });
const credit = (id: string) => artistCredit({ provider: 'spotify', id, name: 'Artist, with a comma' });
function song(id: string, artistId: string, extra?: Partial<Song>): Song {
  return { title: 'Track', artist: 'Legacy joined label', artistCredits: [credit(artistId)], spotifyId: id, metadataSource: 'spotify', ...extra };
}

describe('tab-local artist context', () => {
  it('connects only credited IDs, keeps collab artists separate, and retains metadata across reads', () => {
    rememberArtistContext(song('track-1', 'alpha', { artistCredits: [credit('alpha'), credit('beta')] }), '/analyze');
    const alpha = loadArtistContext({ provider: 'spotify', id: 'alpha' });
    const beta = loadArtistContext({ provider: 'spotify', id: 'beta' });
    expect(alpha.status).toBe('ready'); expect(beta.status).toBe('ready');
    if (alpha.status !== 'ready') throw new Error('missing context');
    expect(alpha.context.artist.name).toBe('Artist, with a comma');
    expect(alpha.context.tracks[0].origin).toBe('/analyze');
    expect(loadArtistContext({ provider: 'genius', id: '123' }).status).toBe('empty');
  });

  it('deduplicates by track ID without collapsing different tracks with the same name', () => {
    rememberArtistContext(song('track-2', 'dedup'), '/discover');
    rememberArtistContext(song('track-3', 'dedup'), '/discover');
    rememberArtistContext(song('track-2', 'dedup'), '/discover');
    const state = loadArtistContext({ provider: 'spotify', id: 'dedup' });
    if (state.status !== 'ready') throw new Error('missing context');
    expect(state.context.tracks.map((track) => track.spotifyId)).toEqual(['track-2', 'track-3']);
  });

  it('does not store previews, album images, arbitrary identity assets, lyrics or measurements', () => {
    const selected = { ...song('track-4', 'minimal'), coverUrl: 'https://cover.example/album.png', previewUrl: 'https://audio.example/clip.mp3', lyrics: 'private text', result: { mood: 'Happy' }, artistImage: 'https://image.example/portrait.png' };
    rememberArtistContext(selected, 'https://untrusted.example');
    const text = sessionStorage.getItem(ARTIST_CONTEXT_KEY)!;
    for (const prohibited of ['private text', 'cover.example', 'audio.example', 'image.example', 'Happy']) expect(text).not.toContain(prohibited);
    const state = loadArtistContext({ provider: 'spotify', id: 'minimal' });
    if (state.status !== 'ready') throw new Error('missing context');
    expect(state.context.tracks[0].origin).toBe('/discover');
  });

  it('reports corrupt storage as unavailable instead of claiming there are no tracks', () => {
    sessionStorage.setItem(ARTIST_CONTEXT_KEY, '{broken');
    expect(loadArtistContext({ provider: 'spotify', id: 'unseen-corrupt' })).toEqual({ status: 'error' });
  });

  it('keeps an explicitly temporary visit usable when storage is denied', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    rememberArtistContext(song('track-5', 'temporary'), '/identify');
    const state = loadArtistContext({ provider: 'spotify', id: 'temporary' });
    expect(state.status).toBe('ready');
    if (state.status !== 'ready') throw new Error('missing temporary context');
    expect(state.temporary).toBe(true);
    expect(loadArtistContext({ provider: 'spotify', id: 'unseen-denied' })).toEqual({ status: 'error' });
  });

  it('retains fresh visit metadata after a quota failure instead of reverting to an old stored snapshot', () => {
    rememberArtistContext(song('quota-old', 'quota'), '/discover');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    rememberArtistContext(song('quota-new', 'quota'), '/discover');
    rememberArtistContext(song('other-visit', 'other-artist'), '/discover');
    const state = loadArtistContext({ provider: 'spotify', id: 'quota' });
    if (state.status !== 'ready') throw new Error('missing quota context');
    expect(state.temporary).toBe(true);
    expect(state.context.tracks.map((track) => track.spotifyId)).toEqual(['quota-new', 'quota-old']);
  });

  it('keeps the clicked identity available beyond the bounded recent-profile cache without changing credit order', () => {
    const many = Array.from({ length: 45 }, (_, index) => credit(`many-${index}`));
    rememberArtistContext(song('many-track', 'many-0', { artistCredits: many }), '/discover', many[0]);
    const state = loadArtistContext({ provider: 'spotify', id: 'many-0' });
    if (state.status !== 'ready') throw new Error('clicked artist was evicted');
    expect(state.context.tracks[0].artistCredits.map((artist) => artist.id)).toEqual(many.map((artist) => artist.id));
  });
});
