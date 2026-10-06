'use client';

import { useState } from 'react';
import { Disc3, UserRound, UsersRound } from 'lucide-react';
import { permittedArtistAsset } from '@/lib/artists/assets';
import type { ArtistCredit } from '@/lib/artists/identity';

export default function ArtistVisual({ artist }: { artist: ArtistCredit }) {
  const [failed, setFailed] = useState(false);
  const asset = permittedArtistAsset(artist);
  const image = !failed ? asset : null;
  const Icon = artist.entityType === 'Person' ? UserRound : artist.entityType === 'Group' ? UsersRound : Disc3;
  const label = image?.kind === 'portrait' ? 'Official portrait'
    : image?.kind === 'band-logo' ? 'Official band logo' : 'Artist image';
  return (
    <figure aria-label="Artist visual" className="w-36 shrink-0 space-y-3 sm:w-44">
      <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elev2)]">
        {image ? (
          // Preserve the approved original; no crop, overlay or album-art substitution.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt={`${artist.name} — ${label.toLowerCase()}`} className="h-full w-full object-contain" onError={() => setFailed(true)} />
        ) : (
          <div aria-hidden="true" className="flex h-28 w-28 items-center justify-center rounded-full border border-[var(--border-strong)] bg-[linear-gradient(135deg,var(--bg-elev1),var(--bg-elev3))] ring-8 ring-[var(--border-subtle)] sm:h-32 sm:w-32">
            <Icon size={42} strokeWidth={1.25} className="text-[var(--text-med)]" />
          </div>
        )}
      </div>
      <figcaption className="text-xs leading-relaxed text-[var(--text-med)]">
        {image ? <><span className="block font-medium">{label}</span><span>{image.permission.attribution}</span><a href={image.provenance.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">Image source (new tab)</a></>
          : <><span className="block font-medium">Artist image unavailable</span><span>{failed ? 'The approved image could not load.' : 'An approved portrait or band mark is not available here yet.'}</span></>}
      </figcaption>
    </figure>
  );
}
