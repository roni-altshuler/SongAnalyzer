import { artistKey, type ArtistCredit, type ArtistIdentity } from './identity';

/** Visual meaning and permission are separate from an image being in an API. */
export interface ArtistVisualAsset {
  artist: ArtistIdentity;
  kind: 'portrait' | 'band-logo' | 'artist-image' | 'album-cover';
  url: string;
  provenance: {
    sourceUrl: string;
    official: 'verified' | 'unverified';
  };
  permission: {
    status: 'approved' | 'unverified' | 'denied';
    /** Public permission/license evidence, including permission to display here. */
    evidenceUrl?: string;
    attribution?: string;
  };
}

/**
 * Trusted, reviewed asset records only. No existing artist visual has verified
 * display permission, so this registry is deliberately empty. Album art and
 * caller/session payloads never populate it. No image-provider call is made.
 */
const APPROVED_ARTIST_ASSETS: readonly ArtistVisualAsset[] = [];

function publicHttps(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password && !url.port;
  } catch { return false; }
}

export function permitsArtistAsset(credit: ArtistCredit, asset: ArtistVisualAsset): boolean {
  if (!credit.id || artistKey({ provider: credit.provider, id: credit.id }) !== artistKey(asset.artist)) return false;
  if (asset.kind !== 'portrait' && asset.kind !== 'band-logo' && asset.kind !== 'artist-image') return false;
  if (asset.kind === 'portrait' && credit.entityType !== 'Person') return false;
  if (asset.kind === 'band-logo' && credit.entityType !== 'Group') return false;
  return asset.permission.status === 'approved' && asset.provenance.official === 'verified'
    && publicHttps(asset.url) && publicHttps(asset.provenance.sourceUrl)
    && publicHttps(asset.permission.evidenceUrl) && Boolean(asset.permission.attribution?.trim());
}

export function permittedArtistAsset(credit: ArtistCredit): ArtistVisualAsset | null {
  return APPROVED_ARTIST_ASSETS.find((asset) => permitsArtistAsset(credit, asset)) ?? null;
}
