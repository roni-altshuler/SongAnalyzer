'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Song } from '@/lib/sources/types';
import { readArtistCredits } from '@/lib/artists/identity';

export type SelectedTrack = Pick<Song,
  'title' | 'artist' | 'artistCredits' | 'album' | 'year' | 'coverUrl' | 'previewUrl' | 'metadataSource' | 'spotifyId' | 'geniusId' | 'mbid'
>;
interface TrackSelection {
  song: SelectedTrack | null;
  setSong: (song: SelectedTrack | null) => void;
}
const TrackSelectionContext = createContext<TrackSelection | null>(null);

/** Visit-only selection. Enumerating fields prevents private/results payloads
 * and recording URLs from following the user between pages. No storage/API. */
export function TrackSelectionProvider({ children }: { children: ReactNode }) {
  const [song, updateSong] = useState<SelectedTrack | null>(null);
  const setSong = useCallback((selected: SelectedTrack | null) => {
    updateSong(selected ? {
      title: selected.title, artist: selected.artist, artistCredits: readArtistCredits(selected.artistCredits),
      album: selected.album, year: selected.year, coverUrl: selected.coverUrl,
      metadataSource: selected.metadataSource, spotifyId: selected.spotifyId,
      geniusId: selected.geniusId, mbid: selected.mbid,
    } : null);
  }, []);
  const value = useMemo(() => ({ song, setSong }), [song, setSong]);
  return <TrackSelectionContext.Provider value={value}>{children}</TrackSelectionContext.Provider>;
}

/** Isolated workbenches keep their original local selection behavior. The
 * application layout supplies the shared visit context across routed pages. */
export function useTrackSelection(): TrackSelection {
  const context = useContext(TrackSelectionContext);
  const [localSong, setLocalSong] = useState<SelectedTrack | null>(null);
  return context ?? { song: localSong, setSong: setLocalSong };
}
