'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import type { Song } from '@/lib/sources/types';
import { artistProfileHref, readArtistCredits } from '@/lib/artists/identity';
import { rememberArtistContext } from '@/lib/artists/context';

type CreditedSong = Pick<Song, 'title' | 'artist' | 'artistCredits' | 'album' | 'year' | 'metadataSource' | 'spotifyId' | 'geniusId' | 'mbid'>;

export default function ArtistCredits({ song, origin }: { song: CreditedSong; origin?: string }) {
  const pathname = usePathname();
  const credits = readArtistCredits(song.artistCredits);
  if (!credits.length) return <div className="space-y-1"><p className="break-words text-sm text-[var(--text-med)]">{song.artist}</p><p className="text-xs text-[var(--text-med)]">Artist profiles unavailable · source artist IDs missing.</p></div>;
  return (
    <ul aria-label="Credited artists" className="flex flex-wrap gap-x-3 gap-y-1 text-sm text-[var(--text-med)]">
      {credits.map((credit, index) => {
        const href = artistProfileHref(credit);
        const name = credit.creditedName ?? credit.name;
        return (
          <li key={`${credit.provider}:${credit.id ?? 'unlinked'}:${index}`} className="min-w-0 max-w-full">
            {href ? (
              <Link href={href} onClick={() => rememberArtistContext(song, origin ?? pathname, credit)} aria-label={`${name} artist profile`}
                className="inline-flex min-h-11 max-w-full items-center gap-1.5 rounded-lg py-2 underline decoration-[var(--border-strong)] underline-offset-4 hover:text-[var(--text-hi)] focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2">
                <span className="min-w-0 break-words">{name}</span><ArrowUpRight size={14} aria-hidden="true" className="shrink-0" />
              </Link>
            ) : <span className="inline-flex min-h-11 max-w-full items-center py-2"><span className="min-w-0 break-words">{name}</span><span className="ml-2 text-xs">(artist ID unavailable)</span></span>}
          </li>
        );
      })}
    </ul>
  );
}
