import type { Song } from '../../lib/sources/types';

/** Original controlled metadata for navigation QA; not a provider success or catalog recording. */
export const navigationTrack: Song = {
  title: 'Original navigation demo', artist: 'Demo ensemble', album: 'Navigation study', year: 2026,
  spotifyId: 'navigation-demo', metadataSource: 'spotify',
  previewUrl: 'https://p.scdn.co/prohibited-navigation-preview.mp3',
  artistCredits: [{ provider: 'spotify', id: 'demo-ensemble', name: 'Demo ensemble', entityType: 'Unknown' }],
};
