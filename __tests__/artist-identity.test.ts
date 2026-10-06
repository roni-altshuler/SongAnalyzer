import { describe, expect, it } from 'vitest';
import { artistCredit, artistIdentity, artistKey, artistProfileHref, readArtistCredits } from '@/lib/artists/identity';
import { permitsArtistAsset, type ArtistVisualAsset } from '@/lib/artists/assets';

const person = artistCredit({ provider: 'musicbrainz', id: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee', name: 'Nora, Vale & Company', entityType: 'Person', typeEvidence: 'musicbrainz:artist.type' });
const asset: ArtistVisualAsset = {
  artist: { provider: 'musicbrainz', id: person.id! }, kind: 'portrait', url: 'https://artist.example/portrait.png',
  provenance: { sourceUrl: 'https://artist.example/press', official: 'verified' },
  permission: { status: 'approved', evidenceUrl: 'https://artist.example/permission', attribution: 'Artist press materials · permission recorded' },
};

describe('provider-qualified artist identity', () => {
  it('preserves comma and collaboration-looking names as single credits, with distinct IDs and source order', () => {
    const credits = readArtistCredits([
      { provider: 'spotify', id: 'first', name: 'Earth, Wind & Fire' },
      { provider: 'spotify', id: 'second', name: 'Earth, Wind & Fire' },
      { provider: 'genius', id: 123, name: 'A feat. B', url: 'https://genius.com/artists/A-feat-b' },
    ]);
    expect(credits.map((c) => c.name)).toEqual(['Earth, Wind & Fire', 'Earth, Wind & Fire', 'A feat. B']);
    expect(credits.map(artistProfileHref)).toEqual(['/artists/spotify/first', '/artists/spotify/second', '/artists/genius/123']);
    expect(credits[2].url).toBe('https://genius.com/artists/A-feat-b');
  });

  it('keeps namespaces separate and never derives a source ID from a display string', () => {
    expect(artistKey(artistIdentity('spotify', '123')!)).not.toBe(artistKey(artistIdentity('genius', '123')!));
    expect(readArtistCredits('Earth, Wind & Fire, Another artist')).toEqual([]);
    const unlinked = artistCredit({ provider: 'genius', name: 'A band-looking name' });
    expect(unlinked.id).toBeUndefined(); expect(artistProfileHref(unlinked)).toBeNull(); expect(unlinked.url).toBeUndefined();
  });

  it('uses only explicit MusicBrainz type evidence, not names or Spotify object type', () => {
    expect(person.entityType).toBe('Person');
    expect(artistCredit({ provider: 'musicbrainz', name: 'Solo-looking name', entityType: 'Group', typeEvidence: 'musicbrainz:artist.type' }).entityType).toBe('Group');
    expect(artistCredit({ provider: 'spotify', name: 'A Band', entityType: 'Group', typeEvidence: 'musicbrainz:artist.type' }).entityType).toBe('Unknown');
    expect(artistCredit({ provider: 'musicbrainz', name: 'Person', entityType: 'Person' }).entityType).toBe('Unknown');
    expect(artistCredit({ provider: 'musicbrainz', name: 'Choir', entityType: 'Choir', typeEvidence: 'musicbrainz:artist.type' }).entityType).toBe('Unknown');
  });

  it('rejects unsafe IDs and hrefs without manufacturing a Genius web link', () => {
    expect(artistIdentity('spotify', '../other')).toBeNull(); expect(artistIdentity('unknown', 'abc')).toBeNull();
    const genius = artistCredit({ provider: 'genius', id: 42, name: 'Name', url: 'javascript:alert(1)' });
    expect(genius.url).toBeUndefined();
    const spotify = artistCredit({ provider: 'spotify', id: 'artist', name: 'Name', url: 'https://open.spotify.com/track/unrelated' });
    expect(spotify.url).toBe('https://open.spotify.com/artist/artist');
  });
});

describe('artist visual permission and provenance', () => {
  it('allows an explicitly documented original portrait only for its identified Person', () => {
    expect(permitsArtistAsset(person, asset)).toBe(true);
    expect(permitsArtistAsset({ ...person, entityType: 'Unknown' }, asset)).toBe(false);
    expect(permitsArtistAsset({ ...person, id: 'bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee' }, asset)).toBe(false);
  });

  it.each(['unverified', 'denied'] as const)('denies %s display permission even for an official source', (status) => {
    expect(permitsArtistAsset(person, { ...asset, permission: { ...asset.permission, status } })).toBe(false);
  });

  it('rejects album-art relabelling, missing evidence, unofficial images and logos without Group evidence', () => {
    expect(permitsArtistAsset(person, { ...asset, kind: 'album-cover' })).toBe(false);
    expect(permitsArtistAsset(person, { ...asset, provenance: { ...asset.provenance, official: 'unverified' } })).toBe(false);
    expect(permitsArtistAsset(person, { ...asset, permission: { ...asset.permission, evidenceUrl: undefined } })).toBe(false);
    expect(permitsArtistAsset(person, { ...asset, kind: 'band-logo' })).toBe(false);
    expect(permitsArtistAsset({ ...person, entityType: 'Group' }, { ...asset, kind: 'band-logo' })).toBe(true);
  });
});
