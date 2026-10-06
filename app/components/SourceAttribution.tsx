import { ExternalLink } from 'lucide-react';
import type { Song } from '@/lib/sources/types';

type AttributionSong = Pick<Song, 'metadataSource' | 'spotifyId' | 'geniusId'>;

/** Provider identity describes metadata only; it is never an audio grant. */
export default function SourceAttribution({ song }: { song: AttributionSong }) {
  const spotify = song.metadataSource === 'spotify';
  const genius = song.metadataSource === 'genius';
  return (
    <div className="space-y-1 text-xs text-[var(--text-med)]">
      <p>{spotify ? 'Track metadata supplied by Spotify'
        : genius ? 'Track metadata supplied by Genius'
        : song.metadataSource === 'audd' ? 'Recognition metadata supplied by AudD'
        : 'Catalog metadata · original source unverified'}</p>
      {song.spotifyId && (
        <a
          href={`https://open.spotify.com/track/${encodeURIComponent(song.spotifyId)}`}
          target="_blank" rel="noopener noreferrer"
          aria-label="Open in Spotify (opens in a new tab)"
          className="inline-flex min-h-14 max-w-full flex-wrap items-center gap-4 rounded-lg px-4 py-4 text-[var(--text-hi)] underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-[var(--accent-from)] focus-visible:outline-offset-2"
        >
          {/* Official full logos, original proportions and monochrome colors. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brands/spotify-white.png" alt="" width={90} height={27} className="h-auto w-[90px] dark:block hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/brands/spotify-black.png" alt="" width={90} height={27} className="h-auto w-[90px] dark:hidden block" />
          <span>Open in Spotify</span><ExternalLink aria-hidden="true" size={14} />
        </a>
      )}
      {genius && song.geniusId && (
        <a href={`https://genius.com/songs/${song.geniusId}`} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center underline underline-offset-4">View track on Genius <ExternalLink aria-hidden="true" size={14} /></a>
      )}
    </div>
  );
}
