/** Artist identity comes from source IDs, never from a display-name split. */
export type ArtistProvider = 'spotify' | 'genius' | 'musicbrainz';
export type ArtistEntityType = 'Person' | 'Group' | 'Unknown';

export interface ArtistIdentity {
  provider: ArtistProvider;
  id: string;
}

export interface ArtistCredit {
  provider: ArtistProvider;
  /** Missing source IDs stay missing; a name is not an identifier. */
  id?: string;
  name: string;
  creditedName?: string;
  url?: string;
  entityType: ArtistEntityType;
  /** Only the existing MusicBrainz artist.type field supplies this distinction. */
  typeEvidence?: 'musicbrainz:artist.type';
}

export const ARTIST_PROVIDER_LABELS: Record<ArtistProvider, string> = {
  spotify: 'Spotify', genius: 'Genius', musicbrainz: 'MusicBrainz',
};

export function artistIdentity(provider: unknown, rawId: unknown): ArtistIdentity | null {
  if (provider !== 'spotify' && provider !== 'genius' && provider !== 'musicbrainz') return null;
  const id = typeof rawId === 'string' ? rawId : typeof rawId === 'number' ? String(rawId) : '';
  if (provider === 'spotify' && /^[A-Za-z0-9_-]{1,128}$/.test(id)) return { provider, id };
  if (provider === 'genius' && /^\d{1,16}$/.test(id) && Number.isSafeInteger(Number(id)) && Number(id) > 0) {
    return { provider, id: String(Number(id)) };
  }
  if (provider === 'musicbrainz' && /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) {
    return { provider, id: id.toLowerCase() };
  }
  return null;
}

export function artistKey(identity: ArtistIdentity): string {
  return `${identity.provider}:${identity.id}`;
}

export function artistProfileHref(credit: Pick<ArtistCredit, 'provider' | 'id'>): string | null {
  const identity = artistIdentity(credit.provider, credit.id);
  return identity ? `/artists/${identity.provider}/${encodeURIComponent(identity.id)}` : null;
}

/** Preserve a source URL only on its artist surface; never trust arbitrary hrefs. */
function artistSourceUrl(identity: ArtistIdentity | null, provider: ArtistProvider, raw: unknown): string | undefined {
  if (typeof raw === 'string' && raw.length <= 2000) {
    try {
      const url = new URL(raw);
      if (url.protocol === 'https:' && !url.username && !url.password && !url.port) {
        if (provider === 'spotify' && identity && url.hostname === 'open.spotify.com' && url.pathname === `/artist/${identity.id}`) return url.href;
        if (provider === 'musicbrainz' && identity && url.hostname === 'musicbrainz.org' && url.pathname.toLowerCase() === `/artist/${identity.id}`) return url.href;
        if (provider === 'genius' && url.hostname === 'genius.com' && /^\/artists\/[^/]+\/?$/.test(url.pathname)) return url.href;
      }
    } catch { /* Missing/invalid source links have no clickable substitute. */ }
  }
  if (identity?.provider === 'spotify') return `https://open.spotify.com/artist/${identity.id}`;
  if (identity?.provider === 'musicbrainz') return `https://musicbrainz.org/artist/${identity.id}`;
  return undefined;
}

export function artistCredit(input: {
  provider: ArtistProvider; id?: unknown; name: string; creditedName?: string;
  url?: unknown; entityType?: unknown; typeEvidence?: unknown;
}): ArtistCredit {
  const identity = artistIdentity(input.provider, input.id);
  const suppliedType = input.provider === 'musicbrainz' && input.typeEvidence === 'musicbrainz:artist.type'
    && (input.entityType === 'Person' || input.entityType === 'Group');
  return {
    provider: input.provider, id: identity?.id, name: input.name,
    creditedName: input.creditedName,
    url: artistSourceUrl(identity, input.provider, input.url),
    entityType: suppliedType ? input.entityType as ArtistEntityType : 'Unknown',
    typeEvidence: suppliedType ? 'musicbrainz:artist.type' : undefined,
  };
}

/** Validate browser/serialized metadata without manufacturing missing identity. */
export function readArtistCredits(value: unknown): ArtistCredit[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return [];
    const item = raw as Record<string, unknown>;
    if (item.provider !== 'spotify' && item.provider !== 'genius' && item.provider !== 'musicbrainz') return [];
    if (typeof item.name !== 'string' || !item.name.trim() || item.name.length > 300) return [];
    return [artistCredit({
      provider: item.provider, id: item.id, name: item.name,
      creditedName: typeof item.creditedName === 'string' && item.creditedName.length <= 300 ? item.creditedName : undefined,
      url: item.url, entityType: item.entityType, typeEvidence: item.typeEvidence,
    })];
  });
}
